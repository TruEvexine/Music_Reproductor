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
