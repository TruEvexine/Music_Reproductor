export type TrackSource = "bundled" | "imported";
export type MetadataStatus = "loading" | "available" | "partial" | "error";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  fileName: string;
  url: string;
  coverUrl?: string;
  duration?: number;
  trackNumber?: number;
  year?: number;
  genre?: string;
  bitrate?: number;
  sampleRate?: number;
  metadataStatus: MetadataStatus;
  metadataError?: string;
  file?: File;
  source: TrackSource;
}
