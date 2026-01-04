import { getSupabaseClient, getDirectDbPool } from "~/lib/supabase.server";

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

export async function createTask(task: Omit<Task, "id" | "created_at" | "updated_at">): Promise<Task> {
  const { supabase, fallback } = await getSupabaseClient();
  
  // 生成任务 ID
  const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const result = await fallback(async () => {
    try {
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
      return data;
    } catch (error: any) {
      // 如果表不存在，返回内存中的任务对象
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return {
          id: taskId,
          ...task,
          created_at: now,
          updated_at: now,
        } as Task;
      }
      throw error;
    }
  });

  return result as Task;
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const { supabase, fallback } = await getSupabaseClient();
  
  const result = await fallback(async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      // 如果表不存在，返回 null（任务状态无法持久化）
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("Tasks table does not exist, task updates will not be persisted");
        return null;
      }
      throw error;
    }
  });

  return result as Task | null;
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const { supabase, fallback } = await getSupabaseClient();
  
  const result = await fallback(async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select()
        .eq("id", taskId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }
      return data;
    } catch (error: any) {
      // 如果表不存在，返回 null
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("Tasks table does not exist");
        return null;
      }
      throw error;
    }
  });

  return result as Task | null;
}

