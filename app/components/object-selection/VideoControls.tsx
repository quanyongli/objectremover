import React from "react";
import { Button } from "~/components/ui/button";
import { Play, Pause, ZoomIn, RotateCcw } from "lucide-react";

interface VideoControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isZoomed: boolean;
  onPlayPause: () => void;
  onZoom: () => void;
  onReset: () => void;
}

export function VideoControls({
  currentTime,
  duration,
  isPlaying,
  isZoomed,
  onPlayPause,
  onZoom,
  onReset,
}: VideoControlsProps) {
  // 格式化时间显示（模仿剪映：00:00:02:17）
  const formatTime = (timeInSeconds: number) => {
    const totalFrames = Math.round(timeInSeconds * 30); // 假设30fps
    const hours = Math.floor(totalFrames / (30 * 3600));
    const minutes = Math.floor((totalFrames % (30 * 3600)) / (30 * 60));
    const seconds = Math.floor((totalFrames % (30 * 60)) / 30);
    const frames = totalFrames % 30;
    
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm flex items-center justify-between px-4 py-2 z-30">
      {/* 左侧：时间显示 */}
      <div className="flex items-center gap-2 text-blue-400 text-sm font-mono">
        <span>{formatTime(currentTime)}</span>
        <span className="text-muted-foreground">/</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* 中间：播放/暂停按钮 */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPlayPause}
          className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* 右侧：原图和放大镜按钮 */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-white hover:bg-white/20"
          disabled={!isZoomed}
        >
          原图
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoom}
          className="h-8 w-8 text-white hover:bg-white/20"
          title={isZoomed ? "恢复原图" : "放大画面"}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}


