-- Tasks table for video processing tasks
create table if not exists tasks (
  id text primary key,
  user_id text not null,
  asset_id text not null,
  action text not null,
  status text not null default 'pending',
  progress int not null default 0,
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

-- Add check constraints (if supported)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_action_check'
  ) then
    alter table tasks add constraint tasks_action_check check (action in ('remove', 'extract'));
  end if;
  
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_status_check'
  ) then
    alter table tasks add constraint tasks_status_check check (status in ('pending', 'processing', 'completed', 'failed'));
  end if;
  
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_progress_check'
  ) then
    alter table tasks add constraint tasks_progress_check check (progress >= 0 and progress <= 100);
  end if;
exception when others then
  -- Ignore errors if constraints already exist or not supported
  null;
end $$;

