import React from "react";

interface MaskOverlayProps {
  maskData: string; // base64 image data
  videoWidth: number;
  videoHeight: number;
  opacity?: number;
}

export function MaskOverlay({
  maskData,
  videoWidth,
  videoHeight,
  opacity = 0.5,
}: MaskOverlayProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={maskData}
        alt="Mask overlay"
        className="max-w-full max-h-full object-contain"
        style={{
          opacity,
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}
