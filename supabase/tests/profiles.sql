-- Read-only assertions; run against the local database after migrations.
begin;
do $$
declare browser_role text;
begin
  foreach browser_role in array array['anon', 'authenticated'] loop
    if has_schema_privilege(browser_role, 'csc', 'usage')
      or has_table_privilege(browser_role, 'csc.profiles', 'select,insert,update,delete')
      or has_table_privilege(browser_role, 'csc.profile_assets', 'select,insert,update,delete') then
      raise exception 'Browser role has private CRM privileges';
    end if;
  end loop;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'csc' and c.relname in ('profiles', 'profile_assets') and not c.relrowsecurity) then
    raise exception 'Private CRM tables must also enable RLS';
  end if;
end $$;
rollback;
