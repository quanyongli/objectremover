import React, { useState, useCallback, useRef } from "react";
import { Upload, X, CheckCircle2, XCircle, AlertCircle, RefreshCw, Play } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { validateVideo, generateVideoPreview, type VideoMetadata } from "~/lib/video-validation";
import type { ValidationResult } from "~/lib/video-validation";
import axios from "axios";

interface VideoUploaderProps {
  onUploadSuccess?: (asset: {
    id: string;
    name: string;
    mediaUrlRemote: string;
    width: number;
    height: number;
    durationInSeconds: number;
  }) => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

interface UploadState {
  file: File | null;
  preview: string | null;
  metadata: VideoMetadata | null;
  validation: ValidationResult | null;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  canCancel: boolean;
}

export function VideoUploader({
  onUploadSuccess,
  onUploadError,
  className,
}: VideoUploaderProps) {
  const [state, setState] = useState<UploadState>({
    file: null,
    preview: null,
    metadata: null,
    validation: null,
    isUploading: false,
    uploadProgress: 0,
    uploadError: null,
    canCancel: false,
  });

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);

  // 处理文件选择
  const handleFileSelect = useCallback(async (file: File) => {
    // 重置状态
    setState({
      file: null,
      preview: null,
      metadata: null,
      validation: null,
      isUploading: false,
      uploadProgress: 0,
      uploadError: null,
      canCancel: false,
    });

    // 快速验证：文件格式和大小
    const allowedExtensions = ['.mp4', '.mov', '.webm', '.avi'];
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(extension)) {
      const error = `不支持的文件格式。支持的格式：${allowedExtensions.join(', ')}`;
      setState(prev => ({ ...prev, uploadError: error }));
      onUploadError?.(error);
      return;
    }

    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      const error = `文件大小超过限制。最大 ${(maxSize / (1024 * 1024)).toFixed(0)}MB`;
      setState(prev => ({ ...prev, uploadError: error }));
      onUploadError?.(error);
      return;
    }

