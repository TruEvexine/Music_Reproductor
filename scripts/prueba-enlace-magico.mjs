// Prueba de la vuelta de un enlace de correo (confirmación de registro) en Chromium contra `npm run dev`.
// Uso: node scripts/prueba-enlace-magico.mjs [url-base]. Requiere VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.
// Con PKCE (S-01), Supabase devuelve al usuario con ?code=…, que solo se canjea con el verificador guardado en el navegador que pidió el
// enlace. La red de Supabase va interceptada (nunca toca el proyecto real). Comprueba: (a) unos tokens en el hash (#access_token=…,
// flujo implícito) no crean sesión y desaparecen de la URL; (b) ?code con verificador inicia sesión, en la landing y en /app, una sola vez;
// (c) una sesión abierta no se sustituye por la de un enlace; y el aviso cuando el enlace se abre en otro navegador o ha caducado.
// Sale con 1 si algo falla.
import { chromium } from "@playwright/test";
import { loadEnv } from "vite";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const env = loadEnv("development", process.cwd(), "VITE_");
const storageKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
function account(n) {
  const user = { id: `00000000-0000-4000-8000-00000000000${n}`, aud: "authenticated", role: "authenticated", email: `prueba${n}@example.com`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, aud: "authenticated", role: "authenticated", email: user.email, exp })}.firma-falsa`;
  return { user, token, session: { access_token: token, refresh_token: `refresco-${n}`, expires_at: exp, expires_in: 3600, token_type: "bearer", user } };
}
const mine = account(1); // la que ya tenía el navegador
const linked = account(2); // la del enlace
const hash = `#access_token=${linked.token}&expires_at=${exp}&expires_in=3600&refresh_token=refresco-falso&token_type=bearer&type=signup`;

const browser = await chromium.launch();
const tokenCalls = [];
const supabaseCalls = [];

/** Abre `path` con lo que haya en localStorage antes de cargar: sesión previa y/o verificador PKCE (lo que deja signUp en este navegador). */
async function open(path, { session, verifier = false } = {}) {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ key, session, verifier }) => {
      if (sessionStorage.getItem("sembrado")) return; // solo en la primera carga: recargar no vuelve a sembrar
      sessionStorage.setItem("sembrado", "1");
      if (session) localStorage.setItem(key, JSON.stringify(session));
      if (verifier) localStorage.setItem(`${key}-code-verifier`, JSON.stringify("verificador-de-este-navegador"));
    },
    { key: storageKey, session, verifier },
  );
  const page = await context.newPage();
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await context.route(/supabase\.co\//, (route) => {
    const { pathname, search } = new URL(route.request().url());
    supabaseCalls.push(`${route.request().method()} ${pathname}`);
    if (pathname === "/auth/v1/token" && search.includes("grant_type=pkce")) {
      tokenCalls.push(route.request().postDataJSON());
      return route.fulfill({ json: linked.session });
    }
    if (pathname === "/auth/v1/user") return route.fulfill({ json: linked.user });
    if (pathname.startsWith("/rest/v1/")) return route.fulfill({ json: [] });
    return route.abort();
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => /access_token|refresco-falso/.test(message.text()) && errors.push(`token en consola: ${message.text().slice(0, 60)}`));
  await page.goto(`${base}${path}`);
  await page.waitForTimeout(1500);
  return { context, page, errors };
}
const state = (page) =>
  page.evaluate((key) => ({ token: JSON.parse(localStorage.getItem(key) ?? "null")?.access_token ?? null, url: location.pathname + location.search + location.hash }), storageKey);
const accountButton = (page) => page.getByRole("button", { name: "Cuenta", exact: true });

