-- CRM events are saved and published together. Calendar delivery is independent
-- so a Google outage cannot roll back the event or its audit history.
create table csc.events (
  id uuid primary key,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  location text not null check (char_length(btrim(location)) between 1 and 500),
  description text not null default '' check (char_length(description) <= 5000),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  timezone text not null default 'America/New_York' check (timezone = 'America/New_York'),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  calendar_id text not null,
  calendar_event_id text not null check (char_length(calendar_event_id) between 5 and 1024 and calendar_event_id ~ '^[a-v0-9]+$'),
  calendar_url text not null default '',
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed', 'disabled')),
  sync_error text not null default '',
  synced_at timestamptz,
  unique (calendar_id, calendar_event_id)
);

-- Actor IDs deliberately have no FK to Auth: history survives account removal.
create table csc.event_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null references csc.events(id),
  actor_user_id uuid not null,
  action text not null check (action in ('created', 'updated', 'cancelled', 'sync_succeeded', 'sync_failed', 'sync_disabled')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index events_schedule_idx on csc.events (status, starts_at, id);
create index event_audit_history_idx on csc.event_audit (event_id, id desc);

revoke all on csc.events, csc.event_audit from public, anon, authenticated;
revoke all on sequence csc.event_audit_id_seq from public, anon, authenticated;
alter table csc.events enable row level security;
alter table csc.event_audit enable row level security;
