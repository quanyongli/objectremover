-- 000_init_simple.sql - initial auth tables (Transaction mode compatible)
-- This version removes DO blocks which are not supported in Transaction mode

-- Users table
-- Note: Column names use double quotes to preserve camelCase for Better Auth compatibility
create table if not exists "user" (
  id text primary key,
  name text null,
  email text unique not null,
  "emailVerified" boolean default false not null,
  image text null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- Sessions table
-- Note: Column names use double quotes to preserve camelCase for Better Auth compatibility
create table if not exists session (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text unique not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text null,
  "userAgent" text null,
  "userId" text not null references "user"(id) on delete cascade
);
create index if not exists idx_session_userId on session("userId");
create index if not exists idx_session_token on session(token);

-- Accounts table
-- Note: Column names use double quotes to preserve camelCase for Better Auth compatibility
create table if not exists account (
  id text primary key,
  "accountId" text null,
  "providerId" text null,
  "userId" text not null references "user"(id) on delete cascade,
  "accessToken" text null,
  "refreshToken" text null,
  "idToken" text null,
  "accessTokenExpiresAt" timestamptz null,
  "refreshTokenExpiresAt" timestamptz null,
  scope text null,
  password text null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists idx_account_userId on account("userId");

-- Verification table
-- Note: Column names use double quotes to preserve camelCase for Better Auth compatibility
create table if not exists verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- Create function for auto-updating updatedAt (simplified, without DO block)
-- Note: This will fail if function already exists, but that's OK
create or replace function set_updated_at() returns trigger as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers (simplified, without DO blocks)
-- These will fail if triggers already exist, but that's OK for idempotent migrations
drop trigger if exists trg_user_updated_at on "user";
create trigger trg_user_updated_at before update on "user"
for each row execute function set_updated_at();

drop trigger if exists trg_session_updated_at on session;
create trigger trg_session_updated_at before update on session
for each row execute function set_updated_at();

drop trigger if exists trg_account_updated_at on account;
create trigger trg_account_updated_at before update on account
for each row execute function set_updated_at();

drop trigger if exists trg_verification_updated_at on verification;
create trigger trg_verification_updated_at before update on verification
for each row execute function set_updated_at();

