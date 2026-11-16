// Catálogo de src/assets/music/. Solo lo importa library.ts en desarrollo.
const bundled = import.meta.glob<string>("/src/assets/music/*.{mp3,wav,flac,m4a,ogg,opus}", {
  eager: true,
  import: "default",
  query: "?url",
});

export const demoFiles = Object.entries(bundled).map(([path, url]) => ({ path, url }));
