// Genera una biblioteca SINTÉTICA grande para probar escaneo, virtualización y búsqueda: N pistas WAV diminutas
// (0,25 s de tono) con etiquetas RIFF INFO, en carpetas Artista/Álbum. Nada de música real.
// Uso: node scripts/gen-biblioteca.mjs [N=5000] [carpeta=tests/fixtures/biblioteca]
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const total = Number(process.argv[2] ?? 5000);
const out = process.argv[3] ?? join(import.meta.dirname, "..", "tests", "fixtures", "biblioteca");
rmSync(out, { recursive: true, force: true });

const words = ["Ámbar", "Brisa", "Cénit", "Duna", "Éter", "Fénix", "Galaxia", "Horizonte", "Índigo", "Júbilo", "Kiosco", "Laguna", "Marea", "Niebla", "Ñandú", "Órbita", "Pétalo", "Quimera", "Río", "Sábana", "Trébol", "Umbral", "Vértigo", "Xilófono", "Yunque", "Zafiro"];
const genres = ["Rock", "Pop", "Jazz", "Electrónica", "Clásica", "Folk", "Hip hop", "Ambient"];
const pick = (i, n) => words[(i * 7 + n * 3) % words.length];

const chunk = (id, body) => {
  const pad = body.length % 2;
  const head = Buffer.alloc(8);
  head.write(id, 0, "ascii");
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body, Buffer.alloc(pad)]);
};
const text = (id, value) => chunk(id, Buffer.from(`${value}\0`, "latin1")); // RIFF INFO es latin1, no UTF-8

function wav(tags, freq) {
  const rate = 8000;
  const samples = rate / 4;
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 6000), i * 2);
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * 2, 8);
  fmt.writeUInt16LE(2, 12);
  fmt.writeUInt16LE(16, 14);
  const info = Buffer.concat([Buffer.from("INFO"), ...Object.entries(tags).map(([id, value]) => text(id, value))]);
  const body = Buffer.concat([Buffer.from("WAVE"), chunk("fmt ", fmt), chunk("LIST", info), chunk("data", pcm)]);
  return Buffer.concat([Buffer.from("RIFF"), Buffer.from(Uint32Array.of(body.length).buffer), body]);
}

const perAlbum = 10;
for (let i = 0; i < total; i++) {
  const album = Math.floor(i / perAlbum);
  const artistIndex = album % 120;
  const artist = `${pick(artistIndex, 1)} ${pick(artistIndex, 2)}`;
  const albumName = `${pick(album, 3)} de ${pick(album, 4)} ${album}`;
  const no = (i % perAlbum) + 1;
  const title = `${pick(i, 5)} ${pick(i, 6)} ${i}`;
  const dir = join(out, artist, albumName);
  mkdirSync(dir, { recursive: true });
  const tags = { INAM: title, IART: artist, IPRD: albumName, IGNR: genres[album % genres.length], ICRD: String(1970 + (album % 55)), ITRK: String(no) };
  writeFileSync(join(dir, `${String(no).padStart(2, "0")} ${title}.wav`), wav(tags, 220 + (i % 40) * 10));
}
console.log(`${total} pistas sintéticas en ${out}`);
