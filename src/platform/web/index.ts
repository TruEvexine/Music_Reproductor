import type { Connectivity, Storage } from "../types";
import { openDatabase } from "./db";

// Una sola conexión, abierta la primera vez que se usa. Si IndexedDB no está disponible
// (modo privado de algunos navegadores) la app sigue funcionando sin persistencia.
let database: ReturnType<typeof openDatabase> | undefined;
const db = () => (database ??= openDatabase());

export const storage: Storage = {
  async get<T>(key: string) {
    try {
      return (await (await db()).get("kv", key)) as T | undefined;
    } catch {
      return undefined;
    }
  },
  async set(key, value) {
    try {
      await (await db()).put("kv", value, key);
    } catch {
      // Sin almacenamiento: el estado vive solo en memoria durante esta sesión.
    }
  },
  async delete(key) {
    try {
      await (await db()).delete("kv", key);
    } catch {
      // Igual que arriba.
    }
  },
};

export const connectivity: Connectivity = {
  isOnline: () => navigator.onLine,
  subscribe(listener) {
    const on = () => listener(true);
    const off = () => listener(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  },
};
