-- Local read-only assertions after applying migrations.
begin;
do $$
declare browser_role text; table_name text;
begin
  foreach browser_role in array array['anon', 'authenticated'] loop
    foreach table_name in array array['roles', 'user_roles', 'role_audit'] loop
      if has_table_privilege(browser_role, 'csc.' || table_name, 'select,insert,update,delete') then
        raise exception 'Browser has role table privileges';
      end if;
    end loop;
    if has_function_privilege(browser_role, 'csc.assign_default_member()', 'execute') then
      raise exception 'Browser can call role provisioning function';
    end if;
  end loop;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'csc' and c.relname in ('roles', 'user_roles', 'role_audit') and not c.relrowsecurity) then
    raise exception 'Role tables must enable RLS';
  end if;
  if (select array_agg(name order by name) from csc.roles) <> array['alumni','foundry','member','staff'] then
    raise exception 'Unexpected role catalog';
  end if;
  if exists (select 1 from csc.roles where label is null or description is null) then
    raise exception 'Role catalog is missing display metadata';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'role_audit_actor_check'
    and conrelid = 'csc.role_audit'::regclass) then
    raise exception 'Audit rows must name exactly one actor or operator';
  end if;
end $$;
rollback;
