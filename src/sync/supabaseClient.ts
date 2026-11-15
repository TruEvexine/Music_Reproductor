import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const supabaseConfigured = Boolean(supabaseUrl && publishableKey);

let client: Promise<SupabaseClient> | undefined;

/** El SDK es casi la mitad del JavaScript: se descarga la primera vez que hace falta (sesión, login o sincronización). */
export function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseConfigured) return Promise.reject(new Error("Configura Supabase antes de usar la cuenta o las playlists sincronizadas."));
  client ??= import("@supabase/supabase-js")
    .then(({ createClient }) =>
      createClient(supabaseUrl, publishableKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          // PKCE (S-01): un enlace solo inicia sesión en el navegador que lo pidió, porque el verificador vive en su localStorage.
          // El ?code lo procesa consumeEmailLink (una vez, y nunca encima de una sesión abierta), no el SDK.
          flowType: "pkce",
          detectSessionInUrl: false,
        },
      }),
    )
    .catch((error: unknown) => {
      client = undefined; // sin red la descarga falla: el siguiente intento vuelve a probar
      throw error;
    });
  return client;
}

/** Por qué no sirvió el enlace del correo: abierto en otro navegador (o ya usado), o caducado según Supabase. */
export type EmailLinkProblem = "other-browser" | "expired";

/** Dirección a la que vuelven los enlaces de correo (debe estar en las Redirect URLs del proyecto; si no, Supabase usa la Site URL). */
export const emailRedirectTo = () => `${location.origin}/app`;

/**
 * Vuelta de un enlace de correo. Limpia la URL antes de nada (así un ?code se intenta una sola vez, aunque se recargue) y:
 * - `#access_token…` (flujo implícito) se descarta sin leerlo ni registrarlo: ya no inicia sesión.
 * - `?code` se canjea solo si no hay sesión abierta: un enlace ajeno nunca sustituye a la cuenta que ya está.
 */
async function consumeEmailLink(): Promise<EmailLinkProblem | null> {
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get("code");
  const tokensInHash = hash.has("access_token") || hash.has("refresh_token");
  const failed = url.searchParams.has("error_description") || hash.has("error_description");
  if (!code && !tokensInHash && !failed) return null;
  for (const name of ["code", "error", "error_code", "error_description"]) url.searchParams.delete(name);
  if (tokensInHash || hash.has("error_description")) url.hash = "";
  history.replaceState(history.state, "", url);
  if (failed) return "expired";
  if (!code) return null;
  const { auth } = await getSupabase();
  if ((await auth.getSession()).data.session) return null;
  const { error } = await auth.exchangeCodeForSession(code);
  // shortcut: sin red no se avisa (el aviso de «otro navegador» sería falso); si molesta, un tercer mensaje de «sin conexión».
  return error && error.name !== "AuthRetryableFetchError" ? "other-browser" : null;
}

/** Resultado de la vuelta del enlace, calculado una vez al cargar (también en la landing, donde nada más crearía el cliente). */
export const emailLink: Promise<EmailLinkProblem | null> =
  supabaseConfigured && typeof location !== "undefined" ? consumeEmailLink().catch(() => null) : Promise.resolve(null);
