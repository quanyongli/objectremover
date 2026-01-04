import type { Route } from "./+types/api.auth.sign-up.email";

/**
 * 邮箱注册 API
 * 使用 Better Auth 的邮箱密码注册
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

    // 2. 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { success: false, message: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // 3. 验证密码长度
    if (password.length < 6) {
      return Response.json(
        { success: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // 4. 使用 Better Auth 进行邮箱注册
    // TODO: 集成 Better Auth 的邮箱密码注册
    // const auth = await import("~/lib/auth.server").then(m => m.auth);
    // const result = await auth.api.signUpEmail({ body: { email, password } });

    // 临时返回（需要实现真实的 Better Auth 集成）
    return Response.json(
      { success: false, message: "Email registration not yet implemented. Please use Google OAuth for now." },
      { status: 501 }
    );
  } catch (error: any) {
    console.error("邮箱注册API错误:", error);
    return Response.json(
      { success: false, message: error.message || "Registration failed" },
      { status: 500 }
    );
  }
}




