-- Tasks table for video processing tasks
create table if not exists tasks (
  id text primary key,
  user_id text not null,
  asset_id text not null,
  action text not null check (action in ('remove', 'extract')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  mask_url text null,
  output_url text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create indexes for better query performance
create index if not exists idx_tasks_user_id on tasks(user_id);
create index if not exists idx_tasks_user_id_status on tasks(user_id, status);
create index if not exists idx_tasks_user_id_created_at on tasks(user_id, created_at desc);
create index if not exists idx_tasks_asset_id on tasks(asset_id);
create index if not exists idx_tasks_status on tasks(status);

