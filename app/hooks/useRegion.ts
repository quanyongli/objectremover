import { useState, useEffect } from "react";

export type UserRegion = "domestic" | "international";

export function useRegion(): UserRegion {
  const [region, setRegion] = useState<UserRegion>("international");

  useEffect(() => {
    // 方法1: 基于浏览器语言和时区
    const detectByBrowser = (): UserRegion => {
      const lang = navigator.language.toLowerCase();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // 检查是否为中文环境
      if (lang.startsWith("zh") || lang.includes("cn")) {
        return "domestic";
      }
      
      // 检查时区（中国时区）
      if (timezone.includes("Shanghai") || timezone.includes("Beijing") || timezone === "Asia/Shanghai") {
        return "domestic";
      }
      
      return "international";
    };

    // 方法2: 调用后端API获取精确地理位置（推荐）
    const detectByAPI = async () => {
      try {
        const response = await fetch("/api/auth/region", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (response.ok) {
          const data = await response.json();
          setRegion(data.region || detectByBrowser());
        } else {
          setRegion(detectByBrowser());
        }
      } catch (error) {
        // Silently fall back to browser detection
        console.debug("Region API not available, using browser detection");
        setRegion(detectByBrowser());
      }
    };

    detectByAPI();
  }, []);

  return region;
}

