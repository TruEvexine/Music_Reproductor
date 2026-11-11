// Genera audio SINTÉTICO (tonos) para pruebas en tests/fixtures/audio/ (ignorado por git).
// WAV se escribe en Node puro; los demás formatos y las portadas requieren ffmpeg en el PATH (opcional).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
mkdirSync(out, { recursive: true });

function wav(file, freq, seconds, rate = 44100) {
  const n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 9000), 44 + i * 2);
  }
  writeFileSync(join(out, file), buf);
}

wav("tono-sin-metadatos.wav", 330, 4);
wav("tono-corto.wav", 523, 2);
// Letra en archivo hermano (.lrc) para tono-sin-metadatos.wav: mismo nombre, otra extensión.
writeFileSync(join(out, "tono-sin-metadatos.lrc"), "[ar:Prueba]\n[00:00.20]Primer verso sintético\n[00:01.50]Segundo verso sintético\n[00:03.00]Último verso\n");
writeFileSync(join(out, "corrupto.mp3"), Buffer.from("esto no es audio ".repeat(200)));

let hasFfmpeg = true;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  hasFfmpeg = false;
  console.log("ffmpeg no encontrado: solo se generaron WAV y el archivo corrupto.");
}

if (hasFfmpeg) {
  const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  // [archivo, título, artista, álbum, nº, año, género, freq, seg, colores de portada, args de códec]
  const tracks = [
    ["01-amanecer.flac", "Amanecer en La", "Los Osciladores", "Ondas Puras", 1, 2024, "Electrónica", 440, 8, ["#c2410c", "#1e3a8a"], ["-c:a", "flac"]],
    ["02-marea.flac", "Marea de Fase", "Los Osciladores", "Ondas Puras", 2, 2024, "Electrónica", 392, 6, ["#c2410c", "#1e3a8a"], ["-c:a", "flac"]],
    ["03-hires.flac", "Noventa y Seis Mil", "Cuarteto Nyquist", "Alta Resolución", 1, 2025, "Ambient", 261, 6, ["#0f766e", "#022c22"], ["-c:a", "flac", "-sample_fmt", "s32", "-bits_per_raw_sample", "24", "-ar", "96000"]],
    ["04-senoidal.mp3", "Senoidal Nocturna", "Ana Armónica", "Frecuencias", 1, 2023, "Pop", 349, 7, ["#be185d", "#312e81"], ["-c:a", "libmp3lame", "-b:a", "320k", "-id3v2_version", "3"]],
    ["05-titulo-largo.mp3", "Un Título Deliberadamente Larguísimo Para Probar el Truncamiento en Pantallas Pequeñas", "Ana Armónica con la Orquesta Sinfónica de Pruebas", "Frecuencias", 2, 2023, "Pop", 294, 5, ["#be185d", "#312e81"], ["-c:a", "libmp3lame", "-b:a", "192k", "-id3v2_version", "3"]],
    ["06-cuadrada.m4a", "Onda Cuadrada", "Ñandú Eléctrico", "Canción de Prueba", 1, 2022, "Rock", 220, 6, ["#ca8a04", "#431407"], ["-c:a", "aac", "-b:a", "256k"]],
    ["07-opus.opus", "Códec Abierto", "Ñandú Eléctrico", "Canción de Prueba", 2, 2022, "Rock", 587, 5, null, ["-c:a", "libopus", "-b:a", "128k"]],
    ["08-vorbis.ogg", "Vorbis Vespertino", "Cuarteto Nyquist", "Alta Resolución", 2, 2025, "Ambient", 466, 5, null, ["-c:a", "libvorbis"]],
    ["09-sin-portada.flac", "Sin Portada", "Anónimo", "", 0, 0, "", 311, 4, null, ["-c:a", "flac"]],
  ];
  for (const [file, title, artist, album, no, year, genre, freq, sec, colors, codec] of tracks) {
    const target = join(out, file);
    if (existsSync(target)) continue;
    const meta = [["title", title], ["artist", artist], ["album", album], ["track", no], ["date", year], ["genre", genre]]
      .filter(([, v]) => v)
      .flatMap(([k, v]) => ["-metadata", `${k}=${v}`]);
    const audio = ["-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${sec}`];
    if (colors) {
      const cover = join(out, `${file}.png`);
      ff(["-f", "lavfi", "-i", `gradients=s=600x600:c0=${colors[0]}:c1=${colors[1]}:x0=0:y0=0:x1=600:y1=600`, "-frames:v", "1", cover]);
      ff([...audio, "-i", cover, "-map", "0:a", "-map", "1:v", ...codec, "-c:v", "png", "-disposition:v", "attached_pic", ...meta, target]);
    } else {
      ff([...audio, ...codec, ...meta, target]);
    }
  }
}
// Letras en etiquetas ID3v2.3 de verdad (ffmpeg las escribe como TXXX, no como USLT/SYLT): se construyen aquí.
if (hasFfmpeg) {
  const frame = (id, body) => {
    const head = Buffer.alloc(10);
    head.write(id, 0, "ascii");
    head.writeUInt32BE(body.length, 4);
    return Buffer.concat([head, body]);
  };
  const latin = (text) => Buffer.from(`${text}\0`, "latin1");
  const tag = (frames) => {
    const body = Buffer.concat(frames);
    const head = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0]);
    for (let i = 0; i < 4; i++) head[9 - i] = (body.length >> (7 * i)) & 0x7f; // tamaño "syncsafe"
    return Buffer.concat([head, body]);
  };
  const lyricMp3 = (file, title, lyricFrame) => {
    const target = join(out, file);
    if (existsSync(target)) return;
    const raw = join(out, `${file}.raw.mp3`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:duration=5", "-c:a", "libmp3lame", "-b:a", "128k", "-write_id3v2", "0", raw]);
    const text = (value) => frame(value[0], Buffer.concat([Buffer.from([0]), latin(value[1])]));
    writeFileSync(target, Buffer.concat([tag([text(["TIT2", title]), text(["TPE1", "Ana Armónica"]), text(["TALB", "Frecuencias"]), lyricFrame]), readFileSync(raw)]));
    rmSync(raw);
  };
  // USLT: codificación, idioma, descriptor vacío y el texto (aquí con marcas LRC dentro).
  lyricMp3("10-letra.mp3", "Con Letra", frame("USLT", Buffer.concat([Buffer.from([0]), Buffer.from("spa"), latin(""), Buffer.from("[00:00.50]Verso uno de prueba\n[00:02.00]Verso dos de prueba", "latin1")])));
  // SYLT: formato 2 (milisegundos), tipo 1 (letra) y pares texto + marca de 4 bytes.
  const entries = [["Primera línea SYLT", 300], ["Segunda línea SYLT", 1800]].map(([line, ms]) => {
    const stamp = Buffer.alloc(4);
    stamp.writeUInt32BE(ms);
    return Buffer.concat([latin(line), stamp]);
  });
  lyricMp3("11-sylt.mp3", "Letra Sincronizada", frame("SYLT", Buffer.concat([Buffer.from([0]), Buffer.from("spa"), Buffer.from([2, 1]), latin(""), ...entries])));
}
console.log(`Audio sintético listo en ${out}`);
