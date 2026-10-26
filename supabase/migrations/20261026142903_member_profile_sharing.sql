-- Existing CRM profiles remain listed by basic membership fields. Optional
-- details require an explicit owner choice, including for existing accounts.
alter table csc.profiles
  add column contact_email text,
  add column details_shared boolean not null default false,
  add constraint profiles_contact_email_check check (
    contact_email is null or (
      char_length(contact_email) <= 254
      and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

-- Losing completion or active status revokes sharing in the same row update.
-- Re-completing or reinstating an account never restores it automatically.
create function csc.clear_ineligible_profile_sharing() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.account_status <> 'active' or new.first_name is null
    or new.last_name is null or new.graduation_year is null
    or cardinality(new.majors) = 0 then
    new.details_shared := false;
  end if;
  return new;
end;
$$;

create trigger clear_ineligible_profile_sharing
before update on csc.profiles
for each row execute function csc.clear_ineligible_profile_sharing();

revoke all on function csc.clear_ineligible_profile_sharing()
  from public, anon, authenticated;
