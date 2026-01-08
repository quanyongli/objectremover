import React from "react";

interface SimpleTimelineRulerProps {
  timelineWidth: number;
  rulerPositionPx: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onRulerDrag: (newPositionPx: number) => void;
  onRulerMouseDown: (e: React.MouseEvent) => void;
  pixelsPerSecond: number;
  scrollLeft: number;
}

export const SimpleTimelineRuler: React.FC<SimpleTimelineRulerProps> = ({
  timelineWidth,
  rulerPositionPx,
  containerRef,
  onRulerDrag,
  onRulerMouseDown,
  pixelsPerSecond,
  scrollLeft,
}) => {
  // 格式化时间显示（模仿剪映样式：00:00:02:17）
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

  // rulerPositionPx 是相对于标尺内容区域的位置（不包含padding）
  const currentTimeInSeconds = rulerPositionPx / pixelsPerSecond;

  return (
    <div className="flex flex-shrink-0 h-6 border-b border-border/30 bg-muted/40">
      {/* Timeline Ruler - 无时间框，直接显示标尺 */}
      <div
        className="bg-gradient-to-b from-muted/60 to-muted/40 cursor-pointer relative z-20 flex-1 overflow-hidden"
        style={{ height: "24px" }}>
        <div
          className="absolute top-0 left-0 h-full"
          style={{
            width: `${timelineWidth}px`,
            transform: `translateX(-${scrollLeft}px)`,
          }}
          // 禁用点击选择功能
          // onClick={(e) => {
          //   if (containerRef.current) {
          //     const rulerRect = e.currentTarget.getBoundingClientRect();
          //     const clickXInRuler = e.clientX - rulerRect.left;
          //     onRulerDrag(clickXInRuler);
          //   }
          // }}
        >
          {/* 主要刻度标记 */}
          {(() => {
            const elements: React.ReactNode[] = [];
            const majorSeconds = 5; // 每5秒一个主刻度
            const count = Math.floor(timelineWidth / (majorSeconds * pixelsPerSecond)) + 1;
            for (let tick = 0; tick < count; tick++) {
              const timeValue = tick * majorSeconds;
              const x = tick * majorSeconds * pixelsPerSecond;
              elements.push(
                <div
                  key={`major-${tick}`}
                  className="absolute top-0 h-full flex flex-col justify-end pointer-events-none"
                  style={{ left: `${x}px` }}>
                  <div className="w-px bg-border h-4" />
                </div>,
              );
            }
            return elements;
          })()}

          {/* 次要刻度标记（每秒） */}
          {(() => {
            const elements: React.ReactNode[] = [];
            const count = Math.floor(timelineWidth / pixelsPerSecond) + 1;
            for (let tick = 0; tick < count; tick++) {
              const x = tick * pixelsPerSecond;
              // 跳过主刻度
              if (tick % 5 === 0) continue;
              elements.push(
                <div
                  key={`minor-${tick}`}
                  className="absolute top-0 h-full flex flex-col justify-end pointer-events-none"
                  style={{ left: `${x}px` }}>
                  <div className="w-px bg-border/50 h-2" />
                </div>,
              );
            }
            return elements;
          })()}

          {/* 游标图标 - 使用提供的 cursor.png (16x24，高度与时间框保持一致) */}
          <img
            src="/cursor.png"
            alt="Timeline cursor"
            className="absolute cursor-grab hover:cursor-grabbing z-30 pointer-events-auto"
            style={{
              left: `${rulerPositionPx}px`,
              top: "0px",
              width: "16px",
              height: "24px",
              transform: "translateX(-50%)",
              imageRendering: "crisp-edges",
            }}
            onMouseDown={onRulerMouseDown}
            title="Drag to seek"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};


