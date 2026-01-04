import * as React from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { ArrowRight } from "lucide-react";

interface GradientBorderButtonProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode;
  showArrow?: boolean;
}

export function GradientBorderButton({
  children,
  className,
  showArrow = true,
  ...props
}: GradientBorderButtonProps) {
  return (
    <Button
      className={cn(
        "relative h-12 px-8 text-base font-semibold overflow-hidden",
        "bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#ec4899]",
        "hover:opacity-90 transition-opacity",
        className
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center gap-2">
        {children}
        {showArrow && <ArrowRight className="w-4 h-4" />}
      </span>
    </Button>
  );
}

