// Prueba de la vuelta de un enlace de correo (enlace mágico / confirmación) en Chromium contra `npm run dev`.
// Uso: node scripts/prueba-enlace-magico.mjs [url-base]. Requiere VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.
// Supabase devuelve al usuario con los tokens en el hash (#access_token=…, flujo implícito). La prueba simula esa vuelta con la red de
// Supabase interceptada (nunca toca el proyecto real) y comprueba que la sesión se guarda y el hash desaparece, tanto si vuelve a la
// landing (/) como a la app (/app). Cubre el riesgo de crear el cliente de Supabase tarde. Sale con 1 si algo falla.
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "prueba@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, aud: "authenticated", role: "authenticated", email: user.email, exp })}.firma-falsa`;
const hash = `#access_token=${token}&expires_at=${exp}&expires_in=3600&refresh_token=refresco-falso&token_type=bearer&type=magiclink`;

const browser = await chromium.launch();
const supabaseCalls = [];
/** Sesión guardada por supabase-js (sb-<ref>-auth-token) y hash actual. */
const state = (page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k));
    return { token: key ? JSON.parse(localStorage.getItem(key)).access_token : null, hash: location.hash };
  });

async function landOn(path) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("**/demoCatalog.dev.ts*", (route) => route.fulfill({ contentType: "text/javascript", body: "export const demoFiles = [];" }));
  await context.route(/supabase\.co\//, (route) => {
    const { pathname } = new URL(route.request().url());
    supabaseCalls.push(`${route.request().method()} ${pathname}`);
    if (pathname === "/auth/v1/user") return route.fulfill({ json: user });
    if (pathname.startsWith("/rest/v1/")) return route.fulfill({ json: [] });
    return route.abort();
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}${path}${hash}`);
  await page.waitForFunction((expected) => Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k) && localStorage.getItem(k).includes(expected)), token, { timeout: 10_000 }).catch(() => {});
  return { context, page, errors };
}

// 1. Vuelve a la landing (la URL del sitio por defecto en Supabase).
{
  const { context, page, errors } = await landOn("/");
  const after = await state(page);
  check("landing: la sesión del enlace se guarda", after.token === token);
  check("landing: los tokens desaparecen de la URL", after.hash === "", after.hash.slice(0, 40));
  await page.goto(`${base}/app`);
  await page.getByRole("button", { name: "Cuenta" }).waitFor({ timeout: 10_000 }).catch(() => {});
  check("landing → /app: la app arranca con la sesión", (await page.getByRole("button", { name: "Cuenta" }).count()) === 1);
  check("landing: sin errores", errors.length === 0, errors.join(" | "));
  await context.close();
}

// 2. Vuelve directamente a la app.
{
  const { context, page, errors } = await landOn("/app");
  const after = await state(page);
  check("/app: la sesión del enlace se guarda", after.token === token);
  check("/app: los tokens desaparecen de la URL", after.hash === "", after.hash.slice(0, 40));
  await page.getByRole("button", { name: "Cuenta" }).waitFor({ timeout: 10_000 }).catch(() => {});
  check("/app: muestra la cuenta sin recargar", (await page.getByRole("button", { name: "Cuenta" }).count()) === 1);
  check("/app: sin errores", errors.length === 0, errors.join(" | "));
  await context.close();
}

check("la red de Supabase se interceptó (no se tocó el proyecto real)", supabaseCalls.includes("GET /auth/v1/user"), supabaseCalls.join(", "));
await browser.close();
process.exit(failed ? 1 : 0);
