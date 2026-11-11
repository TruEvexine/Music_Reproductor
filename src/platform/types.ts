// Fronteras de plataforma. Una interfaz por frontera; hoy solo existe la implementación web
// (src/platform/web). La nativa (Capacitor) se escribe en src/platform/native cuando haya Android Studio.
// Se añaden aquí a medida que una fase las necesita: LocalLibrary (Fase 3), AudioSession (Fase 2).

/** Tablas locales: biblioteca, portadas, playlists y operaciones pendientes con la nube. */
export type Table = "tracks" | "roots" | "covers" | "playlists" | "outbox";

/** Persistencia local del estado del usuario (sesión, ajustes, biblioteca). Siempre funciona sin red. */
export interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list<T>(table: Table): Promise<T[]>;
  read<T>(table: Table, key: IDBValidKey): Promise<T | undefined>;
  /** Escribe y borra en una sola transacción. */
  write(table: Table, put: unknown[], remove?: IDBValidKey[]): Promise<void>;
  /** Añade con clave autoincremental (outbox) y la devuelve. */
  append(table: Table, value: unknown): Promise<number | undefined>;
}

/**
 * Raíz de la biblioteca. "folder": carpeta del disco recordada con su handle (File System Access).
 * "copy": copia privada de la app (OPFS). "session": archivos en memoria, se pierden al recargar.
 */
export interface LibraryRoot {
  id: string;
  name: string;
  kind: "folder" | "copy" | "session";
  handle?: FileSystemDirectoryHandle;
  addedAt: number;
  scannedAt?: number;
}

export interface LibraryFile {
  /** Ruta relativa con la carpeta raíz delante: "Música/Álbum/01.flac". */
  path: string;
  file: File;
}

export type FolderAccess = "granted" | "prompt" | "denied" | "missing";

/** Acceso a la música del dispositivo. Web: File System Access, webkitdirectory, arrastrar y OPFS. */
export interface LocalLibrary {
  /** La carpeta se puede recordar entre sesiones (se guarda su handle). */
  readonly keepsFolders: boolean;
  pickFolder(): Promise<LibraryRoot | null>;
  /** Hay que llamarlo dentro del evento drop (los elementos caducan al terminar el evento). */
  dropped(data: DataTransfer): Promise<{ folders: LibraryRoot[]; files: LibraryFile[] }>;
  /** Estado del permiso; con `ask` lo pide (necesita un gesto del usuario). */
  access(root: LibraryRoot, ask?: boolean): Promise<FolderAccess>;
  /** Recorre la raíz entregando lotes; para con `signal`. */
  walk(root: LibraryRoot, onBatch: (files: LibraryFile[]) => void, signal?: AbortSignal): Promise<void>;
  readFile(root: LibraryRoot, path: string): Promise<File>;
  /** Copia a almacenamiento privado. "space": no cabe (no se copia nada); "unsupported": sin OPFS. */
  copyIn(root: LibraryRoot, files: LibraryFile[], signal?: AbortSignal): Promise<"ok" | "space" | "unsupported">;
  forget(root: LibraryRoot): Promise<void>;
  space(): Promise<{ usage: number; quota: number } | undefined>;
  canPlay(fileName: string): boolean;
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
