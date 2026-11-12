// Descarga la música y las portadas de ejemplo de la landing desde Wikimedia Commons, VERIFICA la licencia de cada archivo antes
// de usarlo (solo CC0 o dominio público: si Commons dice otra cosa, aborta), les pone etiquetas y portada con ffmpeg y escribe CREDITOS.md.
// Uso: node scripts/descargar-musica-landing.mjs [carpeta]   (por defecto tests/fixtures/landing, ignorada por git: el audio nunca se versiona)
// Requiere red y `ffmpeg` en el PATH. Después: node scripts/gen-landing.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? join(import.meta.dirname, "..", "tests", "fixtures", "landing");
mkdirSync(out, { recursive: true });
const API = "https://commons.wikimedia.org/w/api.php";
const headers = { "User-Agent": "MusicReproductorLandingFixtures/1.0 (script local; descarga de ejemplos con licencia libre)" };

const GOLDBERG = { artist: "Kimiko Ishizaka", album: "The Open Goldberg Variations", year: "2012", genre: "Clásica", cover: "File:Johann Sebastian Bach 1746.jpg", gravity: "top" };
const faulkner = { artist: "Luke Faulkner", album: "Chopin: Nocturnes", genre: "Clásica", cover: "File:Frédéric Chopin - Eugène Delacroix - Musée du Louvre Peintures RF 1717.jpg", gravity: "top" };
const gurevich = { artist: "Olga Gurevich", album: "Chopin: Nocturnes", genre: "Clásica", cover: "File:Frederic Chopin photo.jpeg", gravity: "top" };
const hughes = { artist: "Diana Hughes", album: "Chopin: Nocturnes", genre: "Clásica", cover: "File:ChopinSandDelacroix.jpg", gravity: "center" };
const joplin = { artist: "Scott Joplin", album: "Maple Leaf Rag", year: "1916", genre: "Ragtime", cover: "File:Maple Leaf Rag 1st ed.jpg", gravity: "top" };

const tracks = [
  { file: "File:Kimiko Ishizaka - 01 - Aria.ogg", title: "Aria", track: 1, ...GOLDBERG },
  { file: "File:Kimiko Ishizaka - 02 - Variatio 1 a 1 Clav.ogg", title: "Variatio 1 a 1 Clav.", track: 2, ...GOLDBERG },
  { file: "File:Kimiko Ishizaka - 14 - Variatio 13 a 2 Clav.ogg", title: "Variatio 13 a 2 Clav.", track: 14, ...GOLDBERG },
  { file: "File:Kimiko Ishizaka - 22 - Variatio 21 Canone alla Settima.ogg", title: "Variatio 21 Canone alla Settima", track: 22, ...GOLDBERG },
  { file: "File:Kimiko Ishizaka - 26 - Variatio 25 a 2 Clav.ogg", title: "Variatio 25 a 2 Clav.", track: 26, ...GOLDBERG },
  { file: "File:Chopin Nocturne in C minor Op. 48 no. 1 Luke Faulkner.ogg", title: "Nocturne in C minor, Op. 48 No. 1", track: 1, ...faulkner },
  { file: "File:Chopin Nocturne in G minor, Op 15 no 3 Olga Gurevich.ogg", title: "Nocturne in G minor, Op. 15 No. 3", track: 1, ...gurevich },
  { file: "File:Frederic Chopin - nocturne no. 1 in b major, op. 62.oga", title: "Nocturne in B major, Op. 62 No. 1", track: 2, ...gurevich },
  { file: "File:Chopin - Nocturne No. 21 in C minor, B. 108 (Diana Hughes).flac", title: "Nocturne No. 21 in C minor, B. 108", track: 1, ...hughes },
  { file: "File:Maple Leaf Rag - played by Scott Joplin 1916 sample.ogg", title: "Maple Leaf Rag (rollo de pianola, 1916)", track: 1, ...joplin },
];

const FREE = /^(CC0|Public domain|PD)\b/i;

