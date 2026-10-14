-- Límites de tamaño y validaciones (SECURITY_AUDIT.md S6).
-- Idempotente: se puede ejecutar con `supabase db push` o pegado en el SQL Editor.

-- 1. Recortar datos existentes que excedan los nuevos límites.
update public.profiles
  set display_name = left(display_name, 60)
  where char_length(display_name) > 60;

update public.profiles
  set avatar_url = null
  where avatar_url is not null
    and (avatar_url !~ '^https://' or char_length(avatar_url) > 500);

-- 2. Restricciones.
alter table public.profiles
  drop constraint if exists profiles_display_name_length,
  add constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) <= 60);

alter table public.profiles
  drop constraint if exists profiles_avatar_url_https,
  add constraint profiles_avatar_url_https
    check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500));

alter table public.playlist_tracks
  drop constraint if exists playlist_tracks_identifier_length,
  add constraint playlist_tracks_identifier_length
    check (char_length(track_identifier) <= 512);

-- 3. El trigger de registro recorta el nombre para no fallar con nombres largos.
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
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      60
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 4. Máximo de pistas por playlist en el RPC.
create or replace function public.replace_playlist_tracks(
  p_playlist_id uuid,
  p_track_identifiers text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(cardinality(p_track_identifiers), 0) > 5000 then
    raise exception using
      errcode = '22023',
      message = 'A playlist can contain at most 5000 tracks';
  end if;

  if not exists (
    select 1
    from public.playlists
    where id = p_playlist_id
      and user_id = (select auth.uid())
  ) then
    raise exception using
      errcode = '42501',
      message = 'Playlist not found or access denied';
  end if;

  delete from public.playlist_tracks
  where playlist_id = p_playlist_id;

  insert into public.playlist_tracks (
    playlist_id,
    track_identifier,
    position
  )
  select
    p_playlist_id,
    identifiers.track_identifier,
    (identifiers.ordinality - 1)::integer
  from unnest(coalesce(p_track_identifiers, array[]::text[]))
    with ordinality as identifiers(track_identifier, ordinality)
  where nullif(trim(identifiers.track_identifier), '') is not null;
end;
$$;

revoke all on function public.replace_playlist_tracks(uuid, text[])
  from public, anon;
grant execute on function public.replace_playlist_tracks(uuid, text[])
  to authenticated;
