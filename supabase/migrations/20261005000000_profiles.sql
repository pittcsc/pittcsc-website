-- CRM records are private to the Go API. Supabase Auth remains the identity owner.
create schema if not exists csc;
revoke all on schema csc from public, anon, authenticated;

create table csc.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  preferred_name text,
  graduation_year integer,
  majors text[] not null default '{}',
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended')),
  resume_asset_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (first_name is null or (char_length(first_name) between 1 and 100 and first_name = btrim(first_name))),
  check (last_name is null or (char_length(last_name) between 1 and 100 and last_name = btrim(last_name))),
  check (preferred_name is null or (char_length(preferred_name) between 1 and 100 and preferred_name = btrim(preferred_name))),
  check (graduation_year is null or graduation_year between 1900 and 2100),
  check (cardinality(majors) <= 8)
);

-- The database holds these small private files so the API can authorize reads
-- and writes without a browser storage credential or an additional secret key.
create table csc.profile_assets (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references csc.profiles(auth_user_id) on delete cascade,
  kind text not null check (kind = 'resume'),
  media_type text not null,
  bytes bytea not null,
  updated_at timestamptz not null default now(),
  unique (auth_user_id, kind),
  unique (id, auth_user_id),
  check (
    (kind = 'resume' and media_type = 'application/pdf' and octet_length(bytes) between 1 and 10485760)
  )
);

alter table csc.profiles
  add constraint profiles_resume_owner_fk
  foreign key (resume_asset_id, auth_user_id)
  references csc.profile_assets(id, auth_user_id);

revoke all on all tables in schema csc from public, anon, authenticated;
alter default privileges in schema csc revoke all on tables from public, anon, authenticated;
alter table csc.profiles enable row level security;
alter table csc.profile_assets enable row level security;
