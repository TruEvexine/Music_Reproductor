import { supabase } from "../auth/supabaseClient";

export interface Playlist {
  id: string;
  name: string;
  createdAt: string;
  trackIdentifiers: string[];
}

export function getPlaylistTrackIdentifier(track: {
  title: string;
  artist: string;
  album: string;
  duration?: number;
}): string {
  const normalized = [
    track.title,
    track.artist,
    track.album,
    track.duration ? Math.round(track.duration) : "",
  ]
    .map((value) =>
      String(value).trim().normalize("NFKC").toLocaleLowerCase(),
    )
    .join("|");
  return `track:v1:${encodeURIComponent(normalized)}`;
}

interface PlaylistRow {
  id: string;
  name: string;
  created_at: string;
}

interface PlaylistTrackRow {
  playlist_id: string;
  track_identifier: string;
  position: number;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Configura Supabase antes de usar playlists sincronizadas.");
  }
  return supabase;
}

export async function fetchUserPlaylists(userId: string): Promise<Playlist[]> {
  const client = requireSupabase();
  const { data: playlistData, error: playlistError } = await client
    .from("playlists")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (playlistError) throw playlistError;

  const rows: PlaylistRow[] = playlistData ?? [];
  if (rows.length === 0) return [];

  const { data: trackData, error: trackError } = await client
    .from("playlist_tracks")
    .select("playlist_id, track_identifier, position")
    .in(
      "playlist_id",
      rows.map((row) => row.id),
    )
    .order("position", { ascending: true });
  if (trackError) throw trackError;

  const trackRows: PlaylistTrackRow[] = trackData ?? [];
  const identifiersByPlaylist = new Map<string, string[]>();
  for (const track of trackRows) {
    const identifiers = identifiersByPlaylist.get(track.playlist_id) ?? [];
    identifiers.push(track.track_identifier);
    identifiersByPlaylist.set(track.playlist_id, identifiers);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    trackIdentifiers: identifiersByPlaylist.get(row.id) ?? [],
  }));
}

export async function createUserPlaylist(
  userId: string,
  name: string,
): Promise<Playlist> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("playlists")
    .insert({ user_id: userId, name })
    .select("id, name, created_at")
    .single();
  if (error) throw error;

  const row: PlaylistRow = data;
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    trackIdentifiers: [],
  };
}

export async function renameUserPlaylist(
  playlistId: string,
  name: string,
): Promise<void> {
  const { error } = await requireSupabase()
    .from("playlists")
    .update({ name })
    .eq("id", playlistId);
  if (error) throw error;
}

export async function deleteUserPlaylist(playlistId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from("playlists")
    .delete()
    .eq("id", playlistId);
  if (error) throw error;
}

export async function replacePlaylistTracks(
  playlistId: string,
  trackIdentifiers: string[],
): Promise<void> {
  const { error } = await requireSupabase().rpc("replace_playlist_tracks", {
    p_playlist_id: playlistId,
    p_track_identifiers: trackIdentifiers,
  });
  if (error) throw error;
}
