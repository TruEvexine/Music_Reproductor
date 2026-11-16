import { describe, expect, it } from "vitest";
import { trackCoverSeed } from "./coverArt";
import { applyEdit, editFromForm, formOf, isEdited, originalOf, parseNumberField } from "./edits";
import { matchesSearch } from "./format";
import { groupTracks, searchTextOf, sortTracks } from "./library";
import { trackV1Id, UNKNOWN_ALBUM, UNKNOWN_ARTIST } from "./track";
import type { Track } from "./track";

const file: Track = {
  id: "raiz:Música/01.flac",
  path: "Música/01.flac",
  fileName: "01.flac",
  title: "Pista 1",
  artist: "Ana",
  album: "Primero",
  genre: "Rock",
  year: 2001,
  trackNumber: 1,
  duration: 200.4,
  coverHash: "archivo",
  v2: "track:v2:abc",
  metadataStatus: "available",
};

describe("ediciones de metadatos", () => {
  it("se superponen a lo leído y guardan los originales; sin edición, la pista vuelve a ser la del archivo", () => {
    const edited = applyEdit(file, { id: file.id, title: "Otra", albumArtist: "Varios", year: 1999, coverHash: "elegida" });
    expect(edited).toMatchObject({ title: "Otra", albumArtist: "Varios", year: 1999, coverHash: "elegida", artist: "Ana", album: "Primero" });
    expect(edited.source).toEqual({ title: "Pista 1", albumArtist: undefined, year: 2001, coverHash: "archivo" });
    expect(isEdited(edited, "title") && isEdited(edited, "albumArtist") && !isEdited(edited, "artist")).toBe(true);
    expect(originalOf(edited)).toEqual(file);
    expect(applyEdit(edited, undefined)).toEqual(file);
    // Reaplicar sobre una pista ya editada parte del original, no de lo editado.
    expect(applyEdit(edited, { id: file.id, genre: "Jazz" })).toEqual({ ...file, genre: "Jazz", source: { genre: "Rock" } });
  });

  it("vaciar: el título vuelve al original, artista y álbum al respaldo, lo demás queda sin valor", () => {
    const edited = applyEdit(file, { id: file.id, title: null, artist: null, album: null, genre: null, year: null, trackNumber: null });
    expect(edited).toMatchObject({ title: "Pista 1", artist: UNKNOWN_ARTIST, album: UNKNOWN_ALBUM, genre: undefined, year: undefined, trackNumber: undefined });
  });

  it("track:v1 se calcula siempre con los metadatos del archivo", () => {
    const edited = applyEdit(file, { id: file.id, title: "Otra", artist: "Beto", album: "Segundo" });
    expect(trackV1Id(edited)).toBe(trackV1Id(file));
    expect(trackV1Id(file)).toBe("track:v1:pista%201%7Cana%7Cprimero%7C200");
    expect(edited.v2).toBe(file.v2);
    expect(edited.id).toBe(file.id);
  });

  it("álbumes, búsqueda, orden y funda usan lo editado", () => {
    const other: Track = { ...file, id: "raiz:Música/02.flac", title: "Pista 2", album: "Segundo", trackNumber: 2 };
    const moved = applyEdit(file, { id: file.id, album: "Segundo", discNumber: 2 });
    const groups = groupTracks([moved, other], "album");
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Segundo");
    // Disco 1 (sin número) antes que el disco 2, aunque la pista 1 vaya antes.
    expect(sortTracks([moved, other], "album").map((track) => track.id)).toEqual([other.id, moved.id]);
    const renamed = applyEdit(file, { id: file.id, title: "Ñandú" });
    expect(matchesSearch(renamed, "nandu")).toBe(true);
    expect(searchTextOf(renamed)).toContain("nandu");
    // La funda por defecto, estable por álbum, se recalcula con el álbum editado; sin álbum, la de la pista.
    expect(trackCoverSeed(moved)).toBe(trackCoverSeed(other));
    expect(trackCoverSeed(applyEdit(file, { id: file.id, album: null }))).not.toBe(trackCoverSeed(file));
    const grouped = applyEdit(file, { id: file.id, albumArtist: "Varios" });
    expect(groupTracks([grouped, file], "album")).toHaveLength(2);
  });

  it("el formulario: sin cambios no hay edición; el título vacío no cuenta; vaciar es null; restablecer es volver al valor del archivo", () => {
    const form = formOf(file);
    expect(editFromForm(file, form, undefined)).toEqual({ edit: undefined, invalid: [] });
    expect(editFromForm(file, { ...form, title: "  " }, undefined).edit).toBeUndefined();
    expect(editFromForm(file, { ...form, title: "  Otra   canción " }, undefined).edit).toEqual({ id: file.id, title: "Otra canción" });
    expect(editFromForm(file, { ...form, genre: "", year: "" }, undefined).edit).toEqual({ id: file.id, genre: null, year: null });
    expect(editFromForm(file, { ...form, year: "20x1", discNumber: "0" }, undefined).invalid).toEqual(["year", "discNumber"]);
    expect(editFromForm(file, form, "archivo").edit).toBeUndefined();
    expect(editFromForm(file, form, "elegida").edit).toEqual({ id: file.id, coverHash: "elegida" });
    // Artista y álbum desconocidos se ven vacíos y, vacíos, no son edición.
    const bare: Track = { ...file, artist: UNKNOWN_ARTIST, album: UNKNOWN_ALBUM };
    expect(formOf(bare)).toMatchObject({ artist: "", album: "" });
    expect(editFromForm(bare, formOf(bare), undefined).edit).toBeUndefined();
    expect(editFromForm(file, { ...form, artist: "" }, undefined).edit).toEqual({ id: file.id, artist: null });
    expect(formOf(originalOf(applyEdit(file, { id: file.id, title: "Otra" })))).toEqual(form);
  });

  it("números: enteros en rango", () => {
    expect(parseNumberField("year", "1999")).toBe(1999);
    expect(parseNumberField("year", " ")).toBeNull();
    expect(parseNumberField("year", "10000")).toBe("invalid");
    expect(parseNumberField("trackNumber", "3.5")).toBe("invalid");
    expect(parseNumberField("discNumber", "-1")).toBe("invalid");
  });
});
