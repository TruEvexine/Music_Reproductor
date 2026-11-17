// Prueba de Ajustes → Privacidad y datos en Chromium contra `npm run dev`. Uso: node scripts/prueba-privacidad.mjs [url-base] [carpeta-capturas]
// Requiere VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env. La red de Supabase está interceptada (nunca toca el proyecto real).
// Comprueba: «Qué se guarda» con cifras reales; borrar el historial de Recientes; la casilla «Cerrar también la sesión» (con ella no queda
// ninguna clave sb-* en localStorage; sin ella la sesión sigue); y «Datos de tu cuenta» (solo con sesión) con el formato de la copia.
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "vite";
import "./requiere-audio.mjs";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const shots = process.argv[3];
if (shots) mkdirSync(shots, { recursive: true });
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = ["01-amanecer.flac", "02-marea.flac", "03-hires.flac"].map((name) => join(fixtures, name));

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const wait = (page, ms) => page.waitForTimeout(ms);

// Sesión de mentira que supabase-js acepta sin red: se deja en localStorage antes de cargar, como si se hubiera iniciado sesión antes.
const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "prueba@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-02T03:04:05Z" };
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, aud: "authenticated", role: "authenticated", email: user.email, exp })}.firma-falsa`;
const storageKey = `sb-${new URL(loadEnv("development", process.cwd(), "VITE_").VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
const session = { access_token: token, refresh_token: "refresco-falso", expires_at: exp, expires_in: 3600, token_type: "bearer", user };
const sessionKeys = (page) => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("sb-")));

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], });
const errors = [];
const calls = [];

async function open({ signedIn = false, viewport = { width: 1440, height: 900 }, downloads = false } = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: downloads });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await context.route(/supabase\.co\//, (route) => {
    const { pathname } = new URL(route.request().url());
    calls.push(`${route.request().method()} ${pathname}`);
    if (pathname === "/auth/v1/user") return route.fulfill({ json: user });
    if (pathname === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" });
    if (pathname === "/rest/v1/profiles") return route.fulfill({ json: { display_name: "Ana", created_at: "2026-01-02T03:04:05Z" } });
    if (pathname === "/rest/v1/playlists") return route.fulfill({ json: [{ id: "11111111-1111-4111-8111-111111111111", name: "Viaje", created_at: "2026-02-01T00:00:00Z" }] });
    if (pathname === "/rest/v1/playlist_tracks") return route.fulfill({ json: [{ playlist_id: "11111111-1111-4111-8111-111111111111", track_identifier: "track:v1:a%7Cb%7Cc%7C60", position: 0 }] });
    return route.abort();
  });
  // Solo en la primera carga: tras «Borrar datos» la página se recarga y la sesión no debe reaparecer.
  if (signedIn) await context.addInitScript(({ key, session }) => sessionStorage.getItem("sembrado") || (sessionStorage.setItem("sembrado", "1"), localStorage.setItem(key, JSON.stringify(session))), { key: storageKey, session });
  await page.goto(`${base}/app`);
  await wait(page, 600);
  return { context, page };
}
const addMusic = async (page) => {
  await page.getByLabel("Elegir archivos de música").setInputFiles(files);
  await wait(page, 2200);
};
const goSettings = async (page) => {
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
  await wait(page, 600);
};
const stored = async (page) => Object.fromEntries(await page.locator(".stored > div").evaluateAll((rows) => rows.map((row) => [row.querySelector("dt").textContent, row.querySelector("dd").textContent])));

// ── 1. Sin cuenta: qué se guarda y borrar Recientes ──
{
  const { context, page } = await open();
  await addMusic(page);
  await goSettings(page);
  const rows = await stored(page);
  check("«Qué se guarda»: canciones y carpetas reales", /^3 canciones de \d+ carpetas?$/.test(rows["Canciones en la biblioteca"] ?? ""), rows["Canciones en la biblioteca"]);
  check("«Qué se guarda»: portadas, copias y playlists con valor", ["Portadas", "Copias de música", "Playlists"].every((label) => rows[label] && rows[label] !== "Calculando…"), JSON.stringify(rows));
  check("«Qué se guarda»: sin cuenta, nada sale del dispositivo", rows["Cuenta"] === "Sin cuenta: nada sale de este dispositivo", rows["Cuenta"]);
  check("«Qué se guarda»: no hay fila de cambios pendientes cuando son 0", !("Cambios pendientes de subir" in rows));
  check("la frase fija sobre lo que se sincroniza está", (await page.getByText("Tus archivos de música nunca se suben.").count()) === 1);
  check("sin sesión no hay «Datos de tu cuenta»", (await page.getByRole("heading", { name: "Datos de tu cuenta" }).count()) === 0);
  if (shots) await page.screenshot({ path: join(shots, "privacidad-1440x900.png"), fullPage: false });
  await page.getByRole("heading", { name: "Privacidad y datos" }).scrollIntoViewIfNeeded();

  // Recientes: la pista que suena sube al primer puesto; al borrar el historial, vuelve el orden de entrada.
  await page.locator(".nav").getByRole("link", { name: "Biblioteca", exact: true }).click();
  await wait(page, 500);
  await page.locator(".track-row .row-main").nth(1).click();
  await wait(page, 700);
  await page.getByRole("link", { name: "Recientes", exact: true }).click();
  await wait(page, 400);
  const first = () => page.locator(".track-row .title").first().innerText();
  const playedFirst = await first();
  await goSettings(page);
  await page.getByRole("button", { name: "Borrar el historial de Recientes" }).click();
  await wait(page, 300);
  check("borrar Recientes pide confirmación con el texto de la especificación", (await page.locator("dialog[open]").innerText()).includes("solo se olvida cuándo sonaron"));
  await page.locator("dialog[open]").getByRole("button", { name: "Cancelar" }).click();
  await wait(page, 300);
  await page.getByRole("button", { name: "Borrar el historial de Recientes" }).click();
  await wait(page, 300);
  await page.locator("dialog[open]").getByRole("button", { name: "Borrar historial" }).click();
  await wait(page, 600);
  check("borrar Recientes avisa", (await page.locator(".toast").innerText().catch(() => "")).includes("Historial de Recientes borrado"));
  await page.locator(".nav").getByRole("link", { name: "Biblioteca", exact: true }).click();
  await wait(page, 500);
  await page.getByRole("link", { name: "Recientes", exact: true }).click();
  await wait(page, 400);
  const clearedFirst = await first();
  check("borrar Recientes: la canción que sonó deja de ir la primera, y las canciones siguen", clearedFirst !== playedFirst && (await page.locator(".track-row").count()) === 3, `${playedFirst} → ${clearedFirst}`);
  await context.close();
}

