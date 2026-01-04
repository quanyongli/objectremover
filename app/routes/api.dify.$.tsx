/**
 * Dify API 代理路由
 * 在服务器端调用 Dify API，避免暴露 API Key
 */

import { type ActionFunctionArgs } from "react-router";

const DIFY_BASE_URL = process.env.DIFY_API_URL || process.env.DIFY_BASE_URL || "https://api.dify.ai/v1";
const DIFY_API_KEY = process.env.DIFY_API_KEY || "";

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    // 检查路径，只处理 /api/dify/chat
    const url = new URL(request.url);
    if (!url.pathname.endsWith("/chat")) {
      return new Response(
        JSON.stringify({ error: "Not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const { query, userId, frameImageUrl, conversationId, appId } = body;

    // 更详细的参数验证和错误信息
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'query' parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'userId' parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 构建请求体
    const requestBody: any = {
      query,
      response_mode: "streaming",
      user: userId,
    };

    if (conversationId) {
      requestBody.conversation_id = conversationId;
    }

    if (appId) {
      requestBody.app_id = appId;
    }

    // 如果有图片URL，需要先上传到 Dify
    if (frameImageUrl) {
      // 检测是否是 base64 数据 URL
      const isBase64 = frameImageUrl.startsWith("data:image/");
      
      if (isBase64) {
        console.log("📤 Uploading base64 image to Dify (length:", frameImageUrl.length, "chars)");
      } else {
        console.log("📤 Uploading frame image to Dify:", frameImageUrl);
      }
      
      let imageBlob: Blob;
      
      if (isBase64) {
        // 处理 base64 数据 URL
        try {
          const base64Data = frameImageUrl.split(",")[1]; // 移除 data:image/jpeg;base64, 前缀
          if (!base64Data) {
            throw new Error("Invalid base64 data URL format");
          }
          
          const mimeMatch = frameImageUrl.match(/data:image\/([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : "jpeg";
          
          // 在 Node.js 环境中，使用 Buffer 处理 base64
          // 需要导入 Buffer（Node.js 全局可用，但 TypeScript 需要类型）
          const buffer = typeof Buffer !== "undefined" 
            ? Buffer.from(base64Data, "base64")
            : Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          imageBlob = new Blob([buffer], { type: `image/${mimeType}` });
        } catch (error) {
          console.error("❌ Failed to parse base64 image:", error);
          throw new Error(`Failed to parse base64 image: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      } else {
        // 从 URL 下载图片
        const imageResponse = await fetch(frameImageUrl);
        if (!imageResponse.ok) {
          const errorText = await imageResponse.text().catch(() => "");
          console.error("❌ Failed to fetch frame image:", imageResponse.status, errorText);
          throw new Error(`Failed to fetch frame image: ${imageResponse.status} - ${errorText}`);
        }
        imageBlob = await imageResponse.blob();
      }
      
      console.log("✅ Frame image prepared, size:", imageBlob.size, "type:", imageBlob.type);
      
      const formData = new FormData();
      formData.append("file", imageBlob, "frame.jpg");
      formData.append("user", userId);

      console.log("📤 Uploading to Dify:", `${DIFY_BASE_URL}/files/upload`);
      const uploadResponse = await fetch(`${DIFY_BASE_URL}/files/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DIFY_API_KEY}`,
          // 不要设置 Content-Type，让浏览器自动设置 multipart/form-data 边界
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => "");
        console.error("❌ Failed to upload frame image:", uploadResponse.status, errorText);
        throw new Error(`Failed to upload frame image: ${uploadResponse.status} - ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log("✅ Frame image uploaded, file ID:", uploadResult.id, "result:", JSON.stringify(uploadResult, null, 2));
      
      // 验证上传结果
      if (!uploadResult.id) {
        throw new Error("Upload result missing file ID");
      }
      
      // 根据 Dify API 文档，inputs 中需要 user_message 和 frame_image
      requestBody.inputs = {
        user_message: query,
        frame_image: {
          type: "image",
          transfer_method: "local_file",
          upload_file_id: uploadResult.id,
        },
      };
    } else {
      // 没有图片时，只需要 user_message
      requestBody.inputs = {
        user_message: query,
      };
    }
    
    // 验证 requestBody 结构
    if (!requestBody.inputs) {
      throw new Error("requestBody.inputs is missing");
    }
    if (!requestBody.inputs.user_message) {
      throw new Error("requestBody.inputs.user_message is missing");
    }
    if (frameImageUrl && !requestBody.inputs.frame_image) {
      throw new Error("requestBody.inputs.frame_image is missing when frameImageUrl is provided");
    }
    
    // 创建安全的日志对象（避免打印完整的 base64 字符串）
    const logRequestBody = {
      ...requestBody,
      inputs: {
        ...requestBody.inputs,
        // 如果有 frame_image，只显示关键信息
        frame_image: requestBody.inputs.frame_image ? {
          type: requestBody.inputs.frame_image.type,
          transfer_method: requestBody.inputs.frame_image.transfer_method,
          upload_file_id: requestBody.inputs.frame_image.upload_file_id,
        } : undefined,
      },
    };
    
    console.log("📤 Sending message to Dify:", JSON.stringify(logRequestBody, null, 2));

    // 调用 Dify API
    console.log("📤 Calling Dify chat-messages API:", `${DIFY_BASE_URL}/chat-messages`);
    const difyResponse = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DIFY_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!difyResponse.ok) {
      const error = await difyResponse.text().catch(() => "Unknown error");
      console.error("❌ Dify API error:", difyResponse.status, error);
      return new Response(
        JSON.stringify({ 
          error: `Dify API error: ${difyResponse.status} - ${error}`,
          details: {
            status: difyResponse.status,
            requestBody: requestBody,
          }
        }),
        { status: difyResponse.status, headers: { "Content-Type": "application/json" } }
      );
    }
    
    console.log("✅ Dify API response received, processing stream...");

    // 检查客户端是否支持流式响应
    const acceptHeader = request.headers.get("accept");
    const wantsStream = acceptHeader?.includes("text/event-stream");

    if (wantsStream) {
      // 直接转发 Dify 的流式响应
      return new Response(difyResponse.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // 处理流式响应（非流式模式）
    const reader = difyResponse.body?.getReader();
    const decoder = new TextDecoder();
    let conversationIdResult = "";
    let fullResponse = "";
    let result: any;

    if (!reader) {
      return new Response(
        JSON.stringify({ error: "Failed to get response reader" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        try {
          const data = JSON.parse(line.slice(6));

          if (data.conversation_id && !conversationIdResult) {
            conversationIdResult = data.conversation_id;
          }

          if (data.event === "message" && data.answer) {
            // 完全忽略 message 事件中的 answer
            // 因为 Dify 返回的 message 事件包含的是整个 JSON 对象的字符片段
            // 真正的文本消息在 workflow_finished 事件的 outputs.assistant_message 中
            console.log("⏭️ Skipping message event (contains JSON fragments):", data.answer.substring(0, 30) + "...");
            // 不累积到 fullResponse
          }

          if (data.event === "workflow_finished" && data.data?.outputs) {
            const outputs = data.data.outputs;
            
            // 添加完整的 outputs 日志
            console.log("🔍 Full outputs:", JSON.stringify(outputs, null, 2));
            
            // 检查 outputs.answer 是否存在（Dify 可能将 JSON 数据放在 answer 字段中）
            let parsedOutputs = outputs;
            if (outputs.answer && typeof outputs.answer === "string") {
              try {
                // 尝试解析 answer 字段中的 JSON 字符串
                parsedOutputs = JSON.parse(outputs.answer);
                console.log("✅ Parsed outputs.answer:", JSON.stringify(parsedOutputs, null, 2));
              } catch (e) {
                console.warn("⚠️ Failed to parse outputs.answer:", e);
                // 如果解析失败，继续使用原始的 outputs
              }
            }
            
            // 处理 assistant_message
            // 根据日志，assistant_message 可能包含整个 JSON 对象的文本表示
            // 需要正确提取实际的文本消息
            let assistantMessage = parsedOutputs.assistant_message || "处理完成";
            
            console.log("🔍 Raw assistant_message type:", typeof assistantMessage, "length:", assistantMessage?.length);
            console.log("🔍 Raw assistant_message preview:", assistantMessage?.substring(0, 200));
            
            // 检查 assistant_message 是否包含 JSON 对象的文本表示
            // 例如：" is_valid_request true,\n object_exists false,..."
            if (typeof assistantMessage === "string") {
              const trimmed = assistantMessage.trim();
              
              // 检查是否是 JSON 对象的文本表示（包含 is_valid_request, object_exists 等字段）
              // 更严格的检测：检查是否包含多个 JSON 字段
              const jsonFieldCount = [
                "is_valid_request",
                "object_exists",
                "text_prompt",
                "action",
                "confidence",
                "clarification_needed",
                "vision_matched",
                "reasoning",
                "assistant_message"
              ].filter(field => trimmed.includes(field)).length;
              
              const isJsonTextRepresentation = jsonFieldCount >= 3 || // 包含3个或更多JSON字段
                                                (trimmed.includes("is_valid_request") && trimmed.includes("object_exists")) ||
                                                (trimmed.includes("text_prompt") && trimmed.includes("action"));
              
              if (isJsonTextRepresentation) {
                // 这是 JSON 对象的文本表示，尝试提取真正的 assistant_message
                // 从文本中提取 assistant_message 字段的值
                const assistantMessageMatch = trimmed.match(/assistant_message["\s:]*([^,}"]+)/);
                if (assistantMessageMatch && assistantMessageMatch[1]) {
                  // 提取 assistant_message 的值
                  let extractedMsg = assistantMessageMatch[1].trim();
                  // 移除可能的引号
                  extractedMsg = extractedMsg.replace(/^["']|["']$/g, '');
                  // 检查提取的消息是否是有效的文本（不是 JSON）
                  if (extractedMsg && !extractedMsg.includes("is_valid_request") && !extractedMsg.includes("object_exists")) {
                    assistantMessage = extractedMsg;
                    console.log("✅ Extracted assistant_message from JSON text representation");
                  } else {
                    // 提取失败，使用 reasoning
                    assistantMessage = parsedOutputs.reasoning || 
                                      (parsedOutputs.object_exists === false 
                                        ? "抱歉，我在当前帧中没有检测到您描述的对象。" 
                                        : "我理解您的需求，正在处理...");
                    console.log("✅ Using reasoning as assistant_message (extraction failed)");
                  }
                } else {
                  // 无法提取，使用 reasoning 或构造友好消息
                  if (parsedOutputs.reasoning) {
                    assistantMessage = parsedOutputs.reasoning;
                    console.log("✅ Using reasoning as assistant_message (no match found)");
                  } else {
                    // 根据 object_exists 构造友好消息
                    if (parsedOutputs.object_exists === false) {
                      assistantMessage = "抱歉，我在当前帧中没有检测到您描述的对象。";
                    } else {
                      assistantMessage = "我理解您的需求，正在处理...";
                    }
                    console.log("✅ Constructed message from outputs (assistant_message is JSON text)");
                  }
                }
              } else if (trimmed.startsWith("{")) {
                // 如果是有效的 JSON 字符串，尝试解析
                try {
                  const parsed = JSON.parse(assistantMessage);
                  console.log("🔍 Parsed JSON keys:", Object.keys(parsed));
                  
                  // 如果解析后的对象有 assistant_message 字段（嵌套的情况）
                  if (typeof parsed === "object" && parsed.assistant_message && typeof parsed.assistant_message === "string") {
                    const nestedMsg = parsed.assistant_message.trim();
                    // 检查嵌套的消息是否是有效的文本（不是 JSON）
                    if (!nestedMsg.startsWith("{") && !nestedMsg.includes("is_valid_request")) {
                      assistantMessage = nestedMsg;
                      console.log("✅ Extracted nested assistant_message from JSON");
                    } else {
                      // 嵌套的消息也是 JSON，使用 reasoning
                      assistantMessage = parsedOutputs.reasoning || 
                                        (parsedOutputs.object_exists === false 
                                          ? "抱歉，我在当前帧中没有检测到您描述的对象。" 
                                          : "处理完成");
                      console.log("⚠️ Nested assistant_message is also JSON, using reasoning");
                    }
                  } else if (typeof parsed === "object" && parsed.is_valid_request !== undefined) {
                    // 这是整个 outputs 对象，使用 reasoning
                    assistantMessage = parsedOutputs.reasoning || 
                                      (parsedOutputs.object_exists === false 
                                        ? "抱歉，我在当前帧中没有检测到您描述的对象。" 
                                        : "处理完成");
                    console.log("⚠️ assistant_message is entire outputs JSON, using reasoning");
                  }
                } catch (e) {
                  console.warn("⚠️ assistant_message looks like JSON but failed to parse:", e);
                  // 解析失败，使用 reasoning
                  assistantMessage = parsedOutputs.reasoning || 
                                    (parsedOutputs.object_exists === false 
                                      ? "抱歉，我在当前帧中没有检测到您描述的对象。" 
                                      : "处理完成");
                }
              }
            }
            
            // 最终检查：如果 assistant_message 仍然包含 JSON 字段名，使用 reasoning
            if (typeof assistantMessage === "string" && 
                (assistantMessage.includes("is_valid_request") || 
                 assistantMessage.includes("object_exists") ||
                 assistantMessage.includes("text_prompt"))) {
              if (parsedOutputs.reasoning) {
                assistantMessage = parsedOutputs.reasoning;
                console.log("✅ Final fallback: Using reasoning (assistant_message contains JSON fields)");
              } else {
                assistantMessage = parsedOutputs.object_exists === false 
                  ? "抱歉，我在当前帧中没有检测到您描述的对象。" 
                  : "处理完成";
                console.log("✅ Final fallback: Constructed message (assistant_message contains JSON fields)");
              }
            }
            
            console.log("✅ Final assistant_message:", assistantMessage.substring(0, 100) + (assistantMessage.length > 100 ? "..." : ""));
            
            // 使用 parsedOutputs 而不是 outputs
            result = {
              is_valid_request: parsedOutputs.is_valid_request ?? false,
              object_exists: parsedOutputs.object_exists ?? false,
              text_prompt: parsedOutputs.text_prompt || "object",
              action: parsedOutputs.action || "remove",
              confidence: parsedOutputs.confidence ?? 0,
              clarification_needed: parsedOutputs.clarification_needed ?? false,
              vision_matched: parsedOutputs.vision_matched ?? false,
              reasoning: parsedOutputs.reasoning || "",
              assistant_message: assistantMessage,
            };
            console.log("✅ Workflow finished, result:", {
              is_valid_request: result.is_valid_request,
              object_exists: result.object_exists,
              text_prompt: result.text_prompt,
              action: result.action,
              confidence: result.confidence,
              clarification_needed: result.clarification_needed,
              vision_matched: result.vision_matched,
              reasoning: result.reasoning?.substring(0, 100) + (result.reasoning?.length > 100 ? "..." : ""),
              assistant_message: result.assistant_message.substring(0, 100) + (result.assistant_message.length > 100 ? "..." : ""),
            });
          }
          
          // 处理 message_end 事件（可能包含完整的消息）
          if (data.event === "message_end" && data.answer) {
            fullResponse = data.answer; // 使用完整的消息
            console.log("📨 Message end, full response length:", fullResponse.length);
          }

          if (data.event === "error") {
            return new Response(
              JSON.stringify({ error: data.message || "Dify API error" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
        } catch (error) {
          // 忽略 JSON 解析错误
          if (error instanceof SyntaxError) {
            continue;
          }
          throw error;
        }
      }
    }

    return new Response(
      JSON.stringify({
        conversationId: conversationIdResult,
        result,
        fullResponse,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Dify API proxy error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

