import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message = "处理中...", className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4 rounded-lg bg-background/95 p-6 shadow-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
}

