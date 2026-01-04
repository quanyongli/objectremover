import crypto from "crypto";
import { getSupabaseClient, queryWithFallback, getDirectDbPool } from "./supabase.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectRecord = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export async function createProject(params: {
  userId: string;
  name: string;
}): Promise<ProjectRecord> {
  return queryWithFallback(
    async (supabase: SupabaseClient) => {
      const id = crypto.randomUUID();
      const { data, error } = await supabase
        .from("projects")
        .insert({
          id,
          user_id: params.userId,
          name: params.name,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ProjectRecord;
    },
    async () => {
      const pool = getDirectDbPool();
      const client = await pool.connect();
      try {
        const id = crypto.randomUUID();
        const { rows } = await client.query<ProjectRecord>(
          `insert into projects (id, user_id, name) values ($1,$2,$3) returning *`,
          [id, params.userId, params.name]
        );
        return rows[0];
      } finally {
        client.release();
      }
    }
  );
}

export async function listProjectsByUser(
  userId: string
): Promise<ProjectRecord[]> {
  return queryWithFallback(
    async (supabase: SupabaseClient) => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as ProjectRecord[];
    },
    async () => {
      const pool = getDirectDbPool();
      const client = await pool.connect();
      try {
        const { rows } = await client.query<ProjectRecord>(
          `select * from projects where user_id = $1 order by created_at desc`,
          [userId]
        );
        return rows;
      } finally {
        client.release();
      }
    }
  );
}

export async function getProjectById(
  id: string
): Promise<ProjectRecord | null> {
  return queryWithFallback(
    async (supabase: SupabaseClient) => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        throw error;
      }
      return data as ProjectRecord;
    },
    async () => {
      const pool = getDirectDbPool();
      const client = await pool.connect();
      try {
        const { rows } = await client.query<ProjectRecord>(
          `select * from projects where id = $1`,
          [id]
        );
        return rows[0] ?? null;
      } finally {
        client.release();
      }
    }
  );
}

export async function deleteProjectById(
  id: string,
  userId: string
): Promise<boolean> {
  return queryWithFallback(
    async (supabase: SupabaseClient) => {
      const { error, count } = await supabase
        .from("projects")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
      return (count || 0) > 0;
    },
    async () => {
      const pool = getDirectDbPool();
      const client = await pool.connect();
      try {
        const { rowCount } = await client.query(
          `delete from projects where id = $1 and user_id = $2`,
          [id, userId]
        );
        return (rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    }
  );
}
