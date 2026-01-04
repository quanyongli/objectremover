-- 001_assets_simple.sql - Assets table (Transaction mode compatible)

-- Consolidated migration: assets table with project support
create table if not exists assets (
  id uuid primary key,
  user_id text not null,
  original_name text not null,
  storage_key text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width int null,
  height int null,
  duration_seconds double precision null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- Ensure columns for evolving installs
alter table assets add column if not exists project_id text null;

-- Ensure user_id has type text
-- Note: Type conversion is skipped in Transaction mode as it requires DO blocks
-- If user_id column exists with wrong type, it will need to be fixed manually

create index if not exists idx_assets_user_id_created_at on assets(user_id, created_at desc);
create index if not exists idx_assets_user_project on assets(user_id, project_id, created_at desc);
create unique index if not exists idx_assets_user_storage_key on assets(user_id, storage_key);

