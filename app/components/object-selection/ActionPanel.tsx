import React from "react";
import { Button } from "~/components/ui/button";
import { Trash2, Download, CheckCircle, Loader2 } from "lucide-react";
import type { ClickPoint, MaskData } from "~/hooks/useObjectSelection";
import { Progress } from "~/components/ui/progress";

interface TaskProgress {
  percentage: number;
  status: string;
}

interface ActionPanelProps {
  selectedObject: ClickPoint | null;
  maskData: MaskData | null;
  taskProgress: TaskProgress | null;
  isProcessing: boolean;
  onRemove: () => void;
  onExtract: () => void;
  onConfirm: () => void;
  onDownload: () => void;
}

export function ActionPanel({
  selectedObject,
  maskData,
  taskProgress,
  isProcessing,
  onRemove,
  onExtract,
  onConfirm,
  onDownload,
}: ActionPanelProps) {
  const hasSelection = selectedObject !== null;
  const hasMask = maskData !== null;

  return (
    <div className="w-80 border-l bg-background flex-shrink-0 flex flex-col">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">操作面板</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 选择状态 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">选择状态</h4>
          {!hasSelection && (
            <p className="text-sm text-muted-foreground">请在视频上点击选择要操作的对象</p>
          )}
          {hasSelection && !hasMask && (
            <div className="space-y-2">
              <p className="text-sm">已选择对象</p>
              <p className="text-xs text-muted-foreground">
                帧: {selectedObject.frameIndex + 1} | 时间: {selectedObject.timestamp.toFixed(2)}s
              </p>
              <p className="text-xs text-muted-foreground">正在生成遮罩...</p>
            </div>
          )}
          {hasSelection && hasMask && (
            <div className="space-y-2">
              <p className="text-sm">遮罩已生成</p>
              <div className="aspect-video bg-muted rounded overflow-hidden">
                <img
                  src={maskData.preview}
                  alt="Mask preview"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* 任务进度 */}
        {taskProgress && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">处理进度</h4>
            <Progress value={taskProgress.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground">{taskProgress.status}</p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="space-y-2 pt-4 border-t">
          <h4 className="text-sm font-medium text-muted-foreground">操作</h4>
          
          {hasMask && (
            <>
              <Button
                onClick={onConfirm}
                className="w-full"
                disabled={isProcessing}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                确认操作
              </Button>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={onRemove}
                  variant="destructive"
                  className="w-full"
                  disabled={isProcessing}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </Button>
                
                <Button
                  onClick={onExtract}
                  variant="outline"
                  className="w-full"
                  disabled={isProcessing}
                >
                  <Download className="mr-2 h-4 w-4" />
                  提取
                </Button>
              </div>
            </>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* 下载按钮 */}
        {!isProcessing && hasMask && (
          <div className="pt-4 border-t">
            <Button
              onClick={onDownload}
              variant="outline"
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              下载结果
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
