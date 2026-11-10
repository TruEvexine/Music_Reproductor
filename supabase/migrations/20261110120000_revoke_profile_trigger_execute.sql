-- La funcion solo la dispara el trigger on_auth_user_created; no debe ser invocable por RPC
-- (advisor 0028/0029 de Supabase). Idempotente.
revoke execute on function public.create_profile_for_new_user() from public, anon, authenticated;
