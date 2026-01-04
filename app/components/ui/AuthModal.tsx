"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { DomesticAuth } from "./DomesticAuth";
import { InternationalAuth } from "./InternationalAuth";
import { useRegion } from "~/hooks/useRegion";
import { Button } from "~/components/ui/button";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess, onError }: AuthModalProps) {
  const region = useRegion();
  const [manualRegion, setManualRegion] = useState<"domestic" | "international" | null>(null);
  
  // 使用手动选择的地区，如果没有则使用自动检测
  const activeRegion = manualRegion || region;

  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {activeRegion === "domestic" ? "登录 / 注册" : "Sign In / Sign Up"}
          </DialogTitle>
          <DialogDescription>
            {activeRegion === "domestic"
              ? "请选择登录方式以继续使用 ObjectRemover"
              : "Choose your preferred sign-in method to continue using ObjectRemover"}
          </DialogDescription>
        </DialogHeader>

        {/* 地区切换按钮 */}
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setManualRegion(activeRegion === "domestic" ? "international" : "domestic");
            }}
            className="text-xs"
          >
            {activeRegion === "domestic" ? "Switch to English" : "切换到中文"}
          </Button>
        </div>

        {activeRegion === "domestic" ? (
          <DomesticAuth onSuccess={handleSuccess} onError={onError} />
        ) : (
          <InternationalAuth onSuccess={handleSuccess} onError={onError} />
        )}
      </DialogContent>
    </Dialog>
  );
}

