import { cn } from "~/lib/utils";
import * as React from "react";

export function AnimatedGradientText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex animate-gradient bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#ec4899] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent",
        className
      )}
      style={
        {
          "--bg-size": "200%",
        } as React.CSSProperties
      }
    >
      {children}
    </span>
  );
}