// ── 2. Con cuenta, borrar datos cerrando la sesión ──
{
  const { context, page } = await open({ signedIn: true });
  await addMusic(page);
  await goSettings(page);
  await page.getByRole("heading", { name: "Datos de tu cuenta" }).waitFor({ timeout: 5000 }).catch(() => {});
  const rows = await stored(page);
  check("con sesión: «Cuenta» enseña el correo recortado", rows["Cuenta"] === "Conectado como p…@example.com", rows["Cuenta"]);
  check("con sesión hay clave sb-* antes de borrar", (await sessionKeys(page)).length > 0);
  await page.getByRole("button", { name: "Borrar datos de este dispositivo" }).click();
  await wait(page, 300);
  const box = page.locator("dialog[open] input[type=checkbox]");
  check("la casilla «Cerrar también la sesión» sale marcada por defecto", (await box.count()) === 1 && (await box.isChecked()) && (await page.locator("dialog[open]").innerText()).includes("Cerrar también la sesión"));
  if (shots) await page.screenshot({ path: join(shots, "privacidad-borrar-1440x900.png") });
  await page.locator("dialog[open]").getByRole("button", { name: "Borrar todo" }).click();
  await page.waitForLoadState("load");
  await wait(page, 1800);
  check("borrar cerrando la sesión pidió el cierre al servidor", calls.includes("POST /auth/v1/logout"), calls.filter((c) => c.includes("logout")).join(","));
  check("tras borrar con la casilla no queda ninguna clave sb-* en localStorage", (await sessionKeys(page)).length === 0, (await sessionKeys(page)).join(","));
  await context.close();
}

// ── 3. Con cuenta, borrar datos sin cerrar la sesión ──
{
  const { context, page } = await open({ signedIn: true });
  await addMusic(page);
  await goSettings(page);
  await page.getByRole("button", { name: "Borrar datos de este dispositivo" }).click();
  await wait(page, 300);
  await page.locator("dialog[open] input[type=checkbox]").uncheck();
  check("sin la casilla avisa de que las playlists volverán a bajar", (await page.locator("dialog[open]").innerText()).includes("volverán a bajar"));
  await page.locator("dialog[open]").getByRole("button", { name: "Borrar todo" }).click();
  await page.waitForLoadState("load");
  await wait(page, 1800);
  check("sin la casilla la sesión sigue (clave sb-* intacta)", (await sessionKeys(page)).length > 0);
  await context.close();
}

// ── 4. Datos de tu cuenta ──
{
  const { context, page } = await open({ signedIn: true, downloads: true });
  await goSettings(page);
  await page.getByRole("button", { name: "Descargar datos de la cuenta" }).waitFor({ timeout: 5000 });
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar datos de la cuenta" }).click()]);
  const data = JSON.parse(readFileSync(await download.path(), "utf8"));
  check("datos de la cuenta: nombre del archivo y tipo", /^reproductor-cuenta-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()) && data.app === "reproductor" && data.kind === "account" && data.version === 1);
  check("datos de la cuenta: perfil y playlists de la nube", data.profile?.display_name === "Ana" && data.profile?.created_at === "2026-01-02T03:04:05Z" && JSON.stringify(data.playlists) === JSON.stringify([{ name: "Viaje", tracks: ["track:v1:a%7Cb%7Cc%7C60"] }]), JSON.stringify(data).slice(0, 200));
  check("datos de la cuenta: avisa de que descargó", (await page.getByText("Archivo descargado.").count()) === 1);
  await context.close();
}

// ── 5. Móvil: sin desbordes y táctil de 44 px ──
{
  const { context, page } = await open({ viewport: { width: 390, height: 844 } });
  await addMusic(page);
  await goSettings(page);
  await page.getByRole("heading", { name: "Privacidad y datos" }).scrollIntoViewIfNeeded();
  await wait(page, 300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(".main")].some((el) => el.scrollWidth > el.clientWidth + 1));
  const small = await page.evaluate(() => [...document.querySelectorAll(".settings button, .settings input:not(.visually-hidden)")].filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && (r.width < 44 || r.height < 44) && !el.closest("[inert]"); }).map((el) => el.className || el.tagName));
  check("móvil: sin scroll horizontal", !overflow);
  check("móvil: áreas táctiles de 44 px o más en Ajustes", small.length === 0, small.join(","));
  if (shots) {
    await page.screenshot({ path: join(shots, "privacidad-390x844.png") });
    await page.getByRole("button", { name: "Borrar datos de este dispositivo" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(shots, "privacidad-borrar-390x844.png") });
  }
  await context.close();
}

check("la red de Supabase se interceptó (no se tocó el proyecto real)", calls.length > 0 && calls.every((call) => call.includes("/auth/v1/") || call.includes("/rest/v1/")));
check("sin errores de página", errors.length === 0, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
