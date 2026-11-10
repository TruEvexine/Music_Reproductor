// Fronteras de plataforma. Una interfaz por frontera; hoy solo existe la implementación web
// (src/platform/web). La nativa (Capacitor) se escribe en src/platform/native cuando haya Android Studio.
// Se añaden aquí a medida que una fase las necesita: LocalLibrary (Fase 3), AudioSession (Fase 2).

/** Persistencia local clave-valor del estado del usuario (sesión, ajustes). Siempre funciona sin red. */
export interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Estado de la conexión, para mostrarlo y para reintentar la sincronización. */
export interface Connectivity {
  isOnline(): boolean;
  /** Devuelve la función para dejar de escuchar. */
  subscribe(listener: (online: boolean) => void): () => void;
}

/**
 * Almacén de tokens de sesión. En web es el almacenamiento del navegador;
 * en nativo debe ser Keystore (Android) / Keychain (iOS), nunca almacenamiento sin cifrar.
 * La forma coincide con la que acepta `auth.storage` de supabase-js.
 */
export interface SecureStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Integración con el sistema: pantalla de bloqueo, notificación de medios y botones de auriculares.
 * Web: Media Session API. Nativo: además debe mantener la reproducción viva en segundo plano
 * (Android: servicio en primer plano mediaPlayback; iOS: modo de fondo de audio).
 */
export interface AudioSession {
  setHandlers(handlers: {
    play(): void;
    pause(): void;
    next(): void;
    previous(): void;
    seekTo(position: number): void;
    seekBy(seconds: number): void;
  }): void;
  setTrack(track: { title: string; artist: string; album: string; artworkUrl?: string } | null): void;
  setState(state: { playing: boolean; position: number; duration: number; rate?: number }): void;
}

export type Target = "web" | "android" | "ios";
