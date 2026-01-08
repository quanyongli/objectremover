import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth.server";
import { createTask, updateTask } from "~/lib/tasks.repo";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_API_URL = "https://api.replicate.com/v1";

// ProPainter 模型版本
const PROPAINTER_VERSION = "e5ea7ae04e97c96a0e14c70d8e4cb899abdf326a377c01f1c10966ccd6c6bae4";

// 模拟模式：通过环境变量控制，避免在测试时调用真实 API（节省成本）
const MOCK_PROPAINTER = process.env.MOCK_PROPAINTER === "true" || process.env.MOCK_PROPAINTER === "1";
const MOCK_SAM3 = process.env.MOCK_SAM3 === "true" || process.env.MOCK_SAM3 === "1";

// 模拟预测状态存储（用于模拟状态转换）
const mockPredictions = new Map<string, {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed";
  output?: string[];
  error?: string;
  createdAt: number;
}>();

/**
 * 模拟 ProPainter API 调用
 * 返回一个模拟的 prediction 对象，状态会随时间变化
 */
async function mockProPainterPrediction(input: any): Promise<any> {
  const predictionId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // 创建初始状态
  mockPredictions.set(predictionId, {
    id: predictionId,
    status: "starting",
    createdAt: Date.now(),
  });

  console.log("🎭 [MOCK] ProPainter prediction created:", predictionId);
  console.log("🎭 [MOCK] Input:", JSON.stringify(input, null, 2));

  return {
    id: predictionId,
    status: "starting",
    created_at: new Date().toISOString(),
    urls: {
      get: `http://localhost:8000/api/processing/task/${predictionId}`,
      cancel: `http://localhost:8000/api/processing/task/${predictionId}/cancel`,
    },
  };
}

/**
 * 获取模拟预测状态
 * 模拟状态转换：starting -> processing -> succeeded
 */
function getMockPredictionStatus(predictionId: string): any {
  const prediction = mockPredictions.get(predictionId);
  if (!prediction) {
    return {
      id: predictionId,
      status: "failed",
      error: "Prediction not found",
    };
  }

  const elapsed = Date.now() - prediction.createdAt;
  
  // 状态转换逻辑：
  // 0-2秒: starting
  // 2-8秒: processing
  // 8秒后: succeeded
  if (elapsed < 2000) {
    prediction.status = "starting";
  } else if (elapsed < 8000) {
    prediction.status = "processing";
  } else {
    prediction.status = "succeeded";
    // 生成模拟输出 URL（使用占位符或原始视频 URL）
    if (!prediction.output) {
      // 使用一个占位符视频 URL，或者可以返回原始视频 URL 作为测试
      prediction.output = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", // 示例视频
      ];
    }
  }

  const result: any = {
    id: prediction.id,
    status: prediction.status,
    created_at: new Date(prediction.createdAt).toISOString(),
  };

  if (prediction.status === "succeeded" && prediction.output) {
    result.output = prediction.output;
  } else if ((prediction as any).status === "failed" && (prediction as any).error) {
    result.error = (prediction as any).error;
  }

  return result;
}

/**
 * 模拟 SAM3 API 调用
 */
