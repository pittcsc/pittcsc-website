-- Foundry events stay public on the calendar, but check-in is restricted by
-- current points, an active staff grant, or the staff role.
alter table csc.events add column foundry_event boolean not null default false;

-- A grant is a 30-day exception to the points threshold. Legacy `foundry`
-- roles are intentionally left untouched and do not become grants.
create table csc.foundry_grants (
  auth_user_id uuid primary key references csc.profiles(auth_user_id) on delete cascade,
  granted_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at = granted_at + interval '720 hours'),
  check (revoked_at is null or revoked_at >= granted_at)
);

-- A browser request ID makes a timed-out grant or revoke safe to retry. Actor
-- and target IDs remain in history if an Auth account is later removed.
create table csc.foundry_grant_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  target_user_id uuid not null,
  actor_user_id uuid not null,
  action text not null check (action in ('grant', 'revoke')),
  granted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index foundry_grant_audit_target_idx on csc.foundry_grant_audit (target_user_id, id desc);

revoke all on csc.foundry_grants, csc.foundry_grant_audit from public, anon, authenticated;
revoke all on sequence csc.foundry_grant_audit_id_seq from public, anon, authenticated;
alter table csc.foundry_grants enable row level security;
alter table csc.foundry_grant_audit enable row level security;
