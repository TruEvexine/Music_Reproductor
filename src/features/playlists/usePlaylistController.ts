import { useCallback, useEffect, useRef, useState } from "react";
import {
  createUserPlaylist,
  deleteUserPlaylist,
  fetchUserPlaylists,
  renameUserPlaylist,
  replacePlaylistTracks,
} from "./playlistService";
import { getPlaylistTrackIdentifier } from "./playlistService";
import type { Playlist } from "./playlistService";
import type { Track } from "../library/model/Track";

export function usePlaylistController(userId: string | undefined) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const playlistsRef = useRef(playlists);

  useEffect(() => {
    playlistsRef.current = playlists;
  }, [playlists]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setPlaylists([]);
      playlistsRef.current = [];
      setLoadedForUser(null);
      setSelectedPlaylistId(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setPlaylists([]);
    playlistsRef.current = [];
    setLoadedForUser(null);
    setSelectedPlaylistId(null);
    setIsLoading(true);
    setError(null);
    void fetchUserPlaylists(userId)
      .then((loadedPlaylists) => {
        if (!active) return;
        setPlaylists(loadedPlaylists);
        playlistsRef.current = loadedPlaylists;
        setLoadedForUser(userId);
        setSelectedPlaylistId((selectedId) =>
          loadedPlaylists.some((playlist) => playlist.id === selectedId)
            ? selectedId
            : (loadedPlaylists[0]?.id ?? null),
        );
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar tus playlists.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const visiblePlaylists =
    loadedForUser === userId ? playlists : [];

  const createPlaylist = useCallback(
    async (name: string) => {
      if (!userId) throw new Error("Inicia sesión para crear una playlist.");
      setIsSaving(true);
      setError(null);
      setNotice(null);
      try {
        const playlist = await createUserPlaylist(userId, name.trim());
        const nextPlaylists = [...playlistsRef.current, playlist];
        playlistsRef.current = nextPlaylists;
        setPlaylists(nextPlaylists);
        setSelectedPlaylistId(playlist.id);
        setNotice("Playlist creada.");
      } catch (saveError: unknown) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "No se pudo crear la playlist.";
        setError(message);
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [userId],
  );

  const renamePlaylist = useCallback(
    async (playlistId: string, name: string) => {
      setIsSaving(true);
      setError(null);
      setNotice(null);
      try {
        await renameUserPlaylist(playlistId, name.trim());
        const nextPlaylists = playlistsRef.current.map((playlist) =>
          playlist.id === playlistId
            ? { ...playlist, name: name.trim() }
            : playlist,
        );
        playlistsRef.current = nextPlaylists;
        setPlaylists(nextPlaylists);
        setNotice("Nombre de playlist actualizado.");
      } catch (saveError: unknown) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "No se pudo renombrar la playlist.";
        setError(message);
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const deletePlaylist = useCallback(async (playlistId: string) => {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deleteUserPlaylist(playlistId);
      const nextPlaylists = playlistsRef.current.filter(
        (playlist) => playlist.id !== playlistId,
      );
      playlistsRef.current = nextPlaylists;
      setPlaylists(nextPlaylists);
      setSelectedPlaylistId((selectedId) =>
        selectedId === playlistId
          ? (nextPlaylists[0]?.id ?? null)
          : selectedId,
      );
      setNotice("Playlist eliminada.");
    } catch (saveError: unknown) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo eliminar la playlist.";
      setError(message);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const saveTrackIdentifiers = useCallback(
    async (playlistId: string, identifiers: string[]) => {
      const currentPlaylist = playlistsRef.current.find(
        (playlist) => playlist.id === playlistId,
      );
      if (!currentPlaylist) {
        throw new Error("Selecciona una playlist antes de guardar canciones.");
      }

      setIsSaving(true);
      setError(null);
      setNotice(null);
      try {
        await replacePlaylistTracks(playlistId, identifiers);
        const nextPlaylists = playlistsRef.current.map((playlist) =>
          playlist.id === playlistId
            ? { ...playlist, trackIdentifiers: identifiers }
            : playlist,
        );
        playlistsRef.current = nextPlaylists;
        setPlaylists(nextPlaylists);
        setNotice("Playlist sincronizada.");
      } catch (saveError: unknown) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "No se pudo guardar la playlist.";
        setError(message);
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const addTrack = useCallback(
    async (playlistId: string, track: Track) => {
      if (track.metadataStatus === "loading") {
        throw new Error(
          "Espera a que terminen de leerse los metadatos de la canción.",
        );
      }
      const playlist = playlistsRef.current.find(
        (item) => item.id === playlistId,
      );
      if (!playlist) throw new Error("Selecciona una playlist.");

      const identifier = getPlaylistTrackIdentifier(track);
      if (playlist.trackIdentifiers.includes(identifier)) {
        throw new Error("La canción ya está en esta playlist.");
      }

      await saveTrackIdentifiers(playlistId, [
        ...playlist.trackIdentifiers,
        identifier,
      ]);
    },
    [saveTrackIdentifiers],
  );

  const removeTrack = useCallback(
    async (playlistId: string, identifier: string) => {
      const playlist = playlistsRef.current.find(
        (item) => item.id === playlistId,
      );
      if (!playlist) return;
      await saveTrackIdentifiers(
        playlistId,
        playlist.trackIdentifiers.filter((item) => item !== identifier),
      );
    },
    [saveTrackIdentifiers],
  );

  const moveTrack = useCallback(
    async (playlistId: string, identifier: string, direction: -1 | 1) => {
      const playlist = playlistsRef.current.find(
        (item) => item.id === playlistId,
      );
      if (!playlist) return;

      const from = playlist.trackIdentifiers.indexOf(identifier);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= playlist.trackIdentifiers.length) return;

      const identifiers = [...playlist.trackIdentifiers];
      [identifiers[from], identifiers[to]] = [
        identifiers[to],
        identifiers[from],
      ];
      await saveTrackIdentifiers(playlistId, identifiers);
    },
    [saveTrackIdentifiers],
  );

  const clearMessages = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  return {
    addTrack,
    clearMessages,
    createPlaylist,
    deletePlaylist,
    error,
    isLoading,
    isSaving,
    moveTrack,
    notice,
    playlists: visiblePlaylists,
    removeTrack,
    renamePlaylist,
    selectedPlaylist:
      visiblePlaylists.find(
        (playlist) => playlist.id === selectedPlaylistId,
      ) ?? null,
    selectedPlaylistId,
    selectPlaylist: setSelectedPlaylistId,
  };
}
