import type { Route } from "./+types/api.auth.login-sms";
import { Pool } from "pg";
import { auth } from "~/lib/auth.server";
import jwt from "jsonwebtoken";

/**
 * 短信验证码登录 API
 * 需要数据库表：
 * - sms_codes 表（存储验证码）
 * - users 表（Better Auth 会创建，但我们可能需要扩展）
 */

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || "your_jwt_secret_key_here";

// 获取数据库连接池
// 获取数据库连接池（单例模式，避免连接泄漏）
let dbPool: Pool | null = null;

function getDbPool(): Pool {
  if (!dbPool) {
    const rawDbUrl = process.env.DATABASE_URL;
    if (!rawDbUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    // Process connection string (same logic as auth.server.ts)
    let connectionString = rawDbUrl;
    try {
      const u = new URL(rawDbUrl);
      // For Transaction mode (port 6543), keep query params if present
      // For Direct connection (port 5432), strip query params
      const port = u.port || (u.protocol === 'postgresql:' || u.protocol === 'postgres:' ? '5432' : '');
      if (port === '6543' || port === '5432') {
        // Transaction mode or Session mode - keep query params (like pgbouncer=true)
        connectionString = rawDbUrl;
      } else {
        // Direct connection - strip query params
        u.search = "";
        connectionString = u.toString();
      }
    } catch {
      // keep as-is if URL parsing fails
      connectionString = rawDbUrl;
    }
    
    dbPool = new Pool({
      connectionString,
      ssl: connectionString.includes('supabase.co') 
        ? { rejectUnauthorized: false }
        : process.env.NODE_ENV === "production" 
          ? { rejectUnauthorized: true }
          : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 60000, // Increased to 60 seconds
      connectionTimeoutMillis: 60000, // Increased to 60 seconds for Transaction mode
      allowExitOnIdle: false,
    });
    
    // Handle pool errors
    dbPool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }
  return dbPool;
}

// 获取客户端IP地址
function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

export async function action({ request }: Route.ActionArgs) {
  const pool = getDbPool();

  try {
    const { phoneNumber, verificationCode } = await request.json();

    // 1. 验证输入
    if (!phoneNumber || !verificationCode) {
      return Response.json(
        { success: false, message: "请填写完整信息" },
        { status: 400 }
      );
    }

    // 2. 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      return Response.json(
        { success: false, message: "请输入有效的手机号码" },
        { status: 400 }
      );
    }

    // 3. 验证验证码（只查询未使用且未过期的验证码）
    const codeResult = await pool.query(
      `SELECT code, expires_at, used FROM sms_codes 
       WHERE phone_number = $1 
       AND used = false
       AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phoneNumber]
    );

    if (codeResult.rows.length === 0) {
      return Response.json(
        { success: false, message: "请先获取验证码" },
        { status: 400 }
      );
    }

    const { code: storedCode, expires_at, used } = codeResult.rows[0];

    if (used) {
      return Response.json(
        { success: false, message: "验证码已使用，请重新获取" },
        { status: 400 }
      );
    }

    if (new Date(expires_at) < new Date()) {
      return Response.json(
        { success: false, message: "验证码已过期" },
        { status: 400 }
      );
    }

    if (storedCode !== verificationCode) {
      return Response.json(
        { success: false, message: "验证码错误" },
        { status: 400 }
      );
    }

    // 4. 标记验证码为已使用
    await pool.query(
      `UPDATE sms_codes SET used = true WHERE phone_number = $1`,
      [phoneNumber]
    );

    // 5. 查找或创建用户
    // Better Auth 使用 "user" 表（带引号）
    let userResult = await pool.query(
      `SELECT id, phone_number FROM "user" WHERE phone_number = $1 LIMIT 1`,
      [phoneNumber]
    );

    let userId: string;

    if (userResult.rows.length === 0) {
      // 创建新用户
      // Better Auth 的 user 表需要 id, email 等字段
      // 对于手机号登录，我们使用手机号作为临时 email
      // 生成 UUID（Node.js 18+ 支持 crypto.randomUUID，否则使用其他方法）
      let userIdGenerated: string;
      try {
        const cryptoModule = await import('crypto');
        userIdGenerated = cryptoModule.randomUUID();
      } catch {
        // 降级方案：使用时间戳 + 随机数生成 ID
        userIdGenerated = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      await pool.query(
        `INSERT INTO "user" (id, email, phone_number, phone_verified, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, NOW(), NOW())`,
        [userIdGenerated, `${phoneNumber}@sms.user`, phoneNumber]
      );
      userId = userIdGenerated;
    } else {
      userId = userResult.rows[0].id;
      // 更新手机号验证状态
      await pool.query(
        `UPDATE "user" SET phone_verified = true, "updatedAt" = NOW() WHERE id = $1`,
        [userId]
      );
    }

    // 6. 生成 JWT token（临时方案，最好集成 Better Auth）
    const token = jwt.sign(
      { userId, phoneNumber },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    // 7. 也可以创建 Better Auth session（如果支持）
    // TODO: 集成 Better Auth session 创建逻辑

    return Response.json({
      success: true,
      message: "登录成功",
      token,
      user: {
        id: userId,
        phoneNumber,
      },
    });
  } catch (error: any) {
    console.error("短信登录API错误:", error);
    return Response.json(
      { success: false, message: error.message || "登录失败" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
