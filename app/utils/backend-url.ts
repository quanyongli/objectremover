/**
 * 后端服务 URL 配置
 * 支持通过环境变量配置，用于 ngrok 等场景
 */

/**
 * 获取后端服务的公共 URL
 * 优先使用环境变量，如果没有则使用 localhost
 */
export function getBackendPublicUrl(): string {
  // 在客户端，使用 import.meta.env
  if (typeof window !== "undefined") {
    return import.meta.env.VITE_BACKEND_PUBLIC_URL || "http://localhost:8000";
  }
  
  // 在服务器端，使用 process.env
  if (typeof process !== "undefined") {
    return process.env.BACKEND_PUBLIC_URL || process.env.VITE_BACKEND_PUBLIC_URL || "http://localhost:8000";
  }
  
  return "http://localhost:8000";
}

/**
 * 获取后端服务的本地 URL（用于服务器端内部调用）
 */
export function getBackendLocalUrl(): string {
  return "http://localhost:8000";
}

