import type { Route } from "./+types/api.auth.sign-in.email";

/**
 * 邮箱密码登录 API
 * 使用 Better Auth 的邮箱密码认证
 */

export async function action({ request }: Route.ActionArgs) {
  try {
    const { email, password } = await request.json();

    // 1. 验证输入
    if (!email || !password) {
      return Response.json(
        { success: false, message: "Please fill in all fields" },
        { status: 400 }
      );
    }

    // 2. 使用 Better Auth 进行邮箱密码登录
    // TODO: 集成 Better Auth 的邮箱密码认证
    // const auth = await import("~/lib/auth.server").then(m => m.auth);
    // const result = await auth.api.signInEmail({ body: { email, password } });

    // 临时返回（需要实现真实的 Better Auth 集成）
    return Response.json(
      { success: false, message: "Email authentication not yet implemented. Please use Google OAuth for now." },
      { status: 501 }
    );
  } catch (error: any) {
    console.error("邮箱登录API错误:", error);
    return Response.json(
      { success: false, message: error.message || "Login failed" },
      { status: 500 }
    );
  }
}




