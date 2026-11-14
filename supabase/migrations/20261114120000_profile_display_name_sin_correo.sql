-- D25 (docs/PLAN_SEGURIDAD.md): el registro ya no copia la parte del correo antes de la «@» en display_name.
-- Si el usuario no da nombre, queda NULL. SIN APLICAR al remoto: el proyecto es compartido; aplicar solo
-- tras probarla en un Postgres local descartable y documentarlo en SUPABASE.md. Idempotente.

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- create or replace conserva los privilegios; se repite por si el remoto los perdió (advisor 0028/0029).
revoke execute on function public.create_profile_for_new_user() from public, anon, authenticated;

-- Perfiles ya creados con el nombre sacado del correo (el usuario no dio nombre al registrarse): vaciarlos.
-- No toca a quien escribió un nombre, aunque coincida con su correo.
update public.profiles p
set display_name = null
from auth.users u
where u.id = p.id
  and p.display_name is not null
  and nullif(trim(coalesce(u.raw_user_meta_data ->> 'display_name', '')), '') is null
  and p.display_name = left(split_part(coalesce(u.email, ''), '@', 1), 60);
