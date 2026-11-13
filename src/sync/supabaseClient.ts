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
          detectSessionInUrl: true,
        },
      }),
    )
    .catch((error: unknown) => {
      client = undefined; // sin red la descarga falla: el siguiente intento vuelve a probar
      throw error;
    });
  return client;
}

// Vuelta de un enlace de correo con los tokens en la URL: el cliente se crea ya para recogerlos (detectSessionInUrl),
// también en la landing, donde nada más lo pediría.
if (supabaseConfigured && typeof location !== "undefined" && /[#?&](access_token|error_description|code)=/.test(location.hash + location.search)) {
  void getSupabase().catch(() => {});
}
