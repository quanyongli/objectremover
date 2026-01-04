import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";

// 创建 Supabase 客户端
// 优先使用 SUPABASE_URL 和 SUPABASE_ANON_KEY 或 SUPABASE_SERVICE_ROLE_KEY
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️ SUPABASE_URL or SUPABASE_KEY not set, Supabase client unavailable");
    return null;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: "public",
      },
      global: {
        headers: {
          "x-client-info": "objectremover-server",
        },
      },
    });

    console.log("✅ Supabase client initialized");
    return supabaseClient;
  } catch (error) {
    console.error("❌ Failed to create Supabase client:", error);
    return null;
  }
}

// 回退到直接数据库连接的辅助函数
function getDirectDbPool(): Pool {
  const rawDbUrl = process.env.DATABASE_URL || "";
  let connectionString = rawDbUrl;
  try {
    const u = new URL(rawDbUrl);
    const port = u.port || (u.protocol === 'postgresql:' || u.protocol === 'postgres:' ? '5432' : '');
    if (port === '6543' || port === '5432') {
      connectionString = rawDbUrl;
    } else {
      u.search = "";
      connectionString = u.toString();
    }
  } catch {
    connectionString = rawDbUrl;
  }

  return new Pool({
    connectionString,
    ssl: connectionString.includes('supabase.co')
      ? { rejectUnauthorized: false }
      : process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 60000,
    allowExitOnIdle: false,
  });
}

// 带回退的查询函数
export async function queryWithFallback<T>(
  queryFn: (supabase: SupabaseClient) => Promise<T>,
  fallbackFn: () => Promise<T>
): Promise<T> {
  const client = getSupabaseClient();
  if (client) {
    try {
      return await queryFn(client);
    } catch (error: any) {
      console.warn("⚠️ Supabase query failed, falling back to direct database:", error.message);
      return await fallbackFn();
    }
  }
  return await fallbackFn();
}

// 导出直接数据库连接（用于需要 Pool 的场景，如 Better Auth）
export { getDirectDbPool };

