-- Additive application roles; neither JWT metadata nor browser writes own them.
create table csc.roles (
  name text primary key check (name in ('member', 'foundry', 'staff', 'alumni'))
);
insert into csc.roles (name) values ('member'), ('foundry'), ('staff'), ('alumni');

create table csc.user_roles (
  auth_user_id uuid not null references csc.profiles(auth_user_id) on delete cascade,
  role text not null references csc.roles(name),
  created_at timestamptz not null default now(),
  primary key (auth_user_id, role)
);

-- Provision the default in the same transaction as the profile, including
-- concurrent first requests. Do not re-add removed roles on subsequent reads.
create function csc.assign_default_member() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into csc.user_roles (auth_user_id, role) values (new.auth_user_id, 'member');
  return new;
end;
$$;
revoke all on function csc.assign_default_member() from public, anon, authenticated;
create trigger profile_default_member after insert on csc.profiles
for each row execute function csc.assign_default_member();

insert into csc.user_roles (auth_user_id, role)
select auth_user_id, 'member' from csc.profiles;

create table csc.role_audit (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  role text not null references csc.roles(name),
  action text not null check (action in ('grant', 'revoke')),
  operator text not null check (char_length(btrim(operator)) between 1 and 200),
  database_actor text not null default session_user,
  created_at timestamptz not null default now()
);

revoke all on csc.roles, csc.user_roles, csc.role_audit from public, anon, authenticated;
alter table csc.roles enable row level security;
alter table csc.user_roles enable row level security;
alter table csc.role_audit enable row level security;
