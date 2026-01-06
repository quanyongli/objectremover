import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLoaderData } from "react-router";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Undo2, Redo2, Save, Download } from "lucide-react";
import { VideoControls } from "~/components/object-selection/VideoControls";
import { toast } from "sonner";
import { ActionPanel } from "~/components/object-selection/ActionPanel";
import { FrameTimeline } from "~/components/object-selection/FrameTimeline";
import { MaskOverlay } from "~/components/object-selection/MaskOverlay";
import { PIXELS_PER_SECOND } from "~/components/timeline/types";
import { useObjectSelection, type ClickPoint, type MaskData } from "~/hooks/useObjectSelection";
import { ObjectSelectionChatBox } from "~/components/object-selection/ObjectSelectionChatBox";
import type { DifyOperationResult } from "~/lib/dify.api";
// Project save/load is handled via API
import type { TimelineState } from "~/components/timeline/types";

interface Asset {
  id: string;
  name: string;
  mediaUrlRemote: string;
  fullUrl?: string; // 完整URL，用于后端API调用
  width: number;
  height: number;
  durationInSeconds: number;
  size: number;
}

// Types are now imported from useObjectSelection hook

interface TaskProgress {
  percentage: number;
  status: string;
  taskId?: string;
  outputUrl?: string;
  outputUrls?: string[];
}