    // 验证视频并获取元数据
    try {
      const validation = await validateVideo(file);
      const preview = await generateVideoPreview(file);

      setState({
        file,
        preview,
        metadata: validation.metadata || null,
        validation,
        isUploading: false,
        uploadProgress: 0,
        uploadError: validation.valid ? null : validation.errors.join('; '),
        canCancel: false,
      });

      if (!validation.valid) {
        onUploadError?.(validation.errors.join('; '));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '文件验证失败';
      setState(prev => ({
        ...prev,
        uploadError: errorMessage,
      }));
      onUploadError?.(errorMessage);
    }
  }, [onUploadError]);

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const videoFile = files.find((file) => file.type.startsWith("video/"));
      if (videoFile) {
        handleFileSelect(videoFile);
      }
    },
    [handleFileSelect]
  );

  // 文件输入处理
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  // 开始上传
  const handleUpload = useCallback(async () => {
    if (!state.file || !state.validation?.valid) return;

    const controller = new AbortController();
    uploadControllerRef.current = controller;

    setState(prev => ({
      ...prev,
      isUploading: true,
      uploadProgress: 0,
      uploadError: null,
      canCancel: true,
    }));

    try {
      const formData = new FormData();
      formData.append('media', state.file);

      const response = await axios.post('/api/assets/upload', formData, {
        headers: {
          'x-media-width': state.metadata?.width?.toString() || '',
          'x-media-height': state.metadata?.height?.toString() || '',
          'x-media-duration': state.metadata?.duration?.toString() || '',
          'x-original-name': state.file.name,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setState(prev => ({ ...prev, uploadProgress: progress }));
          }
        },
        signal: controller.signal,
      });

      if (response.data.success && response.data.asset) {
        console.log('✅ Upload success, asset data:', response.data.asset);
        setState(prev => ({
          ...prev,
          isUploading: false,
          uploadProgress: 100,
          canCancel: false,
        }));
        onUploadSuccess?.(response.data.asset);
      } else {
        throw new Error(response.data.error || '上传失败');
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        setState(prev => ({
          ...prev,
          isUploading: false,
          uploadProgress: 0,
          canCancel: false,
        }));
        return;
      }

      const errorMessage = error.response?.data?.error || error.message || '上传失败';
      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadError: errorMessage,
        canCancel: false,
      }));
      onUploadError?.(errorMessage);
    } finally {
      uploadControllerRef.current = null;
    }
  }, [state.file, state.validation, state.metadata, onUploadSuccess, onUploadError]);

  // 取消上传
  const handleCancel = useCallback(() => {
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort();
      uploadControllerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isUploading: false,
      uploadProgress: 0,
      canCancel: false,
    }));
  }, []);

  // 重试上传
  const handleRetry = useCallback(() => {
    setState(prev => ({ ...prev, uploadError: null }));
    handleUpload();
  }, [handleUpload]);

  // 清除文件
  const handleClear = useCallback(() => {
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort();
      uploadControllerRef.current = null;
    }
    if (state.preview) {
      URL.revokeObjectURL(state.preview);
    }
    setState({
      file: null,
      preview: null,
      metadata: null,
      validation: null,
      isUploading: false,
      uploadProgress: 0,
      uploadError: null,
      canCancel: false,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [state.preview]);

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* 上传区域 */}
      {!state.file && (
        <Card>
          <CardContent className="pt-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background/50 hover:border-primary/50 hover:bg-background/80"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                拖拽视频文件到此处或点击选择
              </p>
              <p className="text-sm text-muted-foreground">
                支持 MP4、MOV、WebM、AVI，最大 500MB
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 文件信息和预览 */}
      {state.file && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* 文件信息 */}
              <div className="flex items-start gap-4">
                {state.preview && (
                  <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={state.preview}
                      alt="预览"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium truncate">{state.file.name}</h3>
                    {state.validation?.valid ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-2">
                    <span>{(state.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    {state.metadata && (
                      <>
                        <span>•</span>
                        <span>{state.metadata.width} × {state.metadata.height}</span>
                        <span>•</span>
                        <span>{Math.floor(state.metadata.duration)}秒</span>
                        {state.metadata.frameRate && (
                          <>
                            <span>•</span>
                            <span>{state.metadata.frameRate.toFixed(2)}fps</span>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* 验证结果 */}
                  {state.validation && (
                    <div className="space-y-1">
                      {state.validation.errors.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-red-600">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            {state.validation.errors.map((error, i) => (
                              <div key={i}>{error}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {state.validation.warnings.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-yellow-600">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            {state.validation.warnings.map((warning, i) => (
                              <div key={i}>{warning}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  disabled={state.isUploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* 上传进度 */}
              {state.isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">上传中...</span>
                    <span className="font-medium">{state.uploadProgress}%</span>
                  </div>
                  <Progress value={state.uploadProgress} />
                </div>
              )}

              {/* 上传错误 */}
              {state.uploadError && !state.isUploading && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-600 flex-1">{state.uploadError}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRetry}
                    className="text-red-600 hover:text-red-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    重试
                  </Button>
                </div>
              )}

              {/* 操作按钮 */}
              {!state.isUploading && (
                <div className="flex items-center gap-2">
                  {state.validation?.valid ? (
                    <Button onClick={handleUpload} className="flex-1">
                      <Upload className="w-4 h-4 mr-2" />
                      开始上传
                    </Button>
                  ) : (
                    <Button onClick={handleClear} variant="outline" className="flex-1">
                      选择其他文件
                    </Button>
                  )}
                  {state.canCancel && (
                    <Button variant="outline" onClick={handleCancel}>
                      取消
                    </Button>
                  )}
                </div>
              )}

              {state.isUploading && state.canCancel && (
                <Button variant="outline" onClick={handleCancel} className="w-full">
                  取消上传
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

