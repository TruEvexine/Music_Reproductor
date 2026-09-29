import type { Track } from "./model/Track";

const bundledAudio = import.meta.glob<string>(
  "/src/assets/music/*.{mp3,wav,flac,m4a}",
  {
    eager: true,
    import: "default",
    query: "?url",
  },
);

export const demoTracks: Track[] = Object.entries(bundledAudio).map(
  ([path, url]) => {
    const fileName = path.split("/").pop() ?? path;

    return {
      id: `demo:${path}`,
      title: fileName.replace(/\.[^.]+$/, ""),
      artist: "Artista desconocido",
      album: "Álbum desconocido",
      fileName,
      url,
      metadataStatus: "loading",
      source: "bundled",
    };
  },
);