async function mockSAM3Prediction(input: any): Promise<any> {
  const predictionId = `mock-sam3-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log("🎭 [MOCK] SAM3 prediction created:", predictionId);
  console.log("🎭 [MOCK] Input:", JSON.stringify(input, null, 2));

  // 模拟立即返回结果（SAM3 通常很快）
  return {
    id: predictionId,
    status: "succeeded",
    output: [
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", // 模拟遮罩视频 URL
    ],
    created_at: new Date().toISOString(),
  };
}

// 获取用户ID的辅助函数
async function requireUserId(request: Request): Promise<string> {
  try {
    const session = await auth.api?.getSession?.({ headers: request.headers });
    const uid: string | undefined = session?.user?.id || session?.session?.userId;
    if (uid) return String(uid);
  } catch {
    console.error("Failed to get session");
  }
  throw new Response("Unauthorized", { status: 401 });
}

// 生成遮罩（调用 SAM3）
export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // 处理 /api/processing/generate-mask
    if (path.includes("/generate-mask")) {
      const body = await request.json();
      const { 
        textPrompt, 
        videoUrl, 
        frameImage, 
        isSingleFrame = false,
        visualPromptPoints, // 新增：视觉提示点数组
        negativePrompt, // 新增：排除提示
        imageWidth, // 新增：图片宽度
        imageHeight, // 新增：图片高度
      } = body;

      console.log("🎭 Generating mask with SAM3:", {
        textPrompt,
        videoUrl,
        isSingleFrame,
        hasFrameImage: !!frameImage,
        visualPromptPointsCount: visualPromptPoints?.length || 0,
        negativePrompt,
      });

      // 根据模拟模式选择调用真实 API 或模拟 API
      let prediction: any;

      if (MOCK_SAM3) {
        console.log("🎭 Using MOCK mode for SAM3 (cost-saving mode)");
        const replicateInput: any = {
          prompt: textPrompt || "object",
          mask_only: true, // 全视频遮罩：mask_only: true 返回纯遮罩给 ProPainter
        };

        if (isSingleFrame && frameImage) {
          replicateInput.video = frameImage; // 使用 video 字段，传入图片 URL
        } else if (videoUrl) {
          replicateInput.video = videoUrl;
        }

        prediction = await mockSAM3Prediction(replicateInput);
      } else {
        // 检查 API Token
        if (!REPLICATE_API_TOKEN) {
          return new Response(
            JSON.stringify({ error: "REPLICATE_API_TOKEN not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        // 调用 Replicate SAM3 API
        // 根据 https://replicate.com/lucataco/sam3-video
        // SAM3 只接受 video 字段（即使是图片 URL 也要用 video）
        const replicateInput: any = {
        // 提示策略：
        // - 有 textPrompt 用 textPrompt
        // - 否则回落一个最弱语义 "object"，避免 SAM3 报 No prompts available
        //   由于我们在前端已清空语义并仅使用正例点锁定实例，弱语义不会重新召回所有对象
        prompt: textPrompt && textPrompt.trim() !== "" ? textPrompt : "object", // 使用 prompt 而不是 text_prompt
        // 单帧预览：mask_only: false 返回带颜色的遮罩层用于可视化确认
        // 全视频遮罩：mask_only: true 返回纯遮罩给 ProPainter
        mask_only: !isSingleFrame, // 单帧为 false（可视化），全视频为 true（纯遮罩）
        mask_opacity: 0.5, // 遮罩不透明度（仅在 mask_only: false 时有效）
      };

        // 如果是单帧遮罩，使用 frameImage URL；否则使用 videoUrl
        // 注意：SAM3-video 只接受 video 字段，即使是图片 URL 也要用 video
        if (isSingleFrame && frameImage) {
          replicateInput.video = frameImage; // 使用 video 字段，传入图片 URL
        } else if (videoUrl) {
          replicateInput.video = videoUrl;
        } else {
          return new Response(
            JSON.stringify({ error: "Either frameImage or videoUrl is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // 添加 negative_prompt（如果提供）
        if (negativePrompt) {
          replicateInput.negative_prompt = negativePrompt;
          console.log("📌 Using negative_prompt:", negativePrompt);
        }

        // 添加 visual_prompt（如果提供点击点）
        if (visualPromptPoints && visualPromptPoints.length > 0) {
          try {
            const points = visualPromptPoints.map((p: any) => [p.x, p.y]);
            // 注意：使用 ?? 而不是 ||，因为 label: 0 是有效的（排除点）
            const labels = visualPromptPoints.map((p: any) => p.label !== undefined ? p.label : 1);
            // 单帧预览场景只有一帧，frame_index 必须为 0，否则 SAM3 会报 "No prompts available"
            const frameIndex = isSingleFrame ? 0 : (visualPromptPoints[0]?.frameIndex ?? 0);
            
            const visualPromptJson = JSON.stringify({
              points,
              labels,
              frame_index: frameIndex,
            });
            
            replicateInput.visual_prompt = visualPromptJson;
            console.log("📌 Using visual_prompt:", visualPromptJson);
          } catch (error) {
            console.warn("⚠️ Failed to build visual_prompt:", error);
            // 如果构建失败，继续使用 text prompt
          }
        }

        console.log("📤 Calling Replicate SAM3 API...");
        // 创建安全的日志对象（避免打印完整的 base64 字符串）
        const logInput = { ...replicateInput };
        if (logInput.video && typeof logInput.video === "string" && logInput.video.startsWith("data:")) {
          logInput.video = `[base64 data, length: ${logInput.video.length} chars]`;
        }
        console.log("📤 Input:", JSON.stringify(logInput, null, 2));

        // 创建预测 - 使用具体的模型版本
        const predictionResponse = await fetch(
        `${REPLICATE_API_URL}/predictions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${REPLICATE_API_TOKEN}`,
          },
          body: JSON.stringify({
            version: "8cbab4c2a3133e679b5b863b80527f6b5c751ec7b33681b7e0b7c79c749df961", // 使用具体版本号
            input: replicateInput,
          }),
        }
      );

        if (!predictionResponse.ok) {
          const error = await predictionResponse.text();
          console.error("❌ Replicate API error:", predictionResponse.status, error);
          return new Response(
            JSON.stringify({
              error: `Replicate API error: ${predictionResponse.status} - ${error}`,
            }),
            {
              status: predictionResponse.status,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        prediction = await predictionResponse.json();
        console.log("✅ Replicate prediction created:", prediction.id);

        // 轮询预测结果
        let predictionResult = prediction;
        const maxAttempts = 60; // 最多等待 60 秒
        let attempts = 0;

        while (
          predictionResult.status !== "succeeded" &&
          predictionResult.status !== "failed" &&
          attempts < maxAttempts
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待 1 秒
          attempts++;

          const statusResponse = await fetch(
            `${REPLICATE_API_URL}/predictions/${prediction.id}`,
            {
              headers: {
                Authorization: `Token ${REPLICATE_API_TOKEN}`,
              },
            }
          );

          if (!statusResponse.ok) {
            throw new Error(`Failed to get prediction status: ${statusResponse.status}`);
          }

          predictionResult = await statusResponse.json();
          console.log(`🔄 Prediction status (attempt ${attempts}):`, predictionResult.status);

          if (predictionResult.status === "succeeded") {
            break;
          }
        }

        if (predictionResult.status !== "succeeded") {
          console.error("❌ SAM3 prediction failed:", predictionResult);
          throw new Error(
            `Prediction failed or timed out: ${predictionResult.status}`
          );
        }

        // 获取结果
        const output = predictionResult.output;
        console.log("✅ SAM3 mask generated successfully, output:", output);

        if (isSingleFrame) {
          // 单帧遮罩预览：mask_only: false，返回带颜色的遮罩层用于可视化确认
          // SAM3 返回的是单帧 MP4，前端需要提取第一帧显示
          return new Response(
            JSON.stringify({
              success: true,
              mask: {
                preview: output, // MP4 URL，前端需要提取第一帧
                maskUrl: output, // MP4 URL
                maskVideoUrl: output, // 完整的 MP4 URL
                predictionId: prediction.id,
                isVideo: true, // 标记这是视频，需要提取第一帧
              },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        } else {
          // 全视频遮罩：mask_only: false，返回带颜色的遮罩视频（ProPainter 可以处理）
          return new Response(
            JSON.stringify({
              success: true,
              mask: {
                preview: output, // 遮罩视频 URL（带颜色）
                maskUrl: output,
                maskVideoUrl: output, // 遮罩视频 URL，用于 ProPainter
                predictionId: prediction.id,
                isVideo: true,
              },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 处理 /api/processing/start-task
    if (path.includes("/start-task")) {
      const body = await request.json();
      const { assetId, action, maskData, textPrompt, videoUrl } = body;

      console.log("🎬 Starting processing task:", {
        assetId,
        action,
        hasMaskData: !!maskData,
        textPrompt,
      });

      // 验证参数
      if (!assetId || !action || !maskData) {
        return new Response(
          JSON.stringify({ error: "Missing required parameters: assetId, action, maskData" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // 只支持 remove 操作（使用 ProPainter）
      if (action !== "remove") {
        return new Response(
          JSON.stringify({ error: `Action "${action}" not supported yet. Only "remove" is supported.` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // 获取视频 URL 和遮罩 URL
      const inputVideoUrl = videoUrl || maskData.videoUrl;
      const maskUrl = maskData.maskVideoUrl || maskData.maskUrl || maskData.preview;

      if (!inputVideoUrl || !maskUrl) {
        return new Response(
          JSON.stringify({ error: "Missing videoUrl or maskUrl in maskData" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      console.log("📤 Calling ProPainter API...", {
        videoUrl: inputVideoUrl,
        maskUrl,
        mockMode: MOCK_PROPAINTER,
      });

      // 构建 ProPainter 输入参数
      // SAM3 已返回遮罩视频（mask_only: false，带颜色），ProPainter 可以处理
      const propainterInput: any = {
        video: inputVideoUrl,
        mask: maskUrl, // 遮罩视频 URL（来自 SAM3，mask_only: false，带颜色）
        mode: "video_inpainting", // 对象删除使用 video_inpainting 模式
        fp16: true, // 使用半精度以降低内存使用和成本
        resize_ratio: 0.5, // 缩放到 50% 以优化处理速度和效果
        subvideo_length: 40, // 子视频长度，优化内存使用和处理效果
        save_fps: 24, // 输出帧率
      };

      let prediction: any;

      // 根据模拟模式选择调用真实 API 或模拟 API
      if (MOCK_PROPAINTER) {
        console.log("🎭 Using MOCK mode for ProPainter (cost-saving mode)");
        prediction = await mockProPainterPrediction(propainterInput);
      } else {
        // 检查 API Token（仅在非模拟模式下需要）
        if (!REPLICATE_API_TOKEN) {
          return new Response(
            JSON.stringify({ error: "REPLICATE_API_TOKEN not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        // 创建预测（真实 API 调用）
        const predictionResponse = await fetch(
          `${REPLICATE_API_URL}/predictions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Token ${REPLICATE_API_TOKEN}`,
            },
            body: JSON.stringify({
              version: PROPAINTER_VERSION,
              input: propainterInput,
            }),
          }
        );

        if (!predictionResponse.ok) {
          const error = await predictionResponse.text();
          console.error("❌ ProPainter API error:", predictionResponse.status, error);
          return new Response(
            JSON.stringify({
              error: `ProPainter API error: ${predictionResponse.status} - ${error}`,
            }),
            {
              status: predictionResponse.status,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        prediction = await predictionResponse.json();
        console.log("✅ ProPainter prediction created:", prediction.id);
      }

      // 获取用户ID并创建任务记录（使用 prediction.id 作为任务ID）
      try {
        const userId = await requireUserId(request);
        const maskUrl = maskData.maskVideoUrl || maskData.maskUrl || maskData.preview;
        
        // 创建任务记录到数据库，使用 prediction.id 作为任务ID
        // 这样可以直接通过 taskId 查找和更新任务
        const { createTask } = await import("~/lib/tasks.repo");
        
        await createTask({
          id: prediction.id, // 使用 prediction.id 作为任务ID
          user_id: userId,
          asset_id: assetId,
          action: action as "remove" | "extract",
          status: "processing",
          progress: 0,
          mask_url: maskUrl,
        });
        console.log("✅ Task created in database:", prediction.id);
      } catch (error: any) {
        // 如果创建任务失败，记录错误但不影响API响应
        // 因为任务ID（prediction.id）仍然可以用于查询状态
        console.warn("⚠️ Failed to create task in database:", error.message);
      }

      // 返回任务 ID（使用 prediction.id 作为任务 ID）
      return new Response(
        JSON.stringify({
          success: true,
          taskId: prediction.id,
          status: prediction.status,
          message: "任务已启动",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Not found", { status: 404 });
  } catch (error: any) {
    console.error("❌ Error in processing API:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Loader 函数（如果需要）
export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 处理 GET /api/processing/task/:taskId
  if (path.includes("/task/")) {
    const taskId = path.split("/task/")[1]?.split("?")[0]; // 提取 taskId，移除查询参数

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: "Task ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("📊 Querying task status:", taskId, { mockMode: MOCK_PROPAINTER });

    let prediction: any;

    // 根据模拟模式选择查询真实 API 或模拟状态
    if (MOCK_PROPAINTER && taskId.startsWith("mock-")) {
      // 模拟模式：从内存中获取状态
      console.log("🎭 [MOCK] Getting prediction status");
      prediction = getMockPredictionStatus(taskId);
      console.log("📊 [MOCK] Prediction status:", prediction.status);
    } else {
      // 真实 API 模式
      // 检查 API Token
      if (!REPLICATE_API_TOKEN) {
        return new Response(
          JSON.stringify({ error: "REPLICATE_API_TOKEN not configured" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      try {
        // 查询预测状态
        const statusResponse = await fetch(
          `${REPLICATE_API_URL}/predictions/${taskId}`,
          {
            headers: {
              Authorization: `Token ${REPLICATE_API_TOKEN}`,
            },
          }
        );

        if (!statusResponse.ok) {
          const error = await statusResponse.text();
          console.error("❌ Failed to get prediction status:", statusResponse.status, error);
          return new Response(
            JSON.stringify({
              error: `Failed to get prediction status: ${statusResponse.status}`,
              status: "error",
            }),
            {
              status: statusResponse.status,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        prediction = await statusResponse.json();
        console.log("📊 Prediction status:", prediction.status);
      } catch (error: any) {
        console.error("❌ Error querying task status:", error);
        return new Response(
          JSON.stringify({
            error: error.message || "Internal server error",
            status: "error",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    try {

      // 根据状态返回相应的响应
      let response: any = {
        taskId,
        status: prediction.status,
        message: "",
        percentage: 0,
      };

      switch (prediction.status) {
        case "starting":
          response.message = "任务正在启动...";
          response.percentage = 5;
          break;
        case "processing":
          response.message = "正在处理视频...";
          response.percentage = 50;
          
          // 更新数据库中的任务进度
          try {
            await updateTask(taskId, {
              status: "processing",
              progress: 50,
            });
          } catch (error: any) {
            // 静默失败，不影响API响应
            console.warn("⚠️ Failed to update task progress:", error.message);
          }
          break;
        case "succeeded":
          // 获取输出结果
          const output = prediction.output;
          if (Array.isArray(output) && output.length > 0) {
            // ProPainter 返回的是 URL 数组
            response.message = "处理完成";
            response.percentage = 100;
            response.outputUrl = output[0]; // 第一个 URL 是处理后的视频
            response.outputUrls = output; // 所有输出 URL
            response.status = "completed";
            
            // 更新数据库中的任务记录
            try {
              await updateTask(taskId, {
                status: "completed",
                progress: 100,
                output_url: output[0],
              });
              console.log("✅ Task updated in database:", taskId);
            } catch (error: any) {
              // 如果更新失败，记录错误但不影响API响应
              console.warn("⚠️ Failed to update task in database:", error.message);
            }
          } else {
            response.message = "处理完成，但未找到输出";
            response.percentage = 100;
            response.status = "completed";
          }
          break;
        case "failed":
          response.message = prediction.error || "处理失败";
          response.percentage = 0;
          response.status = "failed";
          response.error = prediction.error;
          
          // 更新数据库中的任务记录
          try {
            await updateTask(taskId, {
              status: "failed",
              progress: 0,
              error_message: prediction.error || "处理失败",
            });
            console.log("✅ Task marked as failed in database:", taskId);
          } catch (error: any) {
            // 如果更新失败，记录错误但不影响API响应
            console.warn("⚠️ Failed to update task in database:", error.message);
          }
          break;
        case "canceled":
          response.message = "任务已取消";
          response.percentage = 0;
          response.status = "cancelled";
          break;
        default:
          response.message = `状态: ${prediction.status}`;
          response.percentage = 10;
      }

      return new Response(
        JSON.stringify(response),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      console.error("❌ Error processing task status:", error);
      return new Response(
        JSON.stringify({
          error: error.message || "Internal server error",
          status: "error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  return new Response("Not found", { status: 404 });
}
