import { queryWithFallback, getDirectDbPool } from "~/lib/supabase.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Task {
  id: string;
  user_id: string;
  asset_id: string;
  action: "remove" | "extract";
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  mask_url?: string;
  output_url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export async function createTask(task: Omit<Task, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<Task> {
  // 生成任务 ID（如果未提供，使用传入的 id，否则生成新的）
  const taskId = task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  return queryWithFallback(
    async (supabase: SupabaseClient) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          id: taskId,
          user_id: task.user_id,
          asset_id: task.asset_id,
          action: task.action,
          status: task.status,
          progress: task.progress,
          mask_url: task.mask_url,
          output_url: task.output_url,
          error_message: task.error_message,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Task;
    },
    async () => {
      // 回退到直接数据库连接
      const pool = getDirectDbPool();
      const client = await pool.connect();
      try {
        const { rows } = await client.query<Task>(
          `insert into tasks (id, user_id, asset_id, action, status, progress, mask_url, output_url, error_message, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           returning *`,
          [
            taskId,
            task.user_id,
            task.asset_id,
            task.action,
            task.status,
            task.progress,
            task.mask_url || null,
            task.output_url || null,
            task.error_message || null,
            now,
            now,
          ]
        );
        return rows[0];
      } catch (error: any) {
        // 如果表不存在，返回内存中的任务对象
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          console.warn("⚠️ Tasks table does not exist, returning in-memory task");
          return {
            id: taskId,
            ...task,
            created_at: now,
            updated_at: now,
          } as Task;
        }
        throw error;
      } finally {
        client.release();
      }
    }
  );
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const now = new Date().toISOString();
  
  return queryWithFallback(
    async (supabase: SupabaseClient) => {
      const { data, error } = await supabase
        .from("tasks")
        .update({
          ...updates,
          updated_at: now,
        })
        .eq("id", taskId)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }
      return data as Task;
    },
    async () => {
      // 回退到直接数据库连接
      const pool = getDirectDbPool();
      const client = await pool.connect();
      try {
        const updateFields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.status !== undefined) {
          updateFields.push(`status = $${paramIndex++}`);
          values.push(updates.status);
        }
        if (updates.progress !== undefined) {
          updateFields.push(`progress = $${paramIndex++}`);
          values.push(updates.progress);
        }
        if (updates.mask_url !== undefined) {
          updateFields.push(`mask_url = $${paramIndex++}`);
          values.push(updates.mask_url);
        }
        if (updates.output_url !== undefined) {
          updateFields.push(`output_url = $${paramIndex++}`);
          values.push(updates.output_url);
        }
        if (updates.error_message !== undefined) {
          updateFields.push(`error_message = $${paramIndex++}`);
          values.push(updates.error_message);
        }

        updateFields.push(`updated_at = $${paramIndex++}`);
        values.push(now);

        values.push(taskId); // taskId 作为最后一个参数

        const { rows } = await client.query<Task>(
          `update tasks set ${updateFields.join(", ")} where id = $${paramIndex} returning *`,
          values
        );
        return rows[0] || null;
      } catch (error: any) {
        // 如果表不存在，返回 null（任务状态无法持久化）
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          console.warn("⚠️ Tasks table does not exist, task updates will not be persisted");
          return null;
        }
        throw error;
      } finally {
        client.release();
      }
    }
  );
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  return queryWithFallback(
    async (supabase: SupabaseClient) => {
      const { data, error } = await supabase
        .from("tasks")
        .select()
        .eq("id", taskId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }
      return data as Task;
    },
    async () => {
      // 回退到直接数据库连接
      const pool = getDirectDbPool();
      const client = await pool.connect();
      try {
        const { rows } = await client.query<Task>(
          `select * from tasks where id = $1`,
          [taskId]
        );
        return rows[0] || null;
      } catch (error: any) {
        // 如果表不存在，返回 null
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          console.warn("⚠️ Tasks table does not exist");
          return null;
        }
        throw error;
      } finally {
        client.release();
      }
    }
  );
}

