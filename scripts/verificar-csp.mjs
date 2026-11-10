// Verifica la CSP de vercel.json contra el build real. Uso: npm run build && node scripts/verificar-csp.mjs
// Levanta `vite preview` (que sirve las mismas cabeceras), importa audio sintético, reproduce,
// intenta un inicio de sesión falso y falla si el navegador registra una violación de CSP.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const port = 4179;
const server = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], { shell: true, stdio: "ignore" });
const url = `http://localhost:${port}/app`;
const fixtures = join(import.meta.dirname, "..", "tests", "fixtures", "audio");
const files = readdirSync(fixtures).filter((f) => /\.(flac|mp3|m4a)$/.test(f)).map((f) => join(fixtures, f));

let exitCode = 1;
const browser = await chromium.launch();
try {
  for (let i = 0; i < 50; i++) {
    if (await fetch(url).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const headers = (await fetch(url)).headers;
  const page = await browser.newPage();
  const violations = [];
  const supabase = [];
  page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
  page.on("response", (r) => r.url().includes("supabase.co") && supabase.push(`${r.status()} ${new URL(r.url()).pathname}`));
  await page.goto(url);
  await page.locator('input[type="file"]').setInputFiles(files);
  await page.waitForTimeout(2000);
  const covers = await page.locator('img[src^="blob:"]').count();
  await page.locator(".track-row .row-main").first().click();
  await page.waitForTimeout(1500);
  // El motor crea su <audio> fuera del DOM: se comprueba por la interfaz (el tiempo avanza y el botón ofrece pausar).
  const playing = (await page.getByRole("button", { name: "Pausar" }).count()) > 0 && (await page.locator(".bar-progress").getAttribute("style")) !== "--progress: 0%;";

  const account = page.getByRole("button", { name: /Entrar|Cuenta/ }).first();
  if (await account.isVisible().catch(() => false)) {
    await account.click();
    const email = page.locator('input[type="email"]');
    if (await email.count()) {
      await email.fill("prueba-csp@example.com");
      await page.locator('input[type="password"]').fill("clave-falsa-123456");
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
    }
  }
  const result = {
    csp: Boolean(headers.get("content-security-policy")),
    hsts: Boolean(headers.get("strict-transport-security")),
    nosniff: headers.get("x-content-type-options"),
    portadasBlob: covers,
    audioSonando: playing,
    respuestasSupabase: supabase,
    violaciones: violations,
  };
  console.log(JSON.stringify(result, null, 2));
  exitCode = result.csp && covers > 0 && playing && violations.length === 0 ? 0 : 1;
} finally {
  await browser.close();
  // En Windows `shell: true` deja vite como proceso hijo del shell: se mata el árbol completo.
  if (process.platform === "win32") spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill();
}
process.exit(exitCode);
