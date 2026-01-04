"use client";

import { useState, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Loader2 } from "lucide-react";

// 声明阿里云验证码的全局类型
declare global {
  interface Window {
    initAlicom4: (config: any, handler: any) => void;
    captchaObj: any;
  }
}

interface DomesticAuthProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function DomesticAuth({ onSuccess, onError }: DomesticAuthProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCaptchaReady, setIsCaptchaReady] = useState(false);
  const captchaObjRef = useRef<any>(null);
  const phoneNumberRef = useRef<string>("");
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    phoneNumberRef.current = phoneNumber;
  }, [phoneNumber]);

  // 加载和初始化验证码
  useEffect(() => {
    const initCaptcha = () => {
      if (captchaObjRef.current) return;
      
      // 从环境变量获取验证码ID（需要在Vercel环境变量中配置 PUBLIC_ALIYUN_CAPTCHA_ID）
      // 在客户端，需要通过构建时注入或通过API获取
      // 这里先使用硬编码的示例ID，实际使用时应该从环境变量或API获取
      const captchaId = "919644b07d79045d1237f419123f3ee9"; // TODO: 从环境变量或API获取

      if (!captchaId) {
        console.warn("阿里云验证码ID未配置");
        setIsCaptchaReady(false);
        return;
      }

      window.initAlicom4({
        captchaId: captchaId,
        product: "bind",
        language: "zh",
        protocol: "https://",
      }, (captchaObj: any) => {
        if (!mountedRef.current) return;
        captchaObjRef.current = captchaObj;

        captchaObj.onReady(() => {
          if (mountedRef.current) setIsCaptchaReady(true);
        });

        captchaObj.onSuccess(() => {
          const result = captchaObj.getValidate();
          sendCodeAfterCaptcha(result);
        });

        captchaObj.onFail(() => {
          if (mountedRef.current) setError("图形验证失败，请重试");
        });

        captchaObj.onError(() => {
          if (mountedRef.current) setError("验证码服务出错，请稍后重试");
        });

        captchaObj.onClose(() => {
          if (mountedRef.current) setIsLoading(false);
        });
      });
    };

    if (!window.initAlicom4) {
      const script = document.createElement("script");
      script.src = "/ct4.js"; // 阿里云验证码脚本
      script.async = true;
      document.head.appendChild(script);
      script.onload = () => {
        if (mountedRef.current) initCaptcha();
      };
      script.onerror = () => {
        if (mountedRef.current) {
          setError("图形验证码脚本加载失败");
          onError?.("图形验证码脚本加载失败");
        }
      };
    } else {
      initCaptcha();
    }

    return () => {
      // 清理工作
      if (captchaObjRef.current) {
        // captchaObjRef.current.destroy();
        // captchaObjRef.current = null;
      }
    };
  }, [onError]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);

  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  const sendCodeAfterCaptcha = async (captchaResult: any) => {
    const currentPhoneNumber = phoneNumberRef.current;
    if (!currentPhoneNumber) {
      setError("手机号不能为空");
      setIsLoading(false);
      return;
    }

    try {
      setError("");
      const response = await fetch("/api/auth/send-sms-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phoneNumber: currentPhoneNumber,
          captchaResult,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "发送验证码失败");
      }

      setCountdown(60);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "发送验证码失败";
      setError(errorMessage);
      captchaObjRef.current?.reset();
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!phoneNumber) {
      setError("请输入手机号");
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError("请输入有效的手机号码");
      return;
    }

    if (!isCaptchaReady) {
      setError("图形验证正在初始化，请稍候...");
      return;
    }

    setIsLoading(true);
    setError("");
    captchaObjRef.current?.showCaptcha();
  };

  const handleLogin = async () => {
    if (!phoneNumber || !verificationCode) {
      setError("请填写完整信息");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const response = await fetch("/api/auth/login-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phoneNumber,
          verificationCode,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "登录失败");
      }

      const data = await response.json();
      // 存储 token 等认证信息
      if (data.token) {
        localStorage.setItem("token", data.token);
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
        }
      }

      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "登录失败";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="phone">手机号</Label>
        <div className="flex items-center border rounded-md overflow-hidden mt-1">
          <div className="flex items-center px-4 py-2 bg-gray-50 dark:bg-gray-800 border-r">
            <span className="text-gray-700 dark:text-gray-300 font-medium">+86</span>
          </div>
          <Input
            id="phone"
            type="tel"
            placeholder="请输入手机号"
            className="flex-1 border-0"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="code">验证码</Label>
        <div className="flex gap-2 mt-1">
          <Input
            id="code"
            type="text"
            placeholder="请输入验证码"
            className="flex-1"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleSendCode}
            disabled={countdown > 0 || isLoading || !isCaptchaReady}
          >
            {countdown > 0 ? `${countdown}秒后重试` : "获取验证码"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      <Button
        className="w-full"
        onClick={handleLogin}
        disabled={!phoneNumber || !verificationCode || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            处理中...
          </>
        ) : (
          "登录"
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        未注册手机号将自动注册
      </p>
    </div>
  );
}

