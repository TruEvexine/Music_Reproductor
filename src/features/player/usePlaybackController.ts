import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { demoTracks } from "../library/demoCatalog";
import { hasUsefulMetadata, readTrackMetadata } from "../library/metadataReader";
import type { Track } from "../library/model/Track";

const supportedExtensions = new Set(["mp3", "wav", "flac", "m4a"]);
const metadataTasks = new Map<
  string,
  ReturnType<typeof readTrackMetadata>
>();

export type RepeatMode = "off" | "queue" | "track";

function getExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function getFileFingerprint(file: File): string {
  return `${file.name.toLocaleLowerCase()}:${file.size}:${file.lastModified}`;
}

function getPlaybackErrorMessage(error: unknown): string | null {
  if (error instanceof DOMException && error.name === "AbortError") return null;
  return error instanceof Error
    ? error.message
    : "No se pudo reproducir este archivo en el navegador.";
}

function readMetadataOnce(track: Track) {
  const existing = metadataTasks.get(track.id);
  if (existing) return existing;

  const task = readTrackMetadata(track);
  metadataTasks.set(track.id, task);
  return task;
}

export function usePlaybackController() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tracks, setTracks] = useState<Track[]>(demoTracks);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tracksRef = useRef(tracks);
  const currentTrackRef = useRef(currentTrackId);
  const queueRef = useRef(queue);
  const repeatModeRef = useRef(repeatMode);

  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === currentTrackId) ?? null,
    [currentTrackId, tracks],
  );
  const currentQueueIndex = queue.indexOf(currentTrackId ?? "");

  useEffect(() => {
    tracksRef.current = tracks;
    queueRef.current = queue;
    currentTrackRef.current = currentTrackId;
    repeatModeRef.current = repeatMode;
  }, [currentTrackId, queue, repeatMode, tracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.getAttribute("src") === currentTrack.url) return;

    audio.src = currentTrack.url;
    audio.load();
    setCurrentPosition(0);
    setDuration(currentTrack.duration ?? 0);
  }, [currentTrack?.id, currentTrack?.url]);

  useEffect(() => {
    const pendingTracks = tracks.filter(
      (track) => track.metadataStatus === "loading",
    );
    if (pendingTracks.length === 0) return;

    let cancelled = false;
    let nextIndex = 0;

    const worker = async () => {
      while (!cancelled && nextIndex < pendingTracks.length) {
        const track = pendingTracks[nextIndex++];
        try {
          const metadata = await readMetadataOnce(track);
          if (cancelled) return;

          setTracks((currentTracks) =>
            currentTracks.map((currentTrack) =>
              currentTrack.id === track.id
                ? {
                    ...currentTrack,
                    ...metadata,
                    metadataStatus: hasUsefulMetadata(metadata, track)
                      ? "available"
                      : "partial",
                    metadataError: undefined,
                  }
                : currentTrack,
            ),
          );
        } catch (metadataError: unknown) {
          if (cancelled) return;
          setTracks((currentTracks) =>
            currentTracks.map((currentTrack) =>
              currentTrack.id === track.id
                ? {
                    ...currentTrack,
                    metadataStatus: "error",
                    metadataError:
                      metadataError instanceof Error
                        ? metadataError.message
                        : "No se pudieron leer los metadatos.",
                  }
                : currentTrack,
            ),
          );
        }
      }
    };

    void Promise.all([worker(), worker()]);
    return () => {
      cancelled = true;
    };
  }, [tracks]);

  useEffect(
    () => () => {
      for (const track of tracksRef.current) {
        if (track.source === "imported") URL.revokeObjectURL(track.url);
        if (track.coverUrl) URL.revokeObjectURL(track.coverUrl);
      }
    },
    [],
  );

  const playTrack = useCallback(
    (trackId: string) => {
      const track = tracksRef.current.find((item) => item.id === trackId);
      if (!track) {
        setError("No se encontro la cancion seleccionada en la biblioteca.");
        return;
      }

      const currentQueue = queueRef.current;
      if (!currentQueue.includes(trackId)) {
        const currentIndex = currentQueue.indexOf(currentTrackRef.current ?? "");
        const insertAt =
          currentIndex >= 0 ? currentIndex + 1 : currentQueue.length;
        const nextQueue = [...currentQueue];
        nextQueue.splice(insertAt, 0, trackId);
        queueRef.current = nextQueue;
        setQueue(nextQueue);
      }
      setCurrentTrackId(trackId);
      currentTrackRef.current = trackId;
      setCurrentPosition(0);
      setDuration(track.duration ?? 0);
      setError(null);

      const audio = audioRef.current;
      if (!audio) return;

      if (audio.getAttribute("src") !== track.url) {
        audio.src = track.url;
        audio.load();
      }
      audio.currentTime = 0;

      void audio.play().catch((playError: unknown) => {
        const message = getPlaybackErrorMessage(playError);
        if (!message || audio.getAttribute("src") !== track.url) return;
        setIsPlaying(false);
        setError(message);
      });
    },
    [],
  );

  const playTrackList = useCallback(
    (trackIds: string[]) => {
      const availableIds = trackIds.filter((id) =>
        tracksRef.current.some((track) => track.id === id),
      );
      if (availableIds.length === 0) {
        setError("No hay canciones disponibles para reproducir.");
        return;
      }

      queueRef.current = availableIds;
      setQueue(availableIds);
      playTrack(availableIds[0]);
    },
    [playTrack],
  );

  const addToQueue = useCallback((trackId: string): boolean => {
    const track = tracksRef.current.find((item) => item.id === trackId);
    if (!track) {
      setError("No se encontro la cancion seleccionada en la biblioteca.");
      return false;
    }

    if (queueRef.current.includes(trackId)) return false;

    const nextQueue = [...queueRef.current, trackId];
    queueRef.current = nextQueue;
    setQueue(nextQueue);

    if (!currentTrackRef.current) {
      currentTrackRef.current = trackId;
      setCurrentTrackId(trackId);
      setDuration(track.duration ?? 0);
      setCurrentPosition(0);
      if (audioRef.current?.getAttribute("src") === track.url) {
        audioRef.current.currentTime = 0;
      }
    }

    setError(null);
    return true;
  }, []);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    const track = tracksRef.current.find(
      (item) => item.id === currentTrackRef.current,
    );
    if (!audio || !track) return;

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    void audio.play().catch((playError: unknown) => {
      const message = getPlaybackErrorMessage(playError);
      if (!message) return;
      setIsPlaying(false);
      setError(message);
    });
  }, []);

  const moveQueueTrack = useCallback((trackId: string, direction: -1 | 1) => {
    setQueue((currentQueue) => {
      const from = currentQueue.indexOf(trackId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= currentQueue.length) return currentQueue;

      const nextQueue = [...currentQueue];
      [nextQueue[from], nextQueue[to]] = [nextQueue[to], nextQueue[from]];
      return nextQueue;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    queueRef.current = [];
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    currentTrackRef.current = null;
    setCurrentTrackId(null);
    setIsPlaying(false);
    setCurrentPosition(0);
    setDuration(0);
  }, []);

  const removeFromQueue = useCallback(
    (trackId: string) => {
      const currentQueue = queueRef.current;
      const index = currentQueue.indexOf(trackId);
      if (index < 0) return;

      const nextQueue = currentQueue.filter((item) => item !== trackId);
      setQueue(nextQueue);
      queueRef.current = nextQueue;

      if (trackId !== currentTrackRef.current) return;
      const replacement = nextQueue[index] ?? nextQueue[index - 1] ?? null;
      audioRef.current?.pause();
      if (replacement) {
        playTrack(replacement);
      } else {
        currentTrackRef.current = null;
        setCurrentTrackId(null);
        setIsPlaying(false);
        setCurrentPosition(0);
        setDuration(0);
      }
    },
    [playTrack],
  );

  const playNext = useCallback(() => {
    const currentQueue = queueRef.current;
    const currentIndex = currentQueue.indexOf(currentTrackRef.current ?? "");
    const nextTrackId = currentQueue[currentIndex + 1];
    if (nextTrackId) {
      playTrack(nextTrackId);
      return;
    }
    if (repeatModeRef.current === "queue" && currentQueue.length > 0) {
      playTrack(currentQueue[0]);
      return;
    }

    audioRef.current?.pause();
    setIsPlaying(false);
    setCurrentPosition(0);
  }, [playTrack]);

  const handleEnded = useCallback(() => {
    if (repeatModeRef.current === "track" && currentTrackRef.current) {
      playTrack(currentTrackRef.current);
      return;
    }
    playNext();
  }, [playNext, playTrack]);

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentPosition(0);
      return;
    }

    const currentQueue = queueRef.current;
    const currentIndex = currentQueue.indexOf(currentTrackRef.current ?? "");
    const previousTrackId = currentQueue[currentIndex - 1];
    if (previousTrackId) {
      playTrack(previousTrackId);
      return;
    }
    if (repeatModeRef.current === "queue" && currentQueue.length > 0) {
      playTrack(currentQueue[currentQueue.length - 1]);
      return;
    }

    if (audio) audio.currentTime = 0;
    setCurrentPosition(0);
  }, [playTrack]);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((mode) =>
      mode === "off" ? "queue" : mode === "queue" ? "track" : "off",
    );
  }, []);

  const addFiles = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    const knownFiles = new Set(
      tracksRef.current.flatMap((track) =>
        track.file ? [getFileFingerprint(track.file)] : [],
      ),
    );
    const validFiles: File[] = [];
    let invalidCount = 0;
    let duplicateCount = 0;
    for (const file of selectedFiles) {
      if (!supportedExtensions.has(getExtension(file.name))) {
        invalidCount += 1;
        continue;
      }

      const fingerprint = getFileFingerprint(file);
      if (knownFiles.has(fingerprint)) {
        duplicateCount += 1;
        continue;
      }
      knownFiles.add(fingerprint);
      validFiles.push(file);
    }

    const importedTracks = validFiles.map((file): Track => ({
      id: `imported:${crypto.randomUUID()}`,
      title: file.name.replace(/\.[^.]+$/, ""),
      artist: "Artista desconocido",
      album: "Álbum desconocido",
      fileName: file.name,
      file,
      url: URL.createObjectURL(file),
      metadataStatus: "loading",
      source: "imported",
    }));

    if (importedTracks.length > 0) {
      setTracks((currentTracks) => [...currentTracks, ...importedTracks]);
    }

    const notices = [
      invalidCount > 0 &&
        `${invalidCount} archivo(s) omitido(s): solo se admiten MP3, WAV, FLAC y M4A.`,
      duplicateCount > 0 &&
        `${duplicateCount} archivo(s) omitido(s): ya estaban en la biblioteca.`,
    ].filter(Boolean);
    setError(notices.length > 0 ? notices.join(" ") : null);
  }, []);

  const seek = useCallback((position: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(position)) return;

    audio.currentTime = position;
    setCurrentPosition(position);
  }, []);

  return {
    audioRef,
    addToQueue,
    clearQueue,
    currentPosition,
    currentQueueIndex,
    currentTrack,
    duration,
    error,
    isPlaying,
    moveQueueTrack,
    playNext,
    playPrevious,
    playTrack,
    playTrackList,
    queue,
    removeFromQueue,
    repeatMode,
    cycleRepeatMode,
    seek,
    setCurrentPosition,
    setDuration,
    setError,
    setIsPlaying,
    togglePlayback,
    tracks,
    addFiles,
    handleEnded,
  };
}
