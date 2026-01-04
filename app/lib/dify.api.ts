/**
 * Dify API 集成服务
 * 用于与 Dify AI 平台进行对话和文件上传
 * 
 * 注意：客户端代码不应该直接访问 Dify API，应该通过服务器端代理
 * 服务器端代码在 app/routes/api.dify.chat.tsx 中
 */

export interface DifyFileUploadResponse {
  id: string;
  name: string;
  size: number;
  extension: string;
  mime_type: string;
  created_by: string;
  created_at: number;
}

export interface DifyMessageEvent {
  event: string;
  task_id?: string;
  message_id?: string;
  conversation_id?: string;
  answer?: string;
  created_at?: number;
  metadata?: {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    retriever_resources?: Array<{
      id: string;
      content: string;
      source: string;
    }>;
  };
  data?: {
    id?: string;
    workflow_id?: string;
    status?: string;
    outputs?: {
      is_valid_request?: boolean;
      object_exists?: boolean;
      text_prompt?: string;
      action?: "remove" | "extract";
      confidence?: number;
      clarification_needed?: boolean;
      vision_matched?: boolean;
      reasoning?: string;
      assistant_message?: string;
    };
    error?: string;
    elapsed_time?: number;
  };
}

export interface DifyOperationResult {
  is_valid_request: boolean;
  object_exists: boolean;
  text_prompt: string;
  action: "remove" | "extract";
  confidence: number;
  clarification_needed: boolean;
  vision_matched: boolean;
  reasoning: string;
  assistant_message: string;
}

/**
 * 上传文件到 Dify（已废弃，使用服务器端代理）
 * 客户端不应该直接调用此函数，应该通过 /api/dify/upload 代理
 */
export async function uploadFileToDify(
  file: File,
  userId: string
): Promise<DifyFileUploadResponse> {
  // 客户端不应该直接调用，应该通过服务器端代理
  throw new Error("uploadFileToDify is deprecated. Use server proxy /api/dify/upload instead.");
}

/**
 * 发送消息到 Dify（流式响应，已废弃，使用 callDifyAPI）
 * 客户端不应该直接调用此函数，应该使用 callDifyAPI
 */
export async function sendMessageToDify(
  query: string,
  userId: string,
  frameImageFileId?: string,
  conversationId?: string,
  appId?: string,
  onMessage?: (event: DifyMessageEvent) => void
): Promise<{
  conversationId: string;
  result?: DifyOperationResult;
  fullResponse: string;
}> {
  // 客户端不应该直接调用，应该使用 callDifyAPI
  throw new Error("sendMessageToDify is deprecated. Use callDifyAPI instead.");
}

/**
 * 服务器端调用 Dify API（用于后端路由）
 */
export async function callDifyAPI(
  query: string,
  userId: string,
  frameImageUrl?: string,
  conversationId?: string,
  appId?: string,
  onStream?: (chunk: string) => void
): Promise<{
  conversationId: string;
  result?: DifyOperationResult;
  fullResponse: string;
}> {
  // 在服务器端，我们需要通过代理调用 Dify API
  // 因为 Dify API Key 不应该暴露给客户端
  const response = await fetch("/api/dify/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream", // 请求流式响应
    },
    body: JSON.stringify({
      query,
      userId,
      frameImageUrl,
      conversationId,
      appId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dify API error: ${response.status} - ${error}`);
  }

  // 处理流式响应
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";
  let conversationIdResult = "";
  let result: DifyOperationResult | undefined;

  if (!reader) {
    throw new Error("Failed to get response reader");
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n\n");

    for (const line of lines) {
      if (!line.trim() || !line.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(line.slice(6));
        
        if (data.conversation_id) {
          conversationIdResult = data.conversation_id;
        }

        // 处理 message 事件 - 完全忽略，因为 Dify 的 message 事件包含的是 JSON 片段
        // 真正的文本消息在 workflow_finished 事件的 outputs.assistant_message 中
        if (data.event === "message" && data.answer) {
          // 完全跳过 message 事件，不进行流式输出
          // 这样可以避免显示 JSON 片段
          continue;
        }

        // 处理 workflow_finished 事件
        if (data.event === "workflow_finished" && data.data?.outputs) {
          const outputs = data.data.outputs;
          let parsedOutputs = outputs;
          
          // 检查 outputs.answer 是否存在
          if (outputs.answer && typeof outputs.answer === "string") {
            try {
              parsedOutputs = JSON.parse(outputs.answer);
            } catch (e) {
              // 解析失败，使用原始 outputs
            }
          }
          
          result = {
            is_valid_request: parsedOutputs.is_valid_request ?? false,
            object_exists: parsedOutputs.object_exists ?? false,
            text_prompt: parsedOutputs.text_prompt || "object",
            action: parsedOutputs.action || "remove",
            confidence: parsedOutputs.confidence ?? 0,
            clarification_needed: parsedOutputs.clarification_needed ?? false,
            vision_matched: parsedOutputs.vision_matched ?? false,
            reasoning: parsedOutputs.reasoning || "",
            assistant_message: parsedOutputs.assistant_message || fullResponse || "处理完成",
          };
        }
      } catch (e) {
        // 忽略 JSON 解析错误
        continue;
      }
    }
  }

  return {
    conversationId: conversationIdResult,
    result,
    fullResponse,
  };
}

