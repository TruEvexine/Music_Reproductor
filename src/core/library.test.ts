import { describe, expect, it } from "vitest";
import { audioTypeOf, diffScan, matchesAll, groupTracks, isFolderCover, recentTracks, searchTextOf, sortGroups, sortTracks, stemOf } from "./library";
import { computeTrackV2, folderOf, UNKNOWN_ARTIST, V2_SAMPLE_BYTES, v2Ranges } from "./track";
import type { Track } from "./track";

const track = (id: string, extra: Partial<Track> = {}): Track => ({
  id,
  title: id,
  artist: "Artista",
  album: "Álbum",
  fileName: `${id}.flac`,
  path: `${id}.flac`,
  metadataStatus: "available",
  ...extra,
});

describe("track:v2", () => {
  it("muestrea el primer y el último MiB sin solaparse", () => {
    expect(v2Ranges(10)).toEqual([[0, 10]]);
    // 2 MiB exactos: las dos mitades, sin solaparse ni dejar huecos.
    expect(v2Ranges(V2_SAMPLE_BYTES * 2)).toEqual([
      [0, V2_SAMPLE_BYTES],
      [V2_SAMPLE_BYTES, V2_SAMPLE_BYTES * 2],
    ]);
    expect(v2Ranges(V2_SAMPLE_BYTES * 3)).toEqual([
      [0, V2_SAMPLE_BYTES],
      [V2_SAMPLE_BYTES * 2, V2_SAMPLE_BYTES * 3],
    ]);
  });

  it("mismo contenido → misma identidad; cambia con el tamaño o los bytes", async () => {
    const bytes = new Uint8Array(V2_SAMPLE_BYTES * 3).map((_, i) => i % 251);
    const reader = (data: Uint8Array) => async (start: number, end: number) => data.slice(start, end).buffer;
    const a = await computeTrackV2(bytes.length, reader(bytes));
    expect(a).toMatch(/^track:v2:[0-9a-f]{64}$/);
    expect(await computeTrackV2(bytes.length, reader(bytes.slice()))).toBe(a);
    const tail = bytes.slice();
    tail[tail.length - 1] ^= 1;
    expect(await computeTrackV2(tail.length, reader(tail))).not.toBe(a);
    // Un byte del medio (fuera de las muestras) no cuenta: es la contrapartida de no leer archivos enteros.
    const middle = bytes.slice();
    middle[V2_SAMPLE_BYTES + 5] ^= 1;
    expect(await computeTrackV2(middle.length, reader(middle))).toBe(a);
  });

  it("folderOf", () => {
    expect(folderOf("Música/Álbum/01.flac")).toBe("Música/Álbum");
    expect(folderOf("suelto.mp3")).toBe("");
  });
});

describe("archivos de la biblioteca", () => {
  it("tipos y archivos acompañantes", () => {
    expect(audioTypeOf("a.FLAC")).toBe("audio/flac");
    expect(audioTypeOf("a.opus")).toContain("opus");
    expect(audioTypeOf("notas.txt")).toBeUndefined();
    expect(isFolderCover("Cover.JPG")).toBe(true);
    expect(isFolderCover("contraportada.jpg")).toBe(false);
    expect(stemOf("Disco/01 Tema.flac")).toBe(stemOf("Disco/01 tema.LRC"));
  });

  it("re-escaneo por diferencias: solo lo nuevo o cambiado", () => {
    const known = [
      { id: "a", path: "M/a.flac", size: 1, lastModified: 1 },
      { id: "b", path: "M/b.flac", size: 2, lastModified: 2 },
      { id: "c", path: "M/c.flac", size: 3, lastModified: 3 },
    ];
    const found = [
      { path: "M/a.flac", size: 1, lastModified: 1 },
      { path: "M/b.flac", size: 2, lastModified: 9 },
      { path: "M/d.flac", size: 4, lastModified: 4 },
    ];
    const diff = diffScan(known, found);
    expect(diff.unchanged.map((item) => item.id)).toEqual(["a"]);
    expect(diff.removed.map((item) => item.id)).toEqual(["b", "c"]);
    expect(diff.added.map((item) => item.path)).toEqual(["M/b.flac", "M/d.flac"]);
  });
});

