create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_identifier text not null,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create index if not exists playlists_user_id_idx
  on public.playlists(user_id);
create index if not exists playlist_tracks_playlist_position_idx
  on public.playlist_tracks(playlist_id, position);

alter table public.profiles enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

revoke all on public.profiles, public.playlists, public.playlist_tracks
  from anon, authenticated;
grant select, insert, update
  on public.profiles to authenticated;
grant select, insert, update, delete
  on public.playlists, public.playlist_tracks to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "playlists_select_own" on public.playlists;
create policy "playlists_select_own"
  on public.playlists for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "playlists_insert_own" on public.playlists;
create policy "playlists_insert_own"
  on public.playlists for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "playlists_update_own" on public.playlists;
create policy "playlists_update_own"
  on public.playlists for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "playlists_delete_own" on public.playlists;
create policy "playlists_delete_own"
  on public.playlists for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "playlist_tracks_select_own" on public.playlist_tracks;
create policy "playlist_tracks_select_own"
  on public.playlist_tracks for select to authenticated
  using (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

drop policy if exists "playlist_tracks_insert_own" on public.playlist_tracks;
create policy "playlist_tracks_insert_own"
  on public.playlist_tracks for insert to authenticated
  with check (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

drop policy if exists "playlist_tracks_update_own" on public.playlist_tracks;
create policy "playlist_tracks_update_own"
  on public.playlist_tracks for update to authenticated
  using (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

drop policy if exists "playlist_tracks_delete_own" on public.playlist_tracks;
create policy "playlist_tracks_delete_own"
  on public.playlist_tracks for delete to authenticated
  using (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

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
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();
