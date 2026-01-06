import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, ChevronLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { callDifyAPI } from "~/lib/dify.api";
import type { DifyOperationResult } from "~/lib/dify.api";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean; // 是否正在加载（显示加载 icon）
}

interface ObjectSelectionChatBoxProps {
  className?: string;
  messages: Message[];
  onMessagesChange: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  currentFrameImageUrl?: string; // 当前选中帧的图片URL
  onOperationResult?: (result: DifyOperationResult) => void; // 当AI返回操作指令时的回调
  onUserConfirm?: () => void; // 用户确认操作的回调
  onUserCancel?: () => void; // 用户取消操作的回调
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  userId: string;
  conversationId?: string;
  onConversationIdChange?: (id: string) => void;
  waitingForConfirmation?: boolean; // 是否等待用户确认
}

export function ObjectSelectionChatBox({
  className = "",
  messages,
  onMessagesChange,
  currentFrameImageUrl,
  onOperationResult,
  onUserConfirm,
  onUserCancel,
  isMinimized = false,
  onToggleMinimize,
  userId,
  conversationId,
  onConversationIdChange,
  waitingForConfirmation = false,
}: ObjectSelectionChatBoxProps) {
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, currentStreamingMessage]);

  // 清理interval
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // 在等待确认状态下，不允许输入（使用按钮代替）
    if (waitingForConfirmation) {
      const hintMessage: Message = {
        id: Date.now().toString(),
        content: "请使用下方的按钮进行确认或重新选择",
        isUser: false,
        timestamp: new Date(),
      };
      onMessagesChange([...messages, hintMessage]);
      setInputValue("");
      return;
    }

    // 如果不在等待确认状态，需要检查是否有当前帧
    if (!waitingForConfirmation && !currentFrameImageUrl) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: "请先在时间轴上选择一帧视频",
        isUser: false,
        timestamp: new Date(),
      };
      onMessagesChange([...messages, errorMessage]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    // 先添加用户消息
    onMessagesChange([...messages, userMessage]);
    setInputValue("");
    setIsTyping(true);
    setCurrentStreamingMessage("");

    // 不创建空的 AI 消息，只使用 typing indicator
    // 当有流式内容时再创建消息
    const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 调用 Dify API（通过服务器代理），支持流式输出
      const result = await callDifyAPI(
        inputValue.trim(),
        userId,
        currentFrameImageUrl,
        conversationId,
        undefined,
        (chunk: string) => {
          // 流式更新消息内容
          // 检查 chunk 是否是 JSON 片段（更严格的检测）
          const trimmedChunk = chunk.trim();
          const isJsonChunk = trimmedChunk.startsWith("{") || 
                             trimmedChunk.startsWith('"') ||
                             trimmedChunk.startsWith("[") ||
                             chunk.includes("is_valid_request") ||
                             chunk.includes("object_exists") ||
                             chunk.includes("text_prompt") ||
                             chunk.includes("action") ||
                             chunk.includes("confidence") ||
                             chunk.includes("clarification_needed") ||
                             chunk.includes("vision_matched") ||
                             (chunk.includes("reasoning") && chunk.includes("assistant_message")) ||
                             (chunk.includes("assistant_message") && trimmedChunk.length < 50); // 短消息且包含 assistant_message 可能是 JSON
          
          if (!isJsonChunk && trimmedChunk.length > 0) {
            console.log("✅ Streaming chunk (non-JSON):", chunk.substring(0, 50));
            setCurrentStreamingMessage((prev) => {
              const newContent = prev + chunk;
              // 当有内容时，创建或更新 AI 消息
              onMessagesChange((prevMessages: Message[]) => {
                const aiMessageExists = prevMessages.some((msg: Message) => msg.id === aiMessageId);
                if (aiMessageExists) {
                  // 更新现有消息
                  return prevMessages.map((msg: Message) =>
                    msg.id === aiMessageId
                      ? { ...msg, content: newContent }
                      : msg
                  );
                } else {
                  // 创建新消息（第一次有内容时）
                  return [...prevMessages, {
                    id: aiMessageId,
                    content: newContent,
                    isUser: false,
                    timestamp: new Date(),
                  }];
                }
              });
              return newContent;
            });
          } else {
            console.log("⏭️ Skipping JSON chunk:", chunk.substring(0, 50));
          }
        }
      );

      // 更新 conversation ID
      if (result.conversationId && onConversationIdChange) {
        onConversationIdChange(result.conversationId);
      }

      // 最终更新 AI 消息内容（使用 assistant_message 或 fullResponse）
      // 检查最终内容是否是 JSON 文本，如果是则使用 reasoning
      // 只有在有操作结果时才显示内容，否则等待 workflow_finished 事件
      let finalContent = "";
      if (result.result) {
        finalContent = result.result.assistant_message || result.fullResponse || "";
        // 如果 assistant_message 为空，使用 reasoning
        if (!finalContent && result.result.reasoning) {
          finalContent = result.result.reasoning;
        }
        // 如果仍然为空，根据 object_exists 构造消息
        if (!finalContent) {
          finalContent = result.result.object_exists === false 
            ? "抱歉，我在当前帧中没有检测到您描述的对象。" 
            : "我理解您的需求，正在处理...";
        }
      } else {
        // 如果没有操作结果，显示等待消息
        finalContent = "正在分析图片，请稍候...";
      }
      
      // 检查 finalContent 是否包含 JSON 字段（避免显示 JSON 文本）
      if (finalContent && typeof finalContent === "string") {
        const hasJsonFields = finalContent.includes("is_valid_request") ||
                             finalContent.includes("object_exists") ||
                             finalContent.includes("text_prompt") ||
                             finalContent.includes("action") ||
                             finalContent.includes("confidence");
        
        if (hasJsonFields && result.result?.reasoning) {
          // 如果包含 JSON 字段，使用 reasoning 或构造友好消息
          finalContent = result.result.reasoning || 
                        (result.result.object_exists === false 
                          ? "抱歉，我在当前帧中没有检测到您描述的对象。" 
                          : "我理解您的需求，正在处理...");
        } else if (hasJsonFields) {
          // 如果没有 reasoning，构造友好消息
          finalContent = result.result?.object_exists === false 
            ? "抱歉，我在当前帧中没有检测到您描述的对象。" 
            : "我理解您的需求，正在处理...";
        }
      }
      
      // 如果没有流式内容，模拟流式显示最终内容
      if (!currentStreamingMessage && finalContent) {
        // 清理之前的interval
        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
        }
        
        // 模拟流式显示：逐字符显示
        let displayedLength = 0;
        streamIntervalRef.current = setInterval(() => {
          displayedLength += 2; // 每次显示2个字符，加快速度
          if (displayedLength >= finalContent.length) {
            displayedLength = finalContent.length;
            if (streamIntervalRef.current) {
              clearInterval(streamIntervalRef.current);
              streamIntervalRef.current = null;
            }
          }
          
          const partialContent = finalContent.substring(0, displayedLength);
          setCurrentStreamingMessage(partialContent);
          
          // 更新消息列表
          onMessagesChange((prevMessages: Message[]) => {
            const aiMessageExists = prevMessages.some((msg: Message) => msg.id === aiMessageId);
            if (aiMessageExists) {
              return prevMessages.map((msg: Message) =>
                msg.id === aiMessageId
                  ? { ...msg, content: partialContent }
                  : msg
              );
            } else {
              // 如果消息不存在，创建新消息
              return [...prevMessages, {
                id: aiMessageId,
                content: partialContent,
                isUser: false,
                timestamp: new Date(),
              }];
            }
          });
          
          // 如果显示完成，停止流式显示
          if (displayedLength >= finalContent.length) {
            setCurrentStreamingMessage(finalContent);
            setIsTyping(false);
          }
        }, 30); // 每30ms显示一次，模拟流式效果
        
        // 如果流式内容存在且与最终内容不同，使用最终内容（更完整）
      } else if (currentStreamingMessage && finalContent !== currentStreamingMessage) {
        // 检查流式内容是否已经是有效的文本（不包含 JSON 字段）
        const streamingHasJson = currentStreamingMessage.includes("is_valid_request") ||
                                 currentStreamingMessage.includes("object_exists");
        
        if (!streamingHasJson && currentStreamingMessage.trim().length > 0) {
          // 流式内容已经是有效文本，使用流式内容
          // 不更新，保持流式内容
        } else {
          // 流式内容是 JSON 或为空，使用最终内容（也模拟流式显示）
          // 清理之前的interval
          if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current);
          }
          
          let displayedLength = 0;
          streamIntervalRef.current = setInterval(() => {
            displayedLength += 2;
            if (displayedLength >= finalContent.length) {
              displayedLength = finalContent.length;
              if (streamIntervalRef.current) {
                clearInterval(streamIntervalRef.current);
                streamIntervalRef.current = null;
              }
            }
            
            const partialContent = finalContent.substring(0, displayedLength);
            setCurrentStreamingMessage(partialContent);
            
            onMessagesChange((prevMessages: Message[]) => {
              const aiMessageExists = prevMessages.some((msg: Message) => msg.id === aiMessageId);
              if (aiMessageExists) {
                return prevMessages.map((msg: Message) =>
                  msg.id === aiMessageId
                    ? { ...msg, content: partialContent }
                    : msg
                );
              } else {
                return [...prevMessages, {
                  id: aiMessageId,
                  content: partialContent,
                  isUser: false,
                  timestamp: new Date(),
                }];
              }
            });
            
            if (displayedLength >= finalContent.length) {
              setCurrentStreamingMessage(finalContent);
              setIsTyping(false);
            }
          }, 30);
        }
      }

      // 如果有操作结果，延迟通知父组件，让流式消息先完成显示
      // 注意：即使 object_exists: false 或 clarification_needed: true，也要通知父组件，让父组件决定如何处理
      if (result.result && onOperationResult) {
        // 先确保流式消息已保存到消息列表中
        const finalStreamingContent = currentStreamingMessage;
        if (finalStreamingContent) {
          // 如果有流式内容，先更新消息列表，然后延迟通知父组件
          onMessagesChange((prevMessages: Message[]) => {
            const aiMessageExists = prevMessages.some((msg: Message) => msg.id === aiMessageId);
            if (aiMessageExists) {
              return prevMessages.map((msg: Message) =>
                msg.id === aiMessageId
                  ? { ...msg, content: finalStreamingContent }
                  : msg
              );
            } else {
              return [...prevMessages, {
                id: aiMessageId,
                content: finalStreamingContent,
                isUser: false,
                timestamp: new Date(),
              }];
            }
          });
          
          // 等待一小段时间让流式消息完成显示
          setTimeout(() => {
            setIsTyping(false);
            setCurrentStreamingMessage("");
            // 通知父组件处理操作结果
            onOperationResult(result.result!);
          }, 800); // 延迟 800ms，确保流式消息已显示
        } else {
          // 如果没有流式内容，立即处理
          setIsTyping(false);
          setCurrentStreamingMessage("");
          // 通知父组件处理操作结果
          onOperationResult(result.result);
        }
      } else {
        // 如果没有操作结果，立即停止 typing
        setIsTyping(false);
        setCurrentStreamingMessage("");
      }
    } catch (error) {
      console.error("Error calling Dify API:", error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
        isUser: false,
        timestamp: new Date(),
      };
      onMessagesChange((prevMessages: Message[]) => {
        // 移除空的 AI 消息，添加错误消息
        return prevMessages.filter((msg: Message) => msg.id !== aiMessageId).concat(errorMessage);
      });
      setIsTyping(false);
      setCurrentStreamingMessage("");
    }
    // 注意：finally 中不再自动停止 typing，让父组件控制
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isMinimized) {
    return (
      <div className={cn("w-12 border-l bg-background flex-shrink-0 flex items-center justify-center", className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleMinimize}
          className="h-full w-full"
          title="显示AI助手"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 border-l bg-background flex-shrink-0 flex flex-col", className)}>
      {/* Header */}
      <div className="h-12 border-b flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">AI agent</h3>
        </div>
        {onToggleMinimize && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMinimize}
            className="h-6 w-6 p-0"
            title="最小化"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>请描述您想要删除或提取的对象</p>
            <p className="text-xs mt-2">例如："删除这个讨厌的老鼠"</p>
          </div>
        )}

        {waitingForConfirmation && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-primary mb-2">遮罩预览已生成</p>
            <p className="text-xs text-muted-foreground mb-3">
              请选择操作：
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (onUserConfirm) {
                    console.log("✅ User confirmed via button, calling onUserConfirm");
                    onUserConfirm();
                  }
                }}
                size="sm"
                className="flex-1"
              >
                确认
              </Button>
              <Button
                onClick={() => {
                  if (onUserCancel) {
                    console.log("❌ User cancelled via button, calling onUserCancel");
                    onUserCancel();
                  }
                }}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                重选
              </Button>
            </div>
          </div>
        )}

        {messages
          .filter((message) => message.content.trim().length > 0 || message.isLoading) // 过滤掉空内容且不在加载的消息
          .map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.isUser ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "rounded-lg px-3 py-2 max-w-[80%]",
                message.isUser
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <div className="flex items-center gap-2">
                {message.content.trim().length > 0 && (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                {message.isLoading && (
                  <div className="flex-shrink-0">
                    <div className={cn(
                      "w-4 h-4 border-2 border-t-transparent rounded-full animate-spin",
                      message.isUser ? "border-primary-foreground" : "border-primary"
                    )} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {isTyping && currentStreamingMessage && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 max-w-[80%] bg-muted">
              <p className="text-sm whitespace-pre-wrap">{currentStreamingMessage}</p>
              <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isTyping && !currentStreamingMessage && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-muted">
              <div className="flex gap-1.5 items-center justify-center">
                <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDuration: "0.6s" }} />
                <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: "0.2s", animationDuration: "0.6s" }} />
                <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: "0.4s", animationDuration: "0.6s" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input - 在等待确认时隐藏 */}
      {!waitingForConfirmation && (
        <div className="border-t p-4 flex-shrink-0">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述要删除或提取的对象..."
              className="flex-1 min-h-[36px] max-h-[120px] px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={1}
              disabled={isTyping}
              autoFocus={false}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping || !currentFrameImageUrl}
              size="sm"
              className="flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {!currentFrameImageUrl && (
            <p className="text-xs text-muted-foreground mt-2">
              请在时间轴上选择一帧视频
            </p>
          )}
        </div>
      )}
    </div>
  );
}

