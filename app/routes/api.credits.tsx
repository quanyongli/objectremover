import { auth } from "~/lib/auth.server";
import { getSupabaseClient, getDirectDbPool } from "~/lib/supabase.server";

async function requireUserId(request: Request): Promise<string> {
  try {
    const session = await auth.api?.getSession?.({ headers: request.headers });
    const uid: string | undefined = session?.user?.id || session?.session?.userId;
    if (uid) return String(uid);
  } catch {
    console.error("Failed to get session");
  }
  throw new Response("Unauthorized", { status: 401 });
}

export async function loader({ request }: { request: Request }) {
  try {
    const userId = await requireUserId(request);
    const supabase = getSupabaseClient();

    let balance = 0;

    if (supabase) {
      try {
        // 尝试从 Supabase 获取 credits
        const { data, error } = await supabase
          .from("credits")
          .select("balance")
          .eq("user_id", userId)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            // 没有记录，创建默认记录
            const { error: insertError } = await supabase
              .from("credits")
              .insert({ user_id: userId, balance: 0 })
              .select()
              .single();

            if (insertError && insertError.code !== "23505") {
              // 23505 是唯一约束冲突，说明记录已存在，可以忽略
              throw insertError;
            }
            balance = 0;
          } else {
            throw error;
          }
        } else {
          balance = Number(data?.balance) || 0;
        }
      } catch (error: any) {
        console.warn("⚠️ Supabase query failed, falling back to direct database:", error.message);
        // 回退到直接数据库查询
        const pool = getDirectDbPool();
        try {
          const result = await pool.query(
            `SELECT balance FROM credits WHERE user_id = $1`,
            [userId]
          );

          if (result.rows.length > 0) {
            balance = Number(result.rows[0].balance) || 0;
          } else {
            // 创建默认记录
            await pool.query(
              `INSERT INTO credits (user_id, balance) VALUES ($1, $2) 
               ON CONFLICT (user_id) DO NOTHING`,
              [userId, 0]
            );
            balance = 0;
          }
        } catch (dbError: any) {
          if (dbError.message?.includes("does not exist") || dbError.code === "42P01") {
            // 表不存在，返回默认值
            balance = 0;
          } else {
            throw dbError;
          }
        } finally {
          await pool.end().catch(() => {});
        }
      }
    } else {
      // 直接使用数据库连接
      const pool = getDirectDbPool();
      try {
        const result = await pool.query(
          `SELECT balance FROM credits WHERE user_id = $1`,
          [userId]
        );

        if (result.rows.length > 0) {
          balance = Number(result.rows[0].balance) || 0;
        } else {
          await pool.query(
            `INSERT INTO credits (user_id, balance) VALUES ($1, $2) 
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, 0]
          );
          balance = 0;
        }
      } catch (error: any) {
        if (error.message?.includes("does not exist") || error.code === "42P01") {
          balance = 0;
        } else {
          throw error;
        }
      } finally {
        await pool.end().catch(() => {});
      }
    }

    return new Response(
      JSON.stringify({ balance }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Failed to get credits:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get credits", balance: 0 }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
