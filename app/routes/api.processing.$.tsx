import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_API_URL = "https://api.replicate.com/v1";
const NODE_ENV = process.env.NODE_ENV || "development";
const USE_MOCK_SAM3 = process.env.USE_MOCK_SAM3 === "true" || NODE_ENV === "development";

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
      const { textPrompt, videoUrl, frameImage, isSingleFrame = false } = body;

      console.log("🎭 Generating mask with SAM3:", {
        textPrompt,
        videoUrl,
        isSingleFrame,
        hasFrameImage: !!frameImage,
        useMock: USE_MOCK_SAM3,
      });

      // 开发模式下模拟 SAM3 API 调用
      if (USE_MOCK_SAM3) {
        console.log("🔧 Using mock SAM3 API (development mode)");
        
        // 模拟 API 调用延迟（1-2秒）
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        // 生成模拟的 MP4 URL（使用原视频/图片 URL 作为占位符）
        const mockOutputUrl = frameImage || videoUrl || "https://replicate.delivery/mock/mask-output.mp4";
        
        console.log("✅ Mock SAM3 mask generated successfully");
        
        // 返回模拟的成功响应
        if (isSingleFrame) {
          return new Response(
            JSON.stringify({
              success: true,
              mask: {
                preview: mockOutputUrl,
                maskUrl: mockOutputUrl,
                maskVideoUrl: mockOutputUrl,
                predictionId: `mock-${Date.now()}`,
                isVideo: true,
              },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({
              success: true,
              mask: {
                preview: mockOutputUrl,
                maskUrl: mockOutputUrl,
                maskVideoUrl: mockOutputUrl,
                predictionId: `mock-${Date.now()}`,
                isVideo: true,
              },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // 生产模式：实际调用 Replicate API
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
        prompt: textPrompt || "object", // 使用 prompt 而不是 text_prompt
        mask_only: false, // false: 返回遮罩叠加在原视频上（用户体验更好）
        mask_opacity: 0.5, // 遮罩不透明度
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

      const prediction = await predictionResponse.json();
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
        throw new Error(
          `Prediction failed or timed out: ${predictionResult.status}`
        );
      }

      // 获取结果
      const output = predictionResult.output;
      console.log("✅ SAM3 mask generated successfully, output:", output);

      // SAM3 返回的是一个 MP4 视频 URL（即使是单帧也是 MP4）
      // mask_only: false 时，返回的是遮罩叠加在原视频上的视频
      if (isSingleFrame) {
        // 单帧遮罩：SAM3 返回的是单帧 MP4，需要提取第一帧作为预览图片
        // 这里返回 MP4 URL，前端需要提取第一帧显示
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
        // 全视频遮罩：返回视频 URL
        return new Response(
          JSON.stringify({
            success: true,
            mask: {
              preview: output, // 遮罩视频 URL
              maskUrl: output,
              maskVideoUrl: output,
              predictionId: prediction.id,
              isVideo: true,
            },
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 处理 /api/processing/start-task
    if (path.includes("/start-task")) {
      // TODO: 实现任务启动逻辑
      return new Response(
        JSON.stringify({ error: "Not implemented yet" }),
        { status: 501, headers: { "Content-Type": "application/json" } }
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
    const taskId = path.split("/task/")[1];
    // TODO: 实现任务查询逻辑
    return new Response(
      JSON.stringify({ error: "Not implemented yet" }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response("Not found", { status: 404 });
}
