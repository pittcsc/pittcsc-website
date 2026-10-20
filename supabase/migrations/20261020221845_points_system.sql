-- Point rules can grow without rewriting historical awards. All access goes
-- through the Go API; browser database roles have no privileges here.
create table csc.point_categories (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  points integer not null check (points > 0),
  active boolean not null default true
);

insert into csc.point_categories (code, label, points) values
  ('leetcode', 'LeetCode solution', 10),
  ('paper', 'Research paper read', 10),
  ('project', 'Project PR or commit', 10);

create table csc.point_claims (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references csc.profiles(auth_user_id) on delete cascade,
  category_code text not null references csc.point_categories(code),
  url text not null check (char_length(url) between 1 and 2048),
  normalized_url text not null check (char_length(normalized_url) between 1 and 2048),
  points_awarded integer not null check (points_awarded > 0),
  status text not null default 'awarded'
    check (status in ('awarded', 'withdrawn', 'revoked')),
  awarded_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  status_reason text check (status_reason is null or char_length(btrim(status_reason)) between 1 and 500),
  status_actor uuid,
  unique (auth_user_id, normalized_url),
  unique (id, auth_user_id),
  check (status <> 'revoked' or status_reason is not null)
);

create index point_claims_awarded_score_idx on csc.point_claims (awarded_at desc, auth_user_id)
  include (points_awarded) where status = 'awarded';
create index point_claims_owner_history_idx on csc.point_claims (auth_user_id, awarded_at desc, id desc);
create index point_claims_staff_history_idx on csc.point_claims (awarded_at desc, id desc);

-- Corrections must not free an old link for another award. Keep every URL a
-- person has used for a claim, even when staff corrects the current link.
create table csc.point_claim_links (
  auth_user_id uuid not null references csc.profiles(auth_user_id) on delete cascade,
  normalized_url text not null check (char_length(normalized_url) between 1 and 2048),
  claim_id uuid not null,
  primary key (auth_user_id, normalized_url),
  foreign key (claim_id, auth_user_id)
    references csc.point_claims(id, auth_user_id) on delete cascade
);
create index point_claim_links_claim_idx on csc.point_claim_links (claim_id);

create table csc.point_claim_audit (
  id bigint generated always as identity primary key,
  claim_id uuid not null references csc.point_claims(id) on delete cascade,
  actor_user_id uuid not null,
  action text not null check (action in ('withdraw', 'revoke', 'restore', 'correct')),
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 500),
  old_claim jsonb not null,
  new_claim jsonb not null,
  created_at timestamptz not null default now()
);
create index point_claim_audit_claim_idx on csc.point_claim_audit (claim_id, id desc);

revoke all on csc.point_categories, csc.point_claims, csc.point_claim_links, csc.point_claim_audit from public, anon, authenticated;
revoke all on sequence csc.point_claim_audit_id_seq from public, anon, authenticated;
alter table csc.point_categories enable row level security;
alter table csc.point_claims enable row level security;
alter table csc.point_claim_links enable row level security;
alter table csc.point_claim_audit enable row level security;
