-- Run against local Supabase only. Fixtures are event JSON, not member records.
begin;
do $$
declare
  email text;
  result jsonb;
begin
  foreach email in array array['student@pitt.edu', 'Student@PITT.EDU'] loop
    result := csc_auth.before_user_created(jsonb_build_object('user', jsonb_build_object('email', email)));
    assert result = '{}'::jsonb, 'valid Pitt signup denied';
    result := csc_auth.custom_access_token(jsonb_build_object('claims', jsonb_build_object('email', email)));
    assert result->'claims'->>'email' = email, 'valid Pitt token denied';
  end loop;
  foreach email in array array['', 'student@example.com', 'student@cs.pitt.edu', 'student@pitt.edu.attacker.test', 'student@@pitt.edu', 'student @pitt.edu'] loop
    result := csc_auth.before_user_created(jsonb_build_object('user', jsonb_build_object('email', email)));
    assert result->'error'->>'http_code' = '403', 'invalid signup permitted';
    result := csc_auth.custom_access_token(jsonb_build_object('claims', jsonb_build_object('email', email)));
    assert result->'error'->>'http_code' = '403', 'invalid token permitted';
  end loop;
  assert not has_function_privilege('anon', 'csc_auth.before_user_created(jsonb)', 'execute');
  assert not has_function_privilege('authenticated', 'csc_auth.custom_access_token(jsonb)', 'execute');
  assert has_function_privilege('supabase_auth_admin', 'csc_auth.before_user_created(jsonb)', 'execute');
end;
$$;
rollback;
