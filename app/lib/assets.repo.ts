import crypto from "crypto";
import { getSupabaseClient, queryWithFallback, getDirectDbPool } from "./supabase.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AssetRecord = {
  id: string;
  user_id: string;
  project_id: string | null;
  original_name: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
  deleted_at: string | null;
};

export async function insertAsset(params: {
  userId: string;
  projectId?: string | null;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}): Promise<AssetRecord> {
  return queryWithFallback(
    async (supabase: SupabaseClient) => {
      const id = crypto.randomUUID();
      const { data, error } = await supabase
        .from("assets")
        .insert({
          id,
          user_id: params.userId,
          project_id: params.projectId ?? null,
          original_name: params.originalName,
          storage_key: params.storageKey,
          mime_type: params.mimeType,
          size_bytes: params.sizeBytes,
          width: params.width ?? null,
          height: params.height ?? null,
          duration_seconds: params.durationSeconds ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as AssetRecord;
    },
    async () => {
      // 回退到直接数据库连接
      const pool = getDirectDbPool();
      const client = await pool.connect();
      try {
        const id = crypto.randomUUID();
        const { rows } = await client.query<AssetRecord>(
          `insert into assets (id, user_id, project_id, original_name, storage_key, mime_type, size_bytes, width, height, duration_seconds)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           returning *`,
          [
            id,
            params.userId,
            params.projectId ?? null,
            params.originalName,
            params.storageKey,
            params.mimeType,
            params.sizeBytes,
            params.width ?? null,
            params.height ?? null,
            params.durationSeconds ?? null,
          ]
        );
        return rows[0];
      } finally {
        client.release();
      }
    }
  );
}

export async function listAssetsByUser(
  userId: string,
  projectId: string | null
): Promise<AssetRecord[]> {
  return queryWithFallback(
    async (supabase: SupabaseClient) => {
      let query = supabase
        .from("assets")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (projectId === null) {
        query = query.is("project_id", null);
      } else {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AssetRecord[];
    },
    async () => {
      const pool = getDirectDbPool();
      const client = await pool.connect();
      try {
        const sql =
          projectId === null
            ? `select * from assets where user_id = $1 and project_id is null and deleted_at is null order by created_at desc`
            : `select * from assets where user_id = $1 and project_id = $2 and deleted_at is null order by created_at desc`;
        const params = projectId === null ? [userId] : [userId, projectId];
        const { rows } = await client.query<AssetRecord>(sql, params);
        return rows;
      } finally {
        client.release();
      }
    }
  );
}

export async function getAssetById(id: string): Promise<AssetRecord | null> {
  return queryWithFallback(
    async (supabase: SupabaseClient) => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned
          return null;
        }
        throw error;
      }
      return data as AssetRecord;
    },
    async () => {
      const pool = getDirectDbPool();
      const client = await pool.connect();
      try {
        const { rows } = await client.query<AssetRecord>(
          `select * from assets where id = $1 and deleted_at is null`,
          [id]
        );
        return rows[0] ?? null;
      } finally {
        client.release();
      }
    }
  );
}

export async function softDeleteAsset(
  id: string,
  userId: string
): Promise<void> {
  return queryWithFallback(
    async (supabase: SupabaseClient) => {
      const { error } = await supabase
        .from("assets")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (error) throw error;
    },
    async () => {
      const pool = getDirectDbPool();
      const client = await pool.connect();
      try {
        await client.query(
          `update assets set deleted_at = now() where id = $1 and user_id = $2 and deleted_at is null`,
          [id, userId]
        );
      } finally {
        client.release();
      }
    }
  );
}
