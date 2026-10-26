-- AlumniDB is an explicit publication of the existing private CRM profile.
alter table csc.profiles
  add column location text check (location is null or char_length(location) between 1 and 200),
  add column bio text check (bio is null or char_length(bio) between 1 and 4000),
  add column current_company text check (current_company is null or char_length(current_company) between 1 and 200),
  add column job_title text check (job_title is null or char_length(job_title) between 1 and 200),
  add column position_is_current boolean not null default true,
  add column contact_email text check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and lower(split_part(contact_email, '@', 2)) <> 'pitt.edu')),
  add column open_to_coffee_chats boolean not null default false,
  add column open_to_mentorship boolean not null default false,
  add column available_for_referrals boolean not null default false,
  add column open_to_resume_review boolean not null default false,
  add column alumni_published boolean not null default false,
  add column alumni_updated_at timestamptz not null default now();

-- Explicit year parameter makes the graduation rollover independently testable.
create function csc.alumni_eligible(p csc.profiles, eligible_year integer)
returns boolean language sql immutable set search_path = '' as $$
  select p.account_status = 'active'
    and p.first_name is not null and p.last_name is not null
    and p.graduation_year is not null and p.graduation_year <= eligible_year
    and p.avatar_asset_id is not null and p.linkedin_username is not null
    and p.location is not null and p.bio is not null
    and p.current_company is not null and p.job_title is not null
    and p.contact_email is not null
    and (p.open_to_coffee_chats or p.open_to_mentorship or p.available_for_referrals or p.open_to_resume_review);
$$;

-- Every profile mutation, including avatar removal and concurrent publish/save,
-- passes through the same row lock and invariant. Fixing data never republishes.
create function csc.alumni_profile_changed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if row(new.first_name, new.last_name, new.preferred_name, new.graduation_year,
      new.linkedin_username, new.avatar_asset_id, new.location, new.bio,
      new.current_company, new.job_title, new.position_is_current, new.contact_email,
      new.open_to_coffee_chats, new.open_to_mentorship, new.available_for_referrals, new.open_to_resume_review)
    is distinct from
    row(old.first_name, old.last_name, old.preferred_name, old.graduation_year,
      old.linkedin_username, old.avatar_asset_id, old.location, old.bio,
      old.current_company, old.job_title, old.position_is_current, old.contact_email,
      old.open_to_coffee_chats, old.open_to_mentorship, old.available_for_referrals, old.open_to_resume_review) then
    new.alumni_updated_at := statement_timestamp();
  end if;
  new.alumni_published := new.alumni_published and csc.alumni_eligible(new,
    extract(year from statement_timestamp() at time zone 'America/New_York')::integer);
  return new;
end;
$$;
create trigger alumni_profile_changed before update on csc.profiles
for each row execute function csc.alumni_profile_changed();

-- Replacing avatar bytes reuses its asset ID; that still changes visible info.
create function csc.alumni_avatar_changed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'avatar' and new.bytes is distinct from old.bytes then
    update csc.profiles set alumni_updated_at = statement_timestamp()
    where avatar_asset_id = new.id and auth_user_id = new.auth_user_id;
  end if;
  return new;
end;
$$;
create trigger alumni_avatar_changed after update on csc.profile_assets
for each row execute function csc.alumni_avatar_changed();
create index profiles_alumni_directory on csc.profiles (last_name, first_name, id)
where alumni_published;
revoke all on function csc.alumni_eligible(csc.profiles, integer),
  csc.alumni_profile_changed(), csc.alumni_avatar_changed() from public, anon, authenticated;
