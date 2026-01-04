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
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    const supabase = getSupabaseClient();

    let tasks: any[] = [];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, type, status, video_url, output_video_url, credits_cost, progress, created_at, updated_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            // 表不存在，返回空数组
            tasks = [];
          } else {
            throw error;
          }
        } else {
          tasks = (data || []).map((row) => ({
            id: row.id,
            type: row.type || "remove",
            status: row.status || "pending",
            video_url: row.video_url || null,
            output_video_url: row.output_video_url || null,
            credits_cost: row.credits_cost ? Number(row.credits_cost) : null,
            progress: row.progress ? Number(row.progress) : null,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }));
        }
      } catch (error: any) {
        console.warn("⚠️ Supabase query failed, falling back to direct database:", error.message);
        // 回退到直接数据库查询
        const pool = getDirectDbPool();
        try {
          const result = await pool.query(
            `SELECT 
              id,
              type,
              status,
              video_url,
              output_video_url,
              credits_cost,
              progress,
              created_at,
              updated_at
            FROM tasks 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
          );

          tasks = result.rows.map((row) => ({
            id: row.id,
            type: row.type || "remove",
            status: row.status || "pending",
            video_url: row.video_url || null,
            output_video_url: row.output_video_url || null,
            credits_cost: row.credits_cost ? Number(row.credits_cost) : null,
            progress: row.progress ? Number(row.progress) : null,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }));
        } catch (dbError: any) {
          if (dbError.message?.includes("does not exist") || dbError.code === "42P01") {
            tasks = [];
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
          `SELECT 
            id,
            type,
            status,
            video_url,
            output_video_url,
            credits_cost,
            progress,
            created_at,
            updated_at
          FROM tasks 
          WHERE user_id = $1 
          ORDER BY created_at DESC 
          LIMIT $2 OFFSET $3`,
          [userId, limit, offset]
        );

        tasks = result.rows.map((row) => ({
          id: row.id,
          type: row.type || "remove",
          status: row.status || "pending",
          video_url: row.video_url || null,
          output_video_url: row.output_video_url || null,
          credits_cost: row.credits_cost ? Number(row.credits_cost) : null,
          progress: row.progress ? Number(row.progress) : null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
      } catch (error: any) {
        if (error.message?.includes("does not exist") || error.code === "42P01") {
          tasks = [];
        } else {
          throw error;
        }
      } finally {
        await pool.end().catch(() => {});
      }
    }

    return new Response(
      JSON.stringify({ tasks }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Failed to get tasks:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get tasks", tasks: [] }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
