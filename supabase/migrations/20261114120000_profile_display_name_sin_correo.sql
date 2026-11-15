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
--
-- EFECTO EXACTO DEL UPDATE (escrito el 2026-11-14; sin aplicar):
-- Pone display_name = NULL en cada fila de public.profiles que cumple las cuatro condiciones a la vez:
--   1. Tiene su usuario en auth.users (todas: profiles.id es FK con on delete cascade).
--   2. display_name no es NULL.
--   3. El usuario no dio nombre al registrarse: raw_user_meta_data->>'display_name' falta, está vacío o solo tiene espacios
--      (la misma regla con la que las versiones 1 y 2 del trigger caían al correo).
--   4. display_name es EXACTAMENTE left(split_part(email, '@', 1), 60): lo que guardó el trigger. Compara mayúsculas y espacios.
-- Lo que NO toca: a quien escribió un nombre (aunque sea igual a su correo); un nombre que ya no coincide con el correo actual
-- (por ejemplo, si el correo cambió después del registro, el nombre derivado del viejo se queda); filas con display_name NULL.
-- Ojo, pool compartido (PLAN_SEGURIDAD.md S-06): también vacía los perfiles del reproductor de quien solo usa la app de matemáticas,
-- porque el trigger también se los creó. No toca ninguna tabla math_*, ni auth.users, ni playlists.
-- La app no pinta display_name en ningún sitio: solo sale en «Datos de tu cuenta» (exportación), que pasará a mostrarlo vacío.
-- Es una pérdida de datos solo en apariencia: el valor borrado se puede volver a calcular del correo (ver abajo), pero el plan
-- gratuito no tiene copias, así que antes de aplicarla:
--   -- Cuántas filas cambiarán (mismas condiciones que el update):
--   select count(*) from public.profiles p join auth.users u on u.id = p.id
--   where p.display_name is not null
--     and nullif(trim(coalesce(u.raw_user_meta_data ->> 'display_name', '')), '') is null
--     and p.display_name = left(split_part(coalesce(u.email, ''), '@', 1), 60);
--   -- Ids afectados (para revertir con exactitud). Guardar el resultado FUERA del repositorio, que es público: son ids de usuario.
--   select p.id from public.profiles p join auth.users u on u.id = p.id where <las mismas tres condiciones>;
--
-- CÓMO REVERTIR:
--   a) El nombre de los perfiles vaciados. Con la lista de ids guardada antes de aplicar (exacto):
--        update public.profiles p set display_name = left(split_part(coalesce(u.email, ''), '@', 1), 60)
--        from auth.users u where u.id = p.id and p.id = any(array['<id>', …]::uuid[]);
--      Sin la lista (aproximado): la misma sentencia con
--        where u.id = p.id and p.display_name is null
--          and nullif(trim(coalesce(u.raw_user_meta_data ->> 'display_name', '')), '') is null
--      que además rellena los perfiles creados después de aplicar esta migración (el trigger nuevo los deja en NULL) y usa el correo
--      actual, no el del registro.
--   b) El trigger: volver a ejecutar la función de la sección 3 de 20261014120000_hardening_limits.sql (versión que recorta a 60 y cae
--      al correo) y después `revoke execute on function public.create_profile_for_new_user() from public, anon, authenticated;`
--      (create or replace conserva los privilegios, pero así no depende de ello).
--   c) Historial: revertir es una migración nueva con a) y b), nunca borrar ni editar este archivo una vez aplicado.
update public.profiles p
set display_name = null
from auth.users u
where u.id = p.id
  and p.display_name is not null
  and nullif(trim(coalesce(u.raw_user_meta_data ->> 'display_name', '')), '') is null
  and p.display_name = left(split_part(coalesce(u.email, ''), '@', 1), 60);