// Una sola petición para todos los archivos: la API de Commons limita las peticiones y esto es mucho más amable.
async function infoAll(titles) {
  const url = `${API}?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata%7Cmime&iiurlwidth=1000&iiextmetadatafilter=LicenseShortName%7CLicenseUrl%7CArtist%7CAttributionRequired%7CCredit&titles=${encodeURIComponent(titles.join("|"))}`;
  let data;
  for (let attempt = 1; !data; attempt++) {
    const text = await (await fetch(url, { headers })).text();
    try {
      data = JSON.parse(text);
    } catch {
      if (attempt === 5) throw new Error(`Commons no responde con JSON: ${text.slice(0, 80)}`); // falla a la vista, nunca sigue con datos falsos
      console.log(`Commons limita las peticiones; reintento ${attempt}/4 en 60 s…`);
      await new Promise((resolve) => setTimeout(resolve, 60_000));
    }
  }
  const renamed = new Map((data.query.normalized ?? []).map(({ from, to }) => [from, to]));
  const pages = new Map(Object.values(data.query.pages).map((page) => [page.title, page]));
  return new Map(
    titles.map((title) => {
      const meta = pages.get(renamed.get(title) ?? title)?.imageinfo?.[0];
      if (!meta) throw new Error(`No existe en Commons: ${title}`);
      const text = (field) => (meta.extmetadata[field]?.value ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const license = text("LicenseShortName");
      if (!FREE.test(license) || text("AttributionRequired") === "true") throw new Error(`LICENCIA NO ADMITIDA (${license || "desconocida"}): ${title}`);
      return [title, { url: meta.mime.startsWith("image/") ? (meta.thumburl ?? meta.url) : meta.url, license, licenseUrl: text("LicenseUrl"), author: text("Artist"), page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}` }];
    }),
  );
}

async function download(meta, name) {
  const path = join(out, name);
  if (existsSync(path)) return path;
  for (let attempt = 1; ; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2500)); // sin ráfagas contra upload.wikimedia.org
    const response = await fetch(meta.url, { headers });
    if (response.ok) {
      writeFileSync(path, Buffer.from(await response.arrayBuffer()));
      return path;
    }
    if (response.status !== 429 || attempt === 6) throw new Error(`${response.status} al descargar ${meta.url}`);
    const wait = Math.max(Number(response.headers.get("retry-after")) || 0, 30) * 1000;
    console.log(`429 en ${name}; espero ${wait / 1000} s (intento ${attempt}/5)`);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

const ffmpeg = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
const credits = [];
const covers = new Map();

// 1) Verificar TODAS las licencias antes de descargar nada.
const verified = await infoAll([...tracks.map((t) => t.file), ...new Set(tracks.map((t) => t.cover))]);
for (const [item, meta] of verified) console.log(`licencia OK  ${meta.license.padEnd(14)} ${item}`);

// 2) Portadas: recorte cuadrado de 800 px (JPEG) y pistas con etiquetas + portada, sin recodificar el audio.
for (const cover of new Set(tracks.map((t) => t.cover))) {
  const raw = await download(verified.get(cover), `cover-raw-${covers.size}${cover.slice(cover.lastIndexOf("."))}`);
  const square = join(out, `cover-${covers.size}.jpg`);
  const gravity = tracks.find((t) => t.cover === cover).gravity === "top" ? ":0:0" : "";
  ffmpeg("-i", raw, "-vf", `scale=800:800:force_original_aspect_ratio=increase,crop=800:800${gravity}`, "-frames:v", "1", "-q:v", "3", square);
  covers.set(cover, square);
}
let n = 0;
for (const t of tracks) {
  const meta = verified.get(t.file);
  const raw = await download(meta, `raw-${n}${t.file.slice(t.file.lastIndexOf("."))}`);
  const ext = t.file.endsWith(".flac") ? "flac" : "ogg";
  const target = join(out, `${String(n + 1).padStart(2, "0")}-${t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}.${ext}`);
  const tags = { title: t.title, artist: t.artist, album_artist: t.artist, album: t.album, track: String(t.track), genre: t.genre, ...(t.year && { date: t.year }) };
  if (ext === "flac") {
    ffmpeg("-i", raw, "-i", covers.get(t.cover), "-map", "0:a", "-map", "1:v", "-c", "copy", "-disposition:v", "attached_pic", ...Object.entries(tags).flatMap(([k, v]) => ["-metadata", `${k}=${v}`]), target);
  } else {
    // El muxer Ogg de ffmpeg no admite imágenes adjuntas: la portada va como METADATA_BLOCK_PICTURE (bloque de imagen de FLAC en base64),
    // que es la forma estándar en Vorbis. Va en un archivo ffmetadata porque en la línea de comandos no cabe (≈ 130 KB).
    const jpeg = readFileSync(covers.get(t.cover));
    const u32 = (value) => Buffer.from([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
    const mime = Buffer.from("image/jpeg");
    const picture = Buffer.concat([u32(3), u32(mime.length), mime, u32(0), u32(800), u32(800), u32(24), u32(0), u32(jpeg.length), jpeg]).toString("base64");
    const escape = (text) => text.replace(/[=;#\\\n]/g, "\\$&"); // ffmetadata escapa = ; # \ y el salto de línea con una barra
    const metaFile = join(out, `meta-${n}.txt`);
    const lines = Object.entries({ ...tags, METADATA_BLOCK_PICTURE: picture }).map(([k, v]) => `${k}=${escape(v)}`);
    writeFileSync(metaFile, [";FFMETADATA1", ...lines, ""].join("\n"));
    // Las etiquetas viejas del archivo (algunos traen marcadores como «The Title») se descartan: las de Vorbis van en el stream de audio.
    ffmpeg("-i", raw, "-i", metaFile, "-map", "0:a", "-map_metadata:g", "-1", "-map_metadata:s:a:0", "1:g", "-c", "copy", target);
  }
  credits.push({ ...t, ...meta });
  n += 1;
}

const row = (cells) => `| ${cells.join(" | ")} |`;
const coverCredits = [...covers.keys()].map((cover) => ({ cover, ...verified.get(cover) }));
writeFileSync(
  join(import.meta.dirname, "..", "CREDITOS.md"),
  `# Créditos de la música y las imágenes de las capturas

Las capturas de la landing (\`src/assets/landing/\`) se hicieron con la música y las portadas de abajo. Todo es **CC0 o dominio público**,
comprobado archivo por archivo en Wikimedia Commons por \`scripts/descargar-musica-landing.mjs\` (si una licencia no es CC0 o dominio
público, el script aborta). **El audio no está en el repositorio**: \`npm run landing:musica\` lo descarga a \`tests/fixtures/landing/\` (ignorada por git).
Las portadas son obras o fotografías de dominio público que elegimos nosotros: no son las portadas de ninguna edición comercial. Los álbumes
«Chopin: Nocturnes» son una agrupación nuestra de grabaciones sueltas de Musopen para que la biblioteca tenga varios intérpretes.

## Música

${row(["Pista", "Intérprete", "Licencia", "Fuente"])}
${row(["---", "---", "---", "---"])}
${credits.map((c) => row([`${c.title}`, c.artist, c.licenseUrl ? `[${c.license}](${c.licenseUrl})` : c.license, `[Commons](${c.page})`])).join("\n")}

## Portadas

${row(["Imagen", "Autor", "Licencia", "Fuente"])}
${row(["---", "---", "---", "---"])}
${coverCredits.map((c) => row([c.cover.replace("File:", ""), c.author || "(ver la página)", c.licenseUrl ? `[${c.license}](${c.licenseUrl})` : c.license, `[Commons](${c.page})`])).join("\n")}
`,
);
console.log(`\n${tracks.length} pistas y ${covers.size} portadas en ${out}; créditos en CREDITOS.md`);
