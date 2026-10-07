-- Read-only checks for the private event storage boundary.
begin;
do $$
declare
  relation text;
  role_name text;
begin
  foreach relation in array array['csc.events', 'csc.event_audit'] loop
    if not exists (select 1 from pg_class where oid = relation::regclass and relrowsecurity) then
      raise exception 'Event table must enable RLS';
    end if;
    foreach role_name in array array['anon', 'authenticated'] loop
      if has_table_privilege(role_name, relation, 'SELECT,INSERT,UPDATE,DELETE') then
        raise exception 'Browser role must not access private event tables';
      end if;
    end loop;
  end loop;
  foreach role_name in array array['anon', 'authenticated'] loop
    if has_sequence_privilege(role_name, 'csc.event_audit_id_seq', 'USAGE,SELECT,UPDATE') then
      raise exception 'Browser role must not access the event audit sequence';
    end if;
  end loop;
end;
$$;
rollback;
