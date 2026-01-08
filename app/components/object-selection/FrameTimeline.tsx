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
  const [containerWidthPx, setContainerWidthPx] = useState(0);
  
  // Calculate actual pixels per second based on zoom
  const pixelsPerSecond = basePixelsPerSecond * zoomLevel;
  const timelineWidth = duration * pixelsPerSecond;

  // 同步当前时间到标尺位置
  // 如果选择了帧，优先使用选中帧的中心位置；否则使用currentTime
  useEffect(() => {
    if (selectedFrameIndex !== null && frames.length > 0 && selectedFrameIndex < frames.length) {
      // 如果选择了帧，使用该帧的中心位置
      const effectiveWidth = Math.max(timelineWidth, containerWidthPx || timelineWidth);
      const frameWidth = effectiveWidth / frames.length;
      const frameLeft = selectedFrameIndex * frameWidth;
      const frameCenter = frameLeft + frameWidth / 2;
      // 竖线应该指向帧的中心，加上padding (16px)
      setRulerPositionPx(frameCenter + 16);
    } else if (frames.length > 0) {
      // 如果currentTime接近或等于视频时长，使用最后一帧的中心位置
      const lastFrame = frames[frames.length - 1];
      const duration = frames.length > 0 ? lastFrame.timestamp : 0;
      // 检查是否播放完成（currentTime 接近或等于视频时长）
      if (currentTime >= duration - 0.1 && duration > 0) {
        // 使用最后一帧的中心位置
        const effectiveWidth = Math.max(timelineWidth, containerWidthPx || timelineWidth);
        const frameWidth = effectiveWidth / frames.length;
        const frameLeft = (frames.length - 1) * frameWidth;
        const frameCenter = frameLeft + frameWidth / 2;
        setRulerPositionPx(frameCenter + 16);
      } else {
        // 否则使用currentTime计算位置，加上padding (16px)
        setRulerPositionPx(currentTime * pixelsPerSecond + 16);
      }
    } else {
      // 如果没有帧，使用currentTime计算位置，加上padding (16px)
      setRulerPositionPx(currentTime * pixelsPerSecond + 16);
    }
  }, [currentTime, pixelsPerSecond, selectedFrameIndex, frames, timelineWidth, containerWidthPx]);

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

  // 记录容器宽度，确保初始缩略图填满可视区域
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidthPx(containerRef.current.clientWidth);
      }
    };
    updateContainerWidth();
    window.addEventListener("resize", updateContainerWidth);
    return () => window.removeEventListener("resize", updateContainerWidth);
  }, [frames.length, timelineWidth]);

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
          rulerPositionPx={rulerPositionPx - 16}
          containerRef={containerRef}
          onRulerDrag={(newPositionPx) => handleRulerDrag(newPositionPx + 16)}
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
        {/* 当前时间竖线 - 贯穿整个时间轴，对齐到标尺游标箭头中心，使用黑色 */}
        {/* 竖线需要与游标图标下面箭头的中心对齐：
            - 游标图标使用 translateX(-50%) 居中，所以箭头中心在 rulerPositionPx
            - 竖线也使用 translateX(-50%) 来居中对齐，确保中心与游标箭头中心对齐 */}
        {/* 确保竖线始终可见，即使视频播放完成 */}
        {(currentTime > 0 || selectedFrameIndex !== null) && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-black pointer-events-none z-20"
            style={{
              left: `${rulerPositionPx}px`, // 与游标图标使用相同的位置
              transform: "translateX(-50%)", // 使用transform来精确居中对齐，与游标图标保持一致
            }}
          />
        )}
        
        {/* 缩略图容器，添加 padding 以对齐标尺，确保从时间0开始显示 */}
        <div
          className="relative h-full px-4"
          style={{ width: `${Math.max(timelineWidth, containerWidthPx || timelineWidth) + 32}px`, minHeight: "100%" }}
        >
          {frames.map((frame, index) => {
            // 计算每个缩略图的宽度，使总宽度等于时间轴宽度（或容器宽度）
            const effectiveWidth = Math.max(timelineWidth, containerWidthPx || timelineWidth);
            const frameWidth = effectiveWidth / frames.length;
            // 等分定位，使缩略图填满整个时间轴
            // 帧的中心位置 = frameLeft + frameWidth / 2
            const frameLeft = index * frameWidth + 16; // 加上 padding (px-4 = 16px)
            const frameCenter = frameLeft + frameWidth / 2;
            const isSelected = selectedFrameIndex === index;
            const isCurrentFrame =
              currentTime >= frame.timestamp &&
              (index === frames.length - 1 || currentTime < frames[index + 1].timestamp);

            return (
              <div
                key={index}
                className={`absolute flex-shrink-0 cursor-pointer transition-all ${
                  isSelected
                    ? "ring-2 ring-primary ring-offset-1"
                    : ""
                }`}
                onClick={() => onFrameSelect(index)}
                style={{
                  left: `${frameLeft}px`,
                  width: `${frameWidth}px`,
                  height: "53px",
                  top: "50%",
                  transform: `translateY(-50%) scale(${isSelected ? 1.33 : 1})`,
                  transformOrigin: "center",
                  zIndex: isSelected ? 30 : 10,
                  // 确保选中的缩略图边框完整可见，不被其他元素遮挡
                  position: "absolute",
                }}
              >
                <img
                  src={frame.url}
                  alt={`Frame ${index}`}
                  className="w-full h-full object-cover rounded-sm"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