// (a) Tokens en el hash: ya no inician sesión, ni en la landing ni en la app.
for (const path of ["/", "/app"]) {
  const { context, page, errors } = await open(`${path}${hash}`);
  const after = await state(page);
  check(`(a) ${path}: los tokens del hash no crean sesión`, after.token === null, after.token?.slice(0, 20));
  check(`(a) ${path}: los tokens desaparecen de la URL`, !after.url.includes("access_token"), after.url.slice(0, 50));
  check(`(a) ${path}: sin errores ni tokens en consola`, errors.length === 0, errors.join(" | "));
  await context.close();
}
check("(a) nunca se pidió /auth/v1/user con el token del hash", !supabaseCalls.includes("GET /auth/v1/user"), supabaseCalls.join(", "));

// (b) ?code con el verificador de este navegador: inicia sesión una sola vez.
for (const path of ["/", "/app"]) {
  tokenCalls.length = 0;
  const { context, page, errors } = await open(`${path}?code=codigo-valido`, { verifier: true });
  const after = await state(page);
  check(`(b) ${path}: el código se canjea y la sesión se guarda`, after.token === linked.token);
  check(`(b) ${path}: se canjea con el verificador de este navegador`, tokenCalls[0]?.code_verifier === "verificador-de-este-navegador", JSON.stringify(tokenCalls[0]));
  check(`(b) ${path}: el código desaparece de la URL`, after.url === path, after.url);
  await page.reload();
  await page.waitForTimeout(1000);
  check(`(b) ${path}: el código se procesa una sola vez (también al recargar)`, tokenCalls.length === 1, String(tokenCalls.length));
  if (path === "/") await page.goto(`${base}/app`);
  await accountButton(page).waitFor({ timeout: 10_000 }).catch(() => {});
  check(`(b) ${path}: la app muestra la cuenta`, (await accountButton(page).count()) === 1);
  check(`(b) ${path}: sin errores`, errors.length === 0, errors.join(" | "));
  await context.close();
}

// (c) Ya había sesión: un enlace (aunque traiga código y haya verificador) no la sustituye.
{
  tokenCalls.length = 0;
  const { context, page, errors } = await open("/app?code=codigo-ajeno", { session: mine.session, verifier: true });
  const after = await state(page);
  check("(c) la sesión abierta sigue siendo la misma", after.token === mine.token);
  check("(c) el código ajeno ni se intenta canjear", tokenCalls.length === 0, String(tokenCalls.length));
  check("(c) el código desaparece de la URL", after.url === "/app", after.url);
  check("(c) sin errores", errors.length === 0, errors.join(" | "));
  await context.close();
}

// Enlace abierto en otro navegador (sin verificador) o caducado: aviso claro y forma de pedir otro.
for (const [name, path, text] of [
  ["otro navegador", "/app?code=codigo-de-otro-navegador", "Abre el enlace en el mismo navegador donde lo pediste."],
  ["otro navegador (vuelve a la landing)", "/?code=codigo-de-otro-navegador", "Abre el enlace en el mismo navegador donde lo pediste."],
  ["caducado", "/app?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", "El enlace caducó o ya se usó."],
]) {
  tokenCalls.length = 0;
  const { context, page, errors } = await open(path);
  const dialog = page.locator("dialog.dialog[open]");
  await dialog.waitFor({ timeout: 10_000 }).catch(() => {});
  check(`${name}: aviso «El enlace no funcionó»`, (await dialog.getAttribute("aria-label").catch(() => null)) === "El enlace no funcionó");
  check(`${name}: explica qué hacer`, (await dialog.getByText(text, { exact: true }).count()) === 1);
  check(`${name}: ofrece pedir un enlace nuevo`, (await dialog.getByRole("button", { name: "Pedir un enlace nuevo" }).count()) === 1);
  const after = await state(page);
  check(`${name}: no hay sesión y la URL queda limpia`, after.token === null && after.url === "/app", `${after.token} ${after.url}`);
  check(`${name}: sin canje en el servidor`, tokenCalls.length === 0, String(tokenCalls.length));
  check(`${name}: sin errores`, errors.length === 0, errors.join(" | "));
  await context.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
