import type { Route } from "./+types/api.auth.region";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    // 获取客户端IP地址
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwardedFor?.split(",")[0] || realIp || "unknown";

    // 获取浏览器语言
    const acceptLanguage = request.headers.get("accept-language") || "";
    const lang = acceptLanguage.split(",")[0]?.toLowerCase() || "";

    // 简单的地区检测逻辑
    // 1. 检查语言
    let region: "domestic" | "international" = "international";
    if (lang.startsWith("zh") || lang.includes("cn")) {
      region = "domestic";
    }

    // 2. 如果有IP地址，可以调用第三方地理位置API（可选）
    // 例如：ipapi.co, ip-api.com 等
    // 这里先使用简单的语言检测

    return Response.json({ region, ip, lang });
  } catch (error) {
    console.error("地区检测错误:", error);
    // 默认返回国际用户
    return Response.json({ region: "international" });
  }
}