export async function loader({ request, params }: { request: Request; params: { assetId: string } }) {
  try {
    // Import auth only in server-side loader
    const { auth } = await import("~/lib/auth.server");
    const session = await auth.api?.getSession?.({ headers: request.headers });
    const uid: string | undefined = session?.user?.id || session?.session?.userId;
    if (!uid) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
    }

    // 获取资产信息
    const assetId = params.assetId;
    if (!assetId) {
      console.error("❌ Asset ID missing in params");
      return new Response(null, {
        status: 302,
        headers: { Location: "/dashboard" },
      });
    }

    try {
      console.log(`📥 Loading asset: ${assetId}, user: ${uid}`);
      
      // 直接使用数据库查询，避免服务端 fetch 的代理问题
      const { getAssetById } = await import("~/lib/assets.repo");
      
      // 添加重试机制，因为数据库可能有轻微延迟
      let assetRecord = null;
      let retries = 3;
      while (!assetRecord && retries > 0) {
        assetRecord = await getAssetById(assetId);
        if (!assetRecord && retries > 1) {
          console.log(`⏳ Asset not found, retrying... (${retries - 1} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 500)); // 等待500ms
        }
        retries--;
      }
      
      if (!assetRecord) {
        console.error(`❌ Asset not found after retries: ${assetId}`);
        return new Response(null, {
          status: 302,
          headers: { Location: "/dashboard" },
        });
      }

      console.log(`✅ Asset found: ${assetRecord.id}, owner: ${assetRecord.user_id}, current user: ${uid}`);

      // 验证资产所有权
      if (assetRecord.user_id !== uid) {
        console.error(`❌ Asset access denied: ${assetId}, owner: ${assetRecord.user_id}, current user: ${uid}`);
        return new Response(null, {
          status: 302,
          headers: { Location: "/dashboard" },
        });
      }

      // 转换为前端需要的格式
      // 在服务器端 loader 中，我们需要使用环境变量或默认值
      const backendUrl = typeof process !== "undefined" 
        ? (process.env.BACKEND_PUBLIC_URL || process.env.VITE_BACKEND_PUBLIC_URL || "http://localhost:8000")
        : "http://localhost:8000";
      const asset = {
        id: assetRecord.id,
        name: assetRecord.original_name,
        mediaUrlRemote: `/api/assets/${assetRecord.id}/raw`,
        fullUrl: `${backendUrl}/media/${encodeURIComponent(assetRecord.storage_key)}`,
        width: assetRecord.width || 0,
        height: assetRecord.height || 0,
        durationInSeconds: assetRecord.duration_seconds || 0,
        size: assetRecord.size_bytes || 0,
      };

      console.log(`✅ Asset loaded:`, asset.id);
      
      return { asset, userId: uid };
    } catch (error) {
      console.error("❌ Failed to load asset:", error);
      return new Response(null, {
        status: 302,
        headers: { Location: "/dashboard" },
      });
    }
  } catch {
    return new Response(null, { status: 302, headers: { Location: "/dashboard" } });
  }
}

export default function ObjectSelectionPage() {
  const params = useParams();
  const navigate = useNavigate();
  const assetId = params.assetId!;
  
  // 使用 useLoaderData 获取数据
  // 如果 loader 返回了重定向 Response，React Router 会自动处理重定向，组件不会被渲染
  // 所以这里可以安全地假设数据存在
  const data = useLoaderData() as { asset: Asset; userId: string };
  const asset = data.asset;
  const loaderUserId = data.userId;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [keyFrames, setKeyFrames] = useState<Array<{ index: number; timestamp: number; url: string }>>([]);
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
  const taskFinishedRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pixelsPerSecond, setPixelsPerSecond] = useState(PIXELS_PER_SECOND);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; content: string; isUser: boolean; timestamp: Date; isLoading?: boolean }>>([]);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [difyConversationId, setDifyConversationId] = useState<string | undefined>(undefined);
  // 使用 loader 返回的 userId，如果没有则使用空字符串（不应该发生，因为 loader 会重定向）
  const userId = loaderUserId || "";
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  const [pendingOperationResult, setPendingOperationResult] = useState<DifyOperationResult | null>(null);

  // Use object selection hook with undo/redo
  const {
    state: selectionState,
    addClickPoint,
    removeClickPoint,
    setMaskData,
    setSelectedFrameIndex,
    setPendingAction,
    clearSelection,
    undo,
    redo,
    canUndo,
    canRedo,
    snapshotState,
  } = useObjectSelection();

  // Alias for easier access
  const selectedFrameIndex = selectionState.selectedFrameIndex;
  const selectedObject = selectionState.selectedObject;
  const maskData = selectionState.maskData;
  const pendingAction = selectionState.pendingAction;

  // 提取关键帧（每2秒一帧）
  const extractKeyFrames = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsExtractingFrames(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsExtractingFrames(false);
      return;
    }

    const frames: Array<{ index: number; timestamp: number; url: string }> = [];
    const frameInterval = 0.2; // 每0.2秒一帧（每秒5张，更密集的缩略图）
    
    // 等待视频元数据加载
    if (isNaN(video.duration) || video.duration === 0) {
      await new Promise((resolve) => {
        const onLoadedMetadata = () => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          resolve(null);
        };
        video.addEventListener("loadedmetadata", onLoadedMetadata);
      });
    }

    // 计算总帧数：确保覆盖整个视频时长
    // 例如：5秒视频 = 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0 (11帧)
    const totalFrames = Math.floor(video.duration / frameInterval) + 1;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 保存原始时间
    const originalTime = video.currentTime;
    const wasPlaying = !video.paused;
    if (wasPlaying) video.pause();

    try {
      // 确保提取所有帧，包括最后一帧
      for (let i = 0; i < totalFrames; i++) {
        const timestamp = Math.min(i * frameInterval, video.duration);
        // 确保不超过视频时长
        if (timestamp > video.duration) break;
        video.currentTime = timestamp;

        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            try {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const frameUrl = canvas.toDataURL("image/jpeg", 0.8);
              frames.push({
                index: i,
                timestamp,
                url: frameUrl,
              });
            } catch (error) {
              console.error("Error extracting frame:", error);
            }
            resolve();
          };
          video.addEventListener("seeked", onSeeked);
          
          // 超时保护
          setTimeout(() => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          }, 2000);
        });
      }

      setKeyFrames(frames);
      toast.success(`已提取 ${frames.length} 个关键帧`);
    } catch (error) {
      console.error("Error extracting frames:", error);
      toast.error("提取关键帧失败");
    } finally {
      // 恢复原始状态
      video.currentTime = originalTime;
      setIsExtractingFrames(false);
    }
  }, []);

  // 视频加载完成后自动提取关键帧
  useEffect(() => {
    const video = videoRef.current;
    if (!video || keyFrames.length > 0 || isExtractingFrames) return;
    
    const tryExtractFrames = () => {
      if (video.readyState >= 2 && video.duration > 0 && !isNaN(video.duration)) {
        console.log("Video ready, extracting frames. Duration:", video.duration, "readyState:", video.readyState);
        extractKeyFrames();
      } else {
        console.log("Video not ready yet. readyState:", video.readyState, "duration:", video.duration);
      }
    };
    
    const handleLoadedMetadata = () => {
      console.log("Loaded metadata event, duration:", video.duration);
      tryExtractFrames();
    };
    
    const handleCanPlay = () => {
      console.log("Can play event, readyState:", video.readyState, "duration:", video.duration);
      tryExtractFrames();
    };
    
    // 如果已经加载了元数据，直接尝试提取
    if (video.readyState >= 2 && video.duration > 0 && !isNaN(video.duration)) {
      console.log("Video already ready, extracting frames immediately");
      tryExtractFrames();
    } else {
      // 否则等待元数据加载
      console.log("Waiting for video metadata...");
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("canplay", handleCanPlay);
      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("canplay", handleCanPlay);
      };
    }
  }, [extractKeyFrames, keyFrames.length, isExtractingFrames]);

  // 处理视频播放
  const togglePlayback = useCallback(() => {
    if (!videoRef.current) {
      console.error("❌ videoRef.current is null");
      return;
    }
    const video = videoRef.current;
    console.log("🎬 Toggle playback, current state:", isPlaying, "video.paused:", video.paused);
    
    if (isPlaying || !video.paused) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch((error) => {
        console.error("❌ Video play error:", error);
        toast.error("视频播放失败");
      });
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // 处理视频时间更新
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleSeeked = () => {
      // 当视频跳转完成时，更新当前时间
      setCurrentTime(video.currentTime);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("seeked", handleSeeked);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, []);


  // 处理 Dify AI 返回的操作结果
  const handleDifyOperationResult = useCallback(
    async (result: DifyOperationResult) => {
      console.log("🤖 Dify operation result:", result);
      console.log("🤖 Full result details:", {
        is_valid_request: result.is_valid_request,
        object_exists: result.object_exists,
        text_prompt: result.text_prompt,
        action: result.action,
        confidence: result.confidence,
        clarification_needed: result.clarification_needed,
        vision_matched: result.vision_matched,
        reasoning: result.reasoning,
        assistant_message: result.assistant_message,
      });

      // 如果请求无效，不需要处理
      if (!result.is_valid_request) {
        console.log("⚠️ Request is invalid, skipping");
        return;
      }

      // 如果对象不存在或需要澄清，等待用户重新输入
      if (!result.object_exists || result.clarification_needed) {
        console.log("⚠️ Object not exists or clarification needed, skipping mask generation");
        console.log("⚠️ object_exists:", result.object_exists, "clarification_needed:", result.clarification_needed);
        setWaitingForConfirmation(false);
        return;
      }

      // 如果对象存在且不需要澄清，生成单帧遮罩
      if (result.object_exists && !result.clarification_needed && selectedFrameIndex !== null) {
        const frame = keyFrames[selectedFrameIndex];
        if (!frame) {
          toast.error("无法找到对应的帧");
          return;
        }

        // 先设置操作结果，但不要立即设置 waitingForConfirmation
        // 等遮罩生成完成后再设置，避免用户在遮罩生成前就确认
        setPendingOperationResult(result);
        setIsProcessing(true);

        // 在上一条 AI 消息后面添加加载 icon（不创建新消息）
        setChatMessages((prev) => {
          // 找到最后一条 AI 消息的索引
          let lastAIMessageIndex = -1;
          for (let i = prev.length - 1; i >= 0; i--) {
            if (!prev[i].isUser) {
              lastAIMessageIndex = i;
              break;
            }
          }
          
          if (lastAIMessageIndex >= 0) {
            const updated = [...prev];
            updated[lastAIMessageIndex] = {
              ...updated[lastAIMessageIndex],
              isLoading: true, // 添加加载 icon
            };
            return updated;
          }
          return prev;
        });

        try {
          // 调用 SAM3 API 生成单帧遮罩（使用 text prompt）
          const response = await fetch("/api/processing/generate-mask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              assetId,
              textPrompt: result.text_prompt, // 使用 text prompt 而不是坐标
              timestamp: frame.timestamp,
              frameImage: frame.url,
              videoUrl: asset.fullUrl || asset.mediaUrlRemote,
              isSingleFrame: true, // 标记为单帧遮罩
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("API Error:", response.status, errorText);
            throw new Error(`Failed to generate mask: ${response.status}`);
          }

          const data = await response.json();
          if (data.success && data.mask) {
            // 如果 mask.isVideo 为 true，需要从 MP4 中提取第一帧作为预览
            let previewUrl = data.mask.preview;
            
            if (data.mask.isVideo) {
              // 从 MP4 视频中提取第一帧作为预览
              try {
                const video = document.createElement('video');
                video.src = data.mask.maskVideoUrl;
                video.crossOrigin = 'anonymous';
                video.muted = true;
                
                await new Promise<void>((resolve, reject) => {
                  video.onloadeddata = () => {
                    video.currentTime = 0;
                    video.onseeked = () => {
                      try {
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(video, 0, 0);
                          previewUrl = canvas.toDataURL('image/png');
                          resolve();
                        } else {
                          reject(new Error('Failed to get canvas context'));
                        }
                      } catch (error) {
                        reject(error);
                      }
                    };
                    video.onerror = () => reject(new Error('Failed to load video'));
                  };
                  video.onerror = () => reject(new Error('Failed to load video'));
                });
                
                console.log("✅ Extracted first frame from mask video");
              } catch (error) {
                console.warn("⚠️ Failed to extract first frame, using video URL directly:", error);
                // 如果提取失败，使用视频 URL 直接显示（浏览器会自动显示第一帧）
                previewUrl = data.mask.maskVideoUrl;
              }
            }
            
            snapshotState();
            setMaskData({
              preview: previewUrl,
              maskUrl: data.mask.maskUrl,
              predictionId: data.mask.predictionId,
            });
            
            // 设置 pending action
            setPendingAction(result.action);
            
            // 确保所有必要的状态都已设置
            console.log("✅ Mask generated successfully, state updated:", {
              hasMaskData: true,
              pendingAction: result.action,
              hasPendingOperationResult: true,
              textPrompt: result.text_prompt,
            });
            
            // 取消加载 icon，并添加新的确认消息（不替换原来的消息）
            setChatMessages((prev) => {
              // 找到最后一条 AI 消息并取消加载状态
              let lastAIMessageIndex = -1;
              for (let i = prev.length - 1; i >= 0; i--) {
                if (!prev[i].isUser) {
                  lastAIMessageIndex = i;
                  break;
                }
              }
              
              const updated = [...prev];
              if (lastAIMessageIndex >= 0) {
                updated[lastAIMessageIndex] = {
                  ...updated[lastAIMessageIndex],
                  isLoading: false, // 取消加载 icon
                };
              }
              
              // 添加确认消息
              return [...updated, {
                id: `confirm-${Date.now()}`,
                content: "遮罩预览已生成并显示在画布上，请使用下方的按钮进行确认或重新选择。",
                isUser: false,
                timestamp: new Date(),
              }];
            });
            
            // 遮罩生成完成后，才设置 waitingForConfirmation，确保所有状态都已准备好
            setIsProcessing(false);
            setWaitingForConfirmation(true);
          } else {
            throw new Error(data.error || "Invalid response");
          }
        } catch (error: any) {
          console.error("Error generating mask:", error);
          toast.error(`生成遮罩失败: ${error.message || "请重试"}`);
          
          // 取消加载 icon，并添加错误消息（不替换原来的消息）
          setChatMessages((prev) => {
            // 找到最后一条 AI 消息并取消加载状态
            let lastAIMessageIndex = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
              if (!prev[i].isUser) {
                lastAIMessageIndex = i;
                break;
              }
            }
            
            const updated = [...prev];
            if (lastAIMessageIndex >= 0) {
              updated[lastAIMessageIndex] = {
                ...updated[lastAIMessageIndex],
                isLoading: false, // 取消加载 icon
              };
            }
            
            // 添加错误消息
            return [...updated, {
              id: `error-${Date.now()}`,
              content: `生成遮罩时出错: ${error.message || "请重试"}`,
              isUser: false,
              timestamp: new Date(),
            }];
          });
        } finally {
          setIsProcessing(false);
        }
      }
    },
    [keyFrames, selectedFrameIndex, assetId, asset.fullUrl, asset.mediaUrlRemote, snapshotState, setMaskData, setPendingAction, chatMessages]
  );

  // 处理 Remove 操作
  const handleRemove = useCallback(() => {
    if (!selectedObject || !maskData) return;
    snapshotState();
    setPendingAction("remove");
  }, [selectedObject, maskData, snapshotState, setPendingAction]);

  // 处理 Extract 操作
  const handleExtract = useCallback(() => {
    if (!selectedObject || !maskData) return;
    snapshotState();
    setPendingAction("extract");
  }, [selectedObject, maskData, snapshotState, setPendingAction]);

  // 确认操作 - 启动处理任务（用户确认遮罩后）
  const handleConfirm = useCallback(async () => {
    console.log("🔵 handleConfirm called", {
      hasMaskData: !!maskData,
      pendingAction,
      hasPendingOperationResult: !!pendingOperationResult,
      maskData,
      pendingOperationResult,
    });
    
    if (!maskData || !pendingAction || !pendingOperationResult) {
      console.error("❌ Missing required data for confirmation:", {
        maskData: !!maskData,
        pendingAction,
        pendingOperationResult: !!pendingOperationResult,
      });
      toast.error("请先选择对象并生成遮罩");
      return;
    }

    setIsProcessing(true);
    setTaskProgress({ percentage: 0, status: "正在生成全视频遮罩..." });
    setWaitingForConfirmation(false);

    // 在对话框中添加处理消息
    const processingMessage: typeof chatMessages[0] = {
      id: Date.now().toString(),
      content: "已确认，正在为整个视频生成遮罩并处理...",
      isUser: false,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, processingMessage]);

    try {
      taskFinishedRef.current = false; // 重置完成标记，避免重复提示
      // 第一步：生成全视频遮罩
      const maskResponse = await fetch("/api/processing/generate-mask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assetId,
          textPrompt: pendingOperationResult.text_prompt,
          videoUrl: asset.fullUrl || asset.mediaUrlRemote,
          isSingleFrame: false, // 全视频遮罩
        }),
      });

      if (!maskResponse.ok) {
        throw new Error("Failed to generate full video mask");
      }

      const maskData_result = await maskResponse.json();
      if (!maskData_result.success || !maskData_result.mask) {
        throw new Error("Failed to generate full video mask");
      }

      // 第二步：启动处理任务
      const taskResponse = await fetch("/api/processing/start-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assetId,
          action: pendingAction,
          maskData: maskData_result.mask,
          textPrompt: pendingOperationResult.text_prompt,
          videoUrl: asset.fullUrl || asset.mediaUrlRemote, // 传递原始视频 URL
        }),
      });

      if (!taskResponse.ok) {
        throw new Error("Failed to start task");
      }

      const taskData = await taskResponse.json();
      if (taskData.success && taskData.taskId) {
        // 设置任务进度，useEffect 会自动开始轮询
        taskFinishedRef.current = false;
        setTaskProgress({
          percentage: 0,
          status: "处理中...",
          taskId: taskData.taskId,
        });
        
        const successMessage: typeof chatMessages[0] = {
          id: (Date.now() + 1).toString(),
          content: "任务已启动，正在处理视频...",
          isUser: false,
          timestamp: new Date(),
        };
        setChatMessages((prev) => [...prev, successMessage]);
      } else {
        throw new Error("Invalid response");
      }
    } catch (error: any) {
      console.error("Error starting task:", error);
      toast.error("启动任务失败，请重试");
      const errorMessage: typeof chatMessages[0] = {
        id: Date.now().toString(),
        content: `处理失败: ${error.message || "请重试"}`,
        isUser: false,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
      setIsProcessing(false);
      setTaskProgress(null);
    }
  }, [maskData, pendingAction, pendingOperationResult, assetId, asset.fullUrl, asset.mediaUrlRemote, chatMessages]);

  // 轮询任务进度 - 使用 useEffect 管理
  useEffect(() => {
    if (!taskProgress?.taskId) return;
    
    // 重置完成标记
    taskFinishedRef.current = false;
    
    const interval = setInterval(async () => {
      // 如果任务已完成，停止轮询
      if (taskFinishedRef.current) {
        clearInterval(interval);
        return;
      }

      try {
        const response = await fetch(`/api/processing/task/${taskProgress.taskId}`, {
          credentials: "include",
        });

        if (!response.ok) {
          clearInterval(interval);
          setIsProcessing(false);
          setTaskProgress((prev) => prev ? { ...prev, status: "Failed to get progress" } : null);
          const errorMessage: typeof chatMessages[0] = {
            id: Date.now().toString(),
            content: "获取任务进度失败",
            isUser: false,
            timestamp: new Date(),
          };
          setChatMessages((prev) => [...prev, errorMessage]);
          return;
        }

        const data = await response.json();
        const newStatus = data.message || data.status || "处理中...";
        const newPercentage = data.percentage || 0;
        
        setTaskProgress((prev) => prev ? {
          ...prev,
          percentage: newPercentage,
          status: newStatus,
        } : null);

        // 在对话框中更新进度（只更新，不添加新消息）
        if (newPercentage > 0 && newPercentage < 100) {
          setChatMessages((prev) => {
            // 移除旧的进度消息，添加新的
            const filtered = prev.filter((m) => !m.id.startsWith("progress-"));
            return [...filtered, {
              id: `progress-${taskProgress.taskId}`,
              content: `${newStatus} (${Math.round(newPercentage)}%)`,
              isUser: false,
              timestamp: new Date(),
            }];
          });
        }

        if (data.status === "completed" || data.status === "failed") {
          // 防止重复处理 - 使用更严格的检查
          if (taskFinishedRef.current) {
            clearInterval(interval);
            return;
          }
          
          // 立即标记为完成并停止轮询
          taskFinishedRef.current = true;
          clearInterval(interval);
          setIsProcessing(false);
          
          // 保存处理结果到状态
          if (data.status === "completed" && data.outputUrl) {
            // 检查是否是模拟模式的占位符 URL
            const isMockPlaceholder = data.outputUrl.includes("commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny");
            const isValidOutput = data.outputUrl && !isMockPlaceholder;
            
            setTaskProgress(prev => prev ? {
              ...prev,
              outputUrl: isValidOutput ? data.outputUrl : undefined,
              outputUrls: isValidOutput ? (data.outputUrls || [data.outputUrl]) : undefined,
              percentage: 100,
              status: isValidOutput ? "处理完成" : "模拟模式（测试完成）"
            } : null);
            
            // 检查是否已经添加过最终消息，使用精确的 ID 检查
            const finalMessageId = `final-${taskProgress.taskId}`;
            setChatMessages((prev) => {
              // 检查是否已存在该任务的最终消息（使用 ID 而不是内容）
              const hasFinalMessage = prev.some((m) => m.id === finalMessageId);
              
              if (hasFinalMessage) {
                // 如果已存在，只移除进度消息，不重复添加
                return prev.filter((m) => !m.id.startsWith("progress-"));
              }
              
              // 移除进度消息，添加最终消息
              const filtered = prev.filter((m) => !m.id.startsWith("progress-"));
              return [...filtered, {
                id: finalMessageId,
                content: isValidOutput 
                  ? "✅ 处理完成！视频已准备好下载。" 
                  : "🎭 模拟模式测试完成（未实际处理视频）",
                isUser: false,
                timestamp: new Date(),
              }];
            });
            
            // 使用 toast 的 id 参数防止重复显示
            if (isValidOutput) {
              toast.success("处理完成！", { id: `toast-${taskProgress.taskId}` });
            } else {
              toast.info("模拟模式测试完成", { id: `toast-${taskProgress.taskId}` });
            }
          } else {
            // 没有 outputUrl 或处理失败
            const finalMessageId = `final-${taskProgress.taskId}`;
            setChatMessages((prev) => {
              // 检查是否已存在该任务的最终消息
              const hasFinalMessage = prev.some((m) => m.id === finalMessageId);
              
              if (hasFinalMessage) {
                return prev.filter((m) => !m.id.startsWith("progress-"));
              }
              
              const filtered = prev.filter((m) => !m.id.startsWith("progress-"));
              return [...filtered, {
                id: finalMessageId,
                content: data.status === "completed"
                  ? "⚠️ 处理完成，但未找到输出视频"
                  : "❌ 处理失败，请重试",
                isUser: false,
                timestamp: new Date(),
              }];
            });
            
            // 使用 toast 的 id 参数防止重复显示
            if (data.status === "completed") {
              toast.warning("处理完成，但未找到输出视频", { id: `toast-${taskProgress.taskId}` });
            } else {
              toast.error("处理失败", { id: `toast-${taskProgress.taskId}` });
            }
          }
        }
      } catch (error) {
        console.error("Error polling task progress:", error);
        clearInterval(interval);
        setIsProcessing(false);
        setChatMessages((prev) => {
          const hasErrorMessage = prev.some((m) => m.content.includes("获取任务进度时出错"));
          if (hasErrorMessage) return prev;
          
          return [...prev, {
            id: Date.now().toString(),
            content: "获取任务进度时出错",
            isUser: false,
            timestamp: new Date(),
          }];
        });
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      taskFinishedRef.current = false;
    };
  }, [taskProgress?.taskId]); // 移除 chatMessages 依赖，避免重复创建 interval

  // 处理下载
  const handleDownload = useCallback(async () => {
    if (!taskProgress?.outputUrl) {
      toast.error("输出视频不可用，请等待处理完成");
      return;
    }

    try {
      // 创建下载链接
      const link = document.createElement('a');
      link.href = taskProgress.outputUrl;
      link.download = `processed-video-${assetId}-${Date.now()}.mp4`;
      link.target = '_blank';
      
      // 添加到 DOM，触发下载，然后移除
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("开始下载视频");
    } catch (error) {
      console.error("下载失败:", error);
      toast.error("下载失败，请重试");
    }
  }, [taskProgress, assetId]);

  // 处理帧选择
  const handleFrameSelect = useCallback(
    (index: number) => {
      const frame = keyFrames[index];
      if (!frame || !videoRef.current) return;

      videoRef.current.currentTime = frame.timestamp;
      snapshotState();
      setSelectedFrameIndex(index);
    },
    [keyFrames, snapshotState, setSelectedFrameIndex]
  );

  // 处理时间轴跳转
  const handleTimelineSeek = useCallback((time: number) => {
    if (!videoRef.current) return;
    // 立即更新视频时间，并更新当前时间状态
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    // 暂停播放以确保显示正确的帧
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  // 处理时间轴缩放变化
  const handleZoomChange = useCallback((zoomLevel: number) => {
    setPixelsPerSecond(PIXELS_PER_SECOND * zoomLevel);
  }, []);

  // 保存项目状态
  const handleSaveProject = useCallback(async () => {
    try {
      // Get user session via API
      const response = await fetch("/api/auth/session", { credentials: "include" });
      const sessionData = await response.json();
      const uid = sessionData?.user?.id || sessionData?.session?.userId;
      
      if (!uid) {
        toast.error("请先登录");
        return;
      }

      if (!projectId) {
        // Create new project
        const projectResponse = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: `Object Selection - ${asset.name}`,
          }),
        });
        
        if (!projectResponse.ok) {
          throw new Error("Failed to create project");
        }
        
        const project = await projectResponse.json();
        setProjectId(project.project.id);
        
        // Save project state
        await fetch(`/api/projects/${project.project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            timeline: {
              tracks: [],
            },
            taskData: {
              assetId: asset.id,
              clickPoints: selectionState.clickPoints,
              maskData: selectionState.maskData,
              selectedFrameIndex: selectionState.selectedFrameIndex,
              pendingAction: selectionState.pendingAction,
            },
          }),
        });
        
        toast.success("项目已保存");
      } else {
        // Update existing project
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            timeline: {
              tracks: [],
            },
            taskData: {
              assetId: asset.id,
              clickPoints: selectionState.clickPoints,
              maskData: selectionState.maskData,
              selectedFrameIndex: selectionState.selectedFrameIndex,
              pendingAction: selectionState.pendingAction,
            },
          }),
        });
        
        toast.success("项目已更新");
      }
    } catch (error) {
      console.error("Failed to save project:", error);
      toast.error("保存项目失败");
    }
  }, [projectId, asset, selectionState]);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      // Ctrl/Cmd + Shift + Z 重做
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedo) redo();
      }
      // Ctrl/Cmd + S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveProject();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, undo, redo, handleSaveProject]);

  // 处理放大
  const handleZoom = useCallback(() => {
    setIsZoomed(true);
    setZoomScale(2); // 放大2倍
    setPanX(0);
    setPanY(0);
  }, []);

  // 处理恢复原图
  const handleReset = useCallback(() => {
    setIsZoomed(false);
    setZoomScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  // 处理拖拽开始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isZoomed) return;
    // 如果点击的是视频本身（用于选择对象），不触发拖拽
    if ((e.target as HTMLElement).tagName === "VIDEO" && selectedFrameIndex !== null) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  }, [isZoomed, panX, panY, selectedFrameIndex]);

  // 处理拖拽移动
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !isZoomed) return;
    const newPanX = e.clientX - dragStart.x;
    const newPanY = e.clientY - dragStart.y;
    
    // 限制拖拽范围，防止拖出边界
    const video = videoRef.current;
    if (video) {
      const container = video.parentElement;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const videoRect = video.getBoundingClientRect();
        const maxPanX = (videoRect.width * zoomScale - containerRect.width) / 2;
        const maxPanY = (videoRect.height * zoomScale - containerRect.height) / 2;
        
        setPanX(Math.max(-maxPanX, Math.min(maxPanX, newPanX)));
        setPanY(Math.max(-maxPanY, Math.min(maxPanY, newPanY)));
      }
    }
  }, [isDragging, isZoomed, dragStart, zoomScale]);

  // 处理拖拽结束
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 监听鼠标移动和释放
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    // Header 固定，仅中间内容区域可滚动
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <h1 className="text-sm font-medium ml-4">{asset.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Undo/Redo Buttons */}
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            className="gap-2"
            title="撤销 (Ctrl/Cmd+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            className="gap-2"
            title="重做 (Ctrl/Cmd+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          {/* Save Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveProject}
            className="gap-2"
            title="保存 (Ctrl/Cmd+S)"
          >
            <Save className="h-4 w-4" />
            保存
          </Button>
        </div>
      </header>

      {/* Main Content: Left (Video + Timeline/Preview) + Right (Chat) */}
      <div className="flex-1 flex overflow-x-hidden overflow-y-auto gap-4 px-4">
        {/* Left Side: Video Canvas + Timeline/Preview */}
        <div className="w-2/3 flex flex-col overflow-hidden min-h-0 gap-4">
          {/* Video Canvas - 上方 */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-0 rounded-lg">
            <div
              className="relative w-full h-full flex items-center justify-center"
              onMouseDown={handleMouseDown}
              style={{
                cursor: isZoomed ? (isDragging ? "grabbing" : "grab") : "default",
                overflow: "hidden",
              }}
            >
              {/* 视频元素始终存在，用于播放控制 */}
              <video
                ref={videoRef}
                src={asset.mediaUrlRemote}
                className={maskData && selectedFrameIndex !== null ? "hidden" : "max-w-full max-h-full"}
                style={{
                  transform: `scale(${zoomScale}) translate(${panX / zoomScale}px, ${panY / zoomScale}px)`,
                  transition: isDragging ? "none" : "transform 0.1s ease-out",
                }}
                onLoadedMetadata={() => {
                  console.log("✅ Video metadata loaded, duration:", videoRef.current?.duration, "readyState:", videoRef.current?.readyState);
                  // 确保视频元数据加载后触发关键帧提取
                  if (videoRef.current && keyFrames.length === 0 && !isExtractingFrames) {
                    const video = videoRef.current;
                    if (video.readyState >= 2 && video.duration > 0 && !isNaN(video.duration)) {
                      console.log("✅ Triggering extractKeyFrames from onLoadedMetadata");
                      extractKeyFrames();
                    } else {
                      console.log("⏳ Video metadata loaded but not ready yet. readyState:", video.readyState, "duration:", video.duration);
                    }
                  }
                }}
                onCanPlay={() => {
                  console.log("✅ Video can play, readyState:", videoRef.current?.readyState, "duration:", videoRef.current?.duration);
                  // 视频可以播放时，如果还没有提取关键帧，则提取
                  if (videoRef.current && keyFrames.length === 0 && !isExtractingFrames) {
                    const video = videoRef.current;
                    if (video.readyState >= 2 && video.duration > 0 && !isNaN(video.duration)) {
                      console.log("✅ Triggering extractKeyFrames from onCanPlay");
                      extractKeyFrames();
                    } else {
                      console.log("⏳ Video can play but not ready yet. readyState:", video.readyState, "duration:", video.duration);
                    }
                  }
                }}
                onLoadedData={() => {
                  console.log("✅ Video data loaded, readyState:", videoRef.current?.readyState);
                  if (videoRef.current && keyFrames.length === 0 && !isExtractingFrames) {
                    const video = videoRef.current;
                    if (video.readyState >= 2 && video.duration > 0 && !isNaN(video.duration)) {
                      console.log("✅ Triggering extractKeyFrames from onLoadedData");
                      extractKeyFrames();
                    }
                  }
                }}
                onError={(e) => {
                  console.error("❌ Video load error:", e);
                  const errorMessage: typeof chatMessages[0] = {
                    id: Date.now().toString(),
                    content: "视频加载失败，请检查视频文件或网络连接",
                    isUser: false,
                    timestamp: new Date(),
                  };
                  setChatMessages((prev) => [...prev, errorMessage]);
                }}
              />
              
              {/* 如果有遮罩，显示遮罩图像（覆盖在视频上方） */}
              {maskData && selectedFrameIndex !== null && (
                <img
                  src={maskData.preview}
                  alt="Mask preview"
                  className="absolute max-w-full max-h-full object-contain pointer-events-none"
                  style={{
                    transform: `scale(${zoomScale}) translate(${panX / zoomScale}px, ${panY / zoomScale}px)`,
                    transition: isDragging ? "none" : "transform 0.1s ease-out",
                  }}
                />
              )}

              {/* 视频控制栏 */}
              <VideoControls
                currentTime={currentTime}
                duration={asset.durationInSeconds}
                isPlaying={isPlaying}
                isZoomed={isZoomed}
                onPlayPause={togglePlayback}
                onZoom={handleZoom}
                onReset={handleReset}
              />
            </div>
          </div>

          {/* Timeline 或处理后的视频预览 - 下方，固定高度 */}
          <div className="flex-shrink-0">
            {taskProgress?.outputUrl ? (
              // 处理完成后显示视频预览，尺寸与上方 canvas 保持一致视觉（限制最大高）
              <div className="border-t bg-muted/30 rounded-lg overflow-hidden flex flex-col">
                <div className="px-4 py-2 border-b bg-background">
                  <h3 className="text-sm font-medium">处理后的视频预览</h3>
                </div>
                <div className="bg-black aspect-video w-full max-h-[480px] flex items-center justify-center">
                  <video
                    src={taskProgress.outputUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="px-4 py-2 border-t bg-background flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">处理完成，可以下载视频</span>
                  <Button
                    onClick={handleDownload}
                    size="sm"
                    variant="default"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    下载视频
                  </Button>
                </div>
              </div>
            ) : (
              // 处理中显示 Timeline
              keyFrames.length > 0 ? (
                <FrameTimeline
                  frames={keyFrames}
                  selectedFrameIndex={selectedFrameIndex}
                  currentTime={currentTime}
                  duration={asset.durationInSeconds}
                  pixelsPerSecond={pixelsPerSecond}
                  onFrameSelect={handleFrameSelect}
                  onTimelineSeek={handleTimelineSeek}
                  onZoomChange={handleZoomChange}
                />
              ) : (
                <div className="h-48 border-t bg-muted/30 flex items-center justify-center">
                  <div className="text-sm text-muted-foreground">
                    {isExtractingFrames ? "正在提取关键帧..." : "等待视频加载..."}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Right Side: AI Chat Box */}
        <ObjectSelectionChatBox
          messages={chatMessages}
          onMessagesChange={setChatMessages}
          currentFrameImageUrl={
            selectedFrameIndex !== null && keyFrames[selectedFrameIndex]
              ? keyFrames[selectedFrameIndex].url
              : undefined
          }
          onOperationResult={handleDifyOperationResult}
          onUserConfirm={handleConfirm}
          onUserCancel={() => {
            setWaitingForConfirmation(false);
            setMaskData(null);
            setPendingOperationResult(null);
            setSelectedFrameIndex(null);
          }}
          isMinimized={isChatMinimized}
          onToggleMinimize={() => setIsChatMinimized(!isChatMinimized)}
          userId={userId}
          conversationId={difyConversationId}
          onConversationIdChange={setDifyConversationId}
          waitingForConfirmation={waitingForConfirmation}
        />
      </div>


      {/* 隐藏的 canvas 用于提取帧 */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

