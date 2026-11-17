-- Campaign data is private to Go; only deliberately published email images and
-- unguessable subscription links have accountless API access.
create table csc.email_contacts (
 id uuid primary key default gen_random_uuid(),
 email text not null unique check (email = lower(btrim(email)) and length(email) <= 254),
 auth_user_id uuid unique references csc.profiles(auth_user_id) on delete set null,
 first_name text not null default '' check(length(first_name)<=100),
 last_name text not null default '' check(length(last_name)<=100),
 graduation_year integer check(graduation_year between 1900 and 2100),
 majors text[] not null default '{}', tags text[] not null default '{}',
 subscribed boolean not null default true, archived boolean not null default false,
 blocked_reason text not null default '' check(blocked_reason in ('','bounce','complaint')),
 token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table csc.email_campaigns (
 id uuid primary key default gen_random_uuid(), name text not null, subject text not null default '',
 preheader text not null default '', blocks jsonb not null default '[]', audience jsonb not null default '{"mode":"all","conditions":[],"exclusions":[]}',
 status text not null default 'draft' check(status in ('draft','scheduled','sending','completed','cancelled','attention')),
 scheduled_at timestamptz, version integer not null default 1,
 created_by uuid not null, updated_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), started_at timestamptz
);
create index email_campaign_due on csc.email_campaigns(scheduled_at) where status='scheduled';
create table csc.email_audiences (id uuid primary key default gen_random_uuid(), name text not null unique, rules jsonb not null, updated_by uuid not null, updated_at timestamptz not null default now());
create table csc.email_templates (id uuid primary key default gen_random_uuid(), name text not null unique, blocks jsonb not null, updated_by uuid not null, updated_at timestamptz not null default now());
create table csc.email_assets (id uuid primary key default gen_random_uuid(), name text not null, media_type text not null check(media_type in ('image/jpeg','image/png')), bytes bytea not null check(octet_length(bytes) between 1 and 5242880), created_by uuid not null, created_at timestamptz not null default now());
create table csc.email_recipients (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references csc.email_campaigns(id),
 contact_id uuid references csc.email_contacts(id), email text not null, first_name text not null default '', last_name text not null default '',
 status text not null default 'pending' check(status in ('pending','submitting','accepted','uncertain','failed','skipped')),
 is_test boolean not null default false, attempts integer not null default 0, attempt_id uuid,
 message_id text, reason text not null default '', next_attempt_at timestamptz not null default now(), submitted_at timestamptz,
 created_at timestamptz not null default now(), unique(campaign_id,email,is_test)
);
create index email_recipient_pending on csc.email_recipients(next_attempt_at) where status='pending';
create unique index email_recipient_attempt on csc.email_recipients(attempt_id) where attempt_id is not null;
create table csc.email_events (
 id bigint generated always as identity primary key, provider_id text not null unique,
 campaign_id uuid references csc.email_campaigns(id), recipient_id uuid references csc.email_recipients(id),
 kind text not null, link text not null default '', bot boolean not null default false,
 payload jsonb not null default '{}', occurred_at timestamptz not null default now(), received_at timestamptz not null default now()
);
create index email_events_campaign on csc.email_events(campaign_id,kind,recipient_id);
create table csc.email_history (id bigint generated always as identity primary key, campaign_id uuid references csc.email_campaigns(id), actor_id uuid, action text not null, snapshot jsonb not null default '{}', created_at timestamptz not null default now());
create table csc.email_imports (id uuid primary key default gen_random_uuid(), actor_id uuid not null, result jsonb not null, created_at timestamptz not null default now());
create table csc.email_verifications (contact_id uuid primary key references csc.email_contacts(id), token_hash text not null unique, expires_at timestamptz not null, requested_at timestamptz not null default now());

-- Subscribe account holders once; subsequent profile changes never reset opt-out,
-- archival, delivery blocks, or officer-managed tags.
create function csc.sync_email_contact() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into csc.email_contacts(email,auth_user_id,first_name,last_name,graduation_year,majors)
 select lower(u.email),u.id,coalesce(new.first_name,''),coalesce(new.last_name,''),new.graduation_year,new.majors
 from auth.users u where u.id=new.auth_user_id and u.email_confirmed_at is not null and u.deleted_at is null
 on conflict(email) do update set auth_user_id=excluded.auth_user_id,first_name=excluded.first_name,last_name=excluded.last_name,
 graduation_year=excluded.graduation_year,majors=excluded.majors,version=csc.email_contacts.version+1,updated_at=now();
 return new;
end $$;
create trigger profile_email_contact after insert or update of first_name,last_name,graduation_year,majors on csc.profiles for each row execute function csc.sync_email_contact();
insert into csc.email_contacts(email,auth_user_id,first_name,last_name,graduation_year,majors)
select lower(u.email),u.id,coalesce(p.first_name,''),coalesce(p.last_name,''),p.graduation_year,p.majors
from csc.profiles p join auth.users u on u.id=p.auth_user_id where u.email_confirmed_at is not null and u.deleted_at is null;
create function csc.archive_email_contact() returns trigger language plpgsql security definer set search_path='' as $$
begin update csc.email_contacts set archived=true,version=version+1,updated_at=now() where auth_user_id=old.auth_user_id; return old; end $$;
create trigger profile_email_archive before delete on csc.profiles for each row execute function csc.archive_email_contact();

-- No policies expose campaign tables through Supabase browser roles.
do $$ declare t text; begin
 foreach t in array array['email_contacts','email_campaigns','email_audiences','email_templates','email_assets','email_recipients','email_events','email_history','email_imports','email_verifications'] loop
 execute format('alter table csc.%I enable row level security',t);
 execute format('revoke all on csc.%I from public, anon, authenticated',t);
 end loop;
end $$;
revoke all on function csc.sync_email_contact() from public,anon,authenticated;
revoke all on function csc.archive_email_contact() from public,anon,authenticated;
-- Keep attempt identities permanently, including when an officer approves a resend.
alter table csc.email_recipients drop constraint email_recipients_campaign_id_email_is_test_key;
alter table csc.email_recipients add column test_run uuid, add column snapshot jsonb;
create unique index email_recipient_campaign_email on csc.email_recipients(campaign_id,email) where not is_test;
create unique index email_recipient_test_run on csc.email_recipients(campaign_id,email,test_run) where is_test;
create table csc.email_attempts(id uuid primary key,recipient_id uuid not null references csc.email_recipients(id),status text not null default 'submitting',message_id text,created_at timestamptz not null default now());
alter table csc.email_attempts enable row level security;
revoke all on csc.email_attempts from public,anon,authenticated;
