-- Read-only checks for the private points storage boundary.
begin;
do $$
declare
  relation text;
  role_name text;
begin
  foreach relation in array array[
    'csc.point_categories', 'csc.point_claims',
    'csc.point_claim_links', 'csc.point_claim_audit'
  ] loop
    if not exists (select 1 from pg_class where oid = relation::regclass and relrowsecurity) then
      raise exception 'Point table must enable RLS: %', relation;
    end if;
    foreach role_name in array array['anon', 'authenticated'] loop
      if has_table_privilege(role_name, relation, 'SELECT,INSERT,UPDATE,DELETE') then
        raise exception 'Browser role must not access private point table: %', relation;
      end if;
    end loop;
  end loop;
  foreach role_name in array array['anon', 'authenticated'] loop
    if has_sequence_privilege(role_name, 'csc.point_claim_audit_id_seq', 'USAGE,SELECT,UPDATE') then
      raise exception 'Browser role must not access point audit sequence';
    end if;
  end loop;
  if (select count(*) from csc.point_categories where active and points = 10) <> 3 then
    raise exception 'Initial point categories or values are missing';
  end if;
end;
$$;
rollback;
