import { fetchUserPlaylists } from "./playlistService";
import { getSupabase, supabaseConfigured } from "./supabaseClient";

// Operaciones de cuenta de Ajustes → Privacidad y datos. Como el resto de src/sync, único sitio que habla con Supabase.

/**
 * Cierra la sesión antes de borrar los datos del dispositivo. Si no hay red y el servidor no responde, la cierra solo en este
 * dispositivo (`scope: "local"`): lo que importa es que no quede ninguna clave `sb-*` en el almacenamiento.
 */
export async function signOutForWipe(): Promise<void> {
  if (!supabaseConfigured) return;
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signOut().catch((failure: unknown) => ({ error: failure }));
    if (error) await supabase.auth.signOut({ scope: "local" });
  } finally {
    // Último recurso (sin red ni SDK): la sesión vive en localStorage como `sb-<proyecto>-auth-token`.
    for (const key of Object.keys(localStorage)) if (/^sb-.+-auth-token(-code-verifier)?$/.test(key)) localStorage.removeItem(key);
  }
}

/** Lo que la cuenta tiene en la nube: el perfil y todas sus playlists, con las mismas consultas de la sincronización. */
export async function fetchAccountData(userId: string) {
  const { data, error } = await (await getSupabase()).from("profiles").select("display_name, created_at").eq("id", userId).maybeSingle();
  if (error) throw error;
  return {
    profile: { displayName: (data?.display_name as string | null | undefined) ?? null, createdAt: (data?.created_at as string | null | undefined) ?? null },
    playlists: await fetchUserPlaylists(userId),
  };
}
