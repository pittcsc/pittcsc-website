-- Private Auth hooks; no application tables or changes to managed auth tables.
create schema if not exists csc_auth;
revoke all on schema csc_auth from public, anon, authenticated;
grant usage on schema csc_auth to supabase_auth_admin;

create function csc_auth.before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if coalesce(event->'user'->>'email', '') !~* '^[^@[:space:]]+@pitt\.edu$' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'Use your @pitt.edu email address.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

-- Also reject token issuance/refresh after an out-of-band Auth email change.
-- Contact emails stored in future profiles never participate in authentication.
create function csc_auth.custom_access_token(event jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if coalesce(event->'claims'->>'email', '') !~* '^[^@[:space:]]+@pitt\.edu$' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'Use your @pitt.edu email address.'
    ));
  end if;
  return jsonb_build_object('claims', event->'claims');
end;
$$;

revoke all on all functions in schema csc_auth from public, anon, authenticated;
grant execute on function csc_auth.before_user_created(jsonb) to supabase_auth_admin;
grant execute on function csc_auth.custom_access_token(jsonb) to supabase_auth_admin;