describe("vistas", () => {
  const tracks = [
    track("2", { title: "Ébano", album: "Zeta", trackNumber: 2, year: 2001, genre: "Rock, Pop", addedAt: 5, coverHash: "h1", path: "Música/Zeta/2.flac" }),
    track("1", { title: "agua", album: "Zeta", trackNumber: 1, year: 1999, genre: "Rock", addedAt: 9, path: "Música/Zeta/1.flac" }),
    track("3", { title: "Bajo", artist: UNKNOWN_ARTIST, album: "Alfa", addedAt: 1, playedAt: 20, path: "suelto.flac" }),
  ];

  it("agrupa por álbum con portada, año más antiguo y conteo", () => {
    const albums = groupTracks(tracks, "album");
    const zeta = albums.find((group) => group.label === "Zeta")!;
    expect(zeta.trackIds).toEqual(["2", "1"]);
    expect(zeta.coverHash).toBe("h1");
    expect(zeta.year).toBe(1999);
    expect(zeta.subtitle).toBe("Artista · 2 canciones");
  });

  it("un género compuesto aparece en cada género; sin género tiene su grupo", () => {
    const genres = groupTracks(tracks, "genre");
    expect(genres.find((group) => group.label === "Rock")?.trackIds).toEqual(["2", "1"]);
    expect(genres.find((group) => group.label === "Pop")?.trackIds).toEqual(["2"]);
    expect(genres.find((group) => group.label === "Sin género")?.trackIds).toEqual(["3"]);
  });

  it("carpetas y archivos sueltos", () => {
    const folders = groupTracks(tracks, "folder");
    expect(folders.map((group) => group.label).sort()).toEqual(["Archivos sueltos", "Zeta"]);
    expect(folders.find((group) => group.label === "Zeta")?.subtitle).toBe("Música · 2 canciones");
  });

  it("ordena sin distinguir acentos y deja lo desconocido al final", () => {
    expect(sortTracks(tracks, "title").map((item) => item.title)).toEqual(["agua", "Bajo", "Ébano"]);
    expect(sortTracks(tracks, "album").map((item) => item.id)).toEqual(["3", "1", "2"]);
    expect(sortTracks(tracks, "artist").map((item) => item.id)).toEqual(["1", "2", "3"]);
    expect(sortTracks(tracks, "added").map((item) => item.id)).toEqual(["1", "2", "3"]);
    const artists = sortGroups(groupTracks(tracks, "artist"), "name");
    expect(artists.map((group) => group.label)).toEqual(["Artista", UNKNOWN_ARTIST]);
    expect(sortGroups(groupTracks(tracks, "album"), "year")[0].label).toBe("Zeta");
  });

  it("recientes: lo último que sonó o entró", () => {
    expect(recentTracks(tracks).map((item) => item.id)).toEqual(["3", "1", "2"]);
    expect(recentTracks(tracks, 1)).toHaveLength(1);
  });

  it("búsqueda sin acentos sobre el texto precalculado", () => {
    expect(searchTextOf(tracks[0]).includes("ebano")).toBe(true);
    expect(searchTextOf(tracks[0]).includes("musica/zeta")).toBe(true);
  });

  it("búsqueda por palabras en cualquier orden", () => {
    const text = searchTextOf(track("x", { title: "Marea alta", artist: "Ñandú Eléctrico" }));
    expect(matchesAll(text, "nandu marea")).toBe(true);
    expect(matchesAll(text, "marea  nandu")).toBe(true);
    expect(matchesAll(text, "nandu sol")).toBe(false);
  });

  it("agrupa 5 000 pistas rápido", () => {
    const many = Array.from({ length: 5000 }, (_, i) => track(String(i), { album: `Álbum ${i % 500}`, artist: `Artista ${i % 200}` }));
    const start = performance.now();
    const albums = groupTracks(sortTracks(many, "album"), "album");
    expect(albums).toHaveLength(1000);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
