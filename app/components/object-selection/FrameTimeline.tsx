import React, { useRef, useEffect, useCallback, useState } from "react";
import { SimpleTimelineRuler } from "~/components/object-selection/SimpleTimelineRuler";
import { PIXELS_PER_SECOND } from "~/components/timeline/types";
import { Button } from "~/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface Frame {
  index: number;
  timestamp: number;
  url: string;
}

interface FrameTimelineProps {
  frames: Frame[];
  selectedFrameIndex: number | null;
  currentTime: number;
  duration: number;
  pixelsPerSecond: number;
  onFrameSelect: (index: number) => void;
  onTimelineSeek: (time: number) => void;
  onZoomChange?: (zoomLevel: number) => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const DEFAULT_ZOOM = 1;
const ZOOM_STEP = 1.5;

export function FrameTimeline({
  frames,
  selectedFrameIndex,
  currentTime,
  duration,
  pixelsPerSecond: basePixelsPerSecond,
  onFrameSelect,
  onTimelineSeek,
  onZoomChange,
}: FrameTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [rulerPositionPx, setRulerPositionPx] = React.useState(0);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  
  // Calculate actual pixels per second based on zoom
  const pixelsPerSecond = basePixelsPerSecond * zoomLevel;
  const timelineWidth = duration * pixelsPerSecond;

  // 同步当前时间到标尺位置
  useEffect(() => {
    setRulerPositionPx(currentTime * pixelsPerSecond);
  }, [currentTime, pixelsPerSecond]);

  // 处理标尺拖拽
  const handleRulerDrag = useCallback((newPositionPx: number) => {
    const newTime = Math.max(0, Math.min(duration, newPositionPx / pixelsPerSecond));
    setRulerPositionPx(newPositionPx);
    onTimelineSeek(newTime);
  }, [duration, pixelsPerSecond, onTimelineSeek]);

  // 处理标尺鼠标按下
  const handleRulerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPosition = rulerPositionPx;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const container = containerRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const newPositionPx = Math.max(
          0,
          Math.min(timelineWidth, startPosition + deltaX - containerRect.left + container.scrollLeft)
        );
        handleRulerDrag(newPositionPx);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [rulerPositionPx, timelineWidth, handleRulerDrag]);

  // 处理滚动
  const handleScroll = () => {
    if (containerRef.current) {
      setScrollLeft(containerRef.current.scrollLeft);
    }
  };

  // 缩放功能
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, zoomLevel * ZOOM_STEP);
    setZoomLevel(newZoom);
    onZoomChange?.(newZoom);
  }, [zoomLevel, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, zoomLevel / ZOOM_STEP);
    setZoomLevel(newZoom);
    onZoomChange?.(newZoom);
  }, [zoomLevel, onZoomChange]);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(DEFAULT_ZOOM);
    onZoomChange?.(DEFAULT_ZOOM);
  }, [onZoomChange]);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + = 或 + 放大
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        handleZoomIn();
      }
      // Ctrl/Cmd + - 缩小
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        handleZoomOut();
      }
      // Ctrl/Cmd + 0 重置
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        handleZoomReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

  return (
    <div className="h-48 border-t bg-muted/30 flex flex-col">
      {/* Zoom Controls */}
      <div className="flex items-center justify-between px-4 py-1 border-b bg-background/50">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoomLevel <= MIN_ZOOM}
            className="h-6 px-2 text-xs"
            title="缩小 (Ctrl/Cmd + -)"
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomReset}
            className="h-6 px-2 text-xs"
            title="重置缩放 (Ctrl/Cmd + 0)"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoomLevel >= MAX_ZOOM}
            className="h-6 px-2 text-xs"
            title="放大 (Ctrl/Cmd + +)"
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground ml-2">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
        {/* Key Frame Markers Info */}
        {selectedFrameIndex !== null && (
          <div className="text-xs text-muted-foreground">
            帧 {selectedFrameIndex + 1} / {frames.length}
          </div>
        )}
      </div>
      {/* Timeline Ruler - 无时间框 */}
      <div className="px-4">
        <SimpleTimelineRuler
          timelineWidth={timelineWidth}
          rulerPositionPx={rulerPositionPx}
          containerRef={containerRef}
          onRulerDrag={handleRulerDrag}
          onRulerMouseDown={handleRulerMouseDown}
          pixelsPerSecond={pixelsPerSecond}
          scrollLeft={scrollLeft}
        />
      </div>

      {/* Frame Thumbnails */}
      <div
        className="flex-1 overflow-x-auto relative"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {/* 当前时间竖线 - 贯穿整个时间轴，对齐到标尺位置，使用黑色 */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-black pointer-events-none z-20"
          style={{
            left: `${rulerPositionPx + 16}px`, // 加上 padding (px-4 = 16px) 以对齐标尺
          }}
        />
        
        {/* 缩略图容器，添加 padding 以对齐标尺，确保从时间0开始显示 */}
        <div
          className="relative h-full px-4"
          style={{ width: `${timelineWidth + 32}px`, minHeight: "100%" }}
        >
          {frames.map((frame, index) => {
            // 动态计算帧宽度：根据视频总时长和帧数量
            // 例如：5秒视频，11张缩略图，每张宽度 = (5 * pixelsPerSecond) / 11
            const frameWidth = timelineWidth / frames.length;
            // 计算帧的左边位置：根据时间戳计算，加上 padding 以对齐到时间轴刻度
            const frameLeft = frame.timestamp * pixelsPerSecond + 16; // 加上 padding (px-4 = 16px)
            const isSelected = selectedFrameIndex === index;
            const isCurrentFrame =
              currentTime >= frame.timestamp &&
              (index === frames.length - 1 || currentTime < frames[index + 1].timestamp);

            return (
              <div
                key={index}
                className={`absolute flex-shrink-0 cursor-pointer rounded border-2 transition-all ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => onFrameSelect(index)}
                style={{
                  left: `${frameLeft}px`,
                  width: `${frameWidth}px`,
                  height: "53px", // 再缩小三分之一：80px * 2/3 ≈ 53px
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                <img
                  src={frame.url}
                  alt={`Frame ${index}`}
                  className="w-full h-full object-cover rounded"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

