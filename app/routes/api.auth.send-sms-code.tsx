import type { Route } from "./+types/api.auth.send-sms-code";
import { validateCaptcha } from "~/lib/captcha.service";
import { smsService } from "~/lib/sms.service";
import { Pool } from "pg";

/**
 * 发送短信验证码 API
 * 需要安装: pnpm add @alicloud/pop-core
 * 需要在 Vercel 环境变量中配置:
 * - ALICAPTCHA_APP_ID (或 PUBLIC_ALIYUN_CAPTCHA_ID)
 * - ALICAPTCHA_APP_KEY
 * - ALIYUN_ACCESS_KEY_ID (或 ALIBABA_CLOUD_ACCESS_KEY_ID)
 * - ALIYUN_ACCESS_KEY_SECRET (或 ALIBABA_CLOUD_ACCESS_KEY_SECRET)
 * - ALIYUN_SMS_SIGN_NAME (短信签名)
 * - ALIYUN_SMS_TEMPLATE_CODE (模板代码)
 * - DATABASE_URL (PostgreSQL 连接字符串)
 */

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

// 生成验证码
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function action({ request }: Route.ActionArgs) {
  const pool = getDbPool();
  
  try {
    const { phoneNumber, captchaResult } = await request.json();

    // 1. 验证图形验证码
    if (!captchaResult || !captchaResult.lot_number) {
      return Response.json(
        { success: false, message: "图形验证失败，请重试" },
        { status: 400 }
      );
    }

    const isCaptchaValid = await validateCaptcha(captchaResult);
    if (!isCaptchaValid) {
      return Response.json(
        { success: false, message: "图形验证失败，请重试" },
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

    // 3. 检查速率限制（1分钟内1次）
    const rateLimitCheck = await pool.query(
      `SELECT created_at FROM sms_codes 
       WHERE phone_number = $1 
       AND created_at > NOW() - INTERVAL '1 minute'
       ORDER BY created_at DESC LIMIT 1`,
      [phoneNumber]
    );

    if (rateLimitCheck.rows.length > 0) {
      return Response.json(
        { success: false, message: "发送过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    // 4. 生成验证码
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟有效期

    // 5. 存储验证码到数据库（删除旧记录，插入新记录）
    // 先删除该手机号的旧验证码（可选：保留历史记录时可以跳过）
    await pool.query(
      `DELETE FROM sms_codes WHERE phone_number = $1`,
      [phoneNumber]
    );
    // 插入新验证码
    await pool.query(
      `INSERT INTO sms_codes (phone_number, code, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [phoneNumber, code, expiresAt]
    );

    // 6. 发送短信验证码
    const smsResult = await smsService.sendVerificationCode(phoneNumber, code);

    if (!smsResult) {
      return Response.json(
        { success: false, message: "验证码发送失败，请稍后重试" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: "验证码发送成功",
    });
  } catch (error: any) {
    console.error("发送验证码API错误:", error);
    return Response.json(
      { success: false, message: error.message || "请求处理失败" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
