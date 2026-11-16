// Botón de apoyo «Comprar un café»: solo existe si el build trae `VITE_CAFE_URL`. Puro y sin DOM; ui/CafeLink.tsx lo pinta.

/**
 * El enlace del café si es seguro de abrir, o null (entonces no hay botón). Solo `https:`: una variable de entorno mal puesta (`javascript:`,
 * `http:`, texto suelto) no puede acabar como destino de un enlace. Se devuelve la URL ya normalizada.
 */
export function cafeUrl(raw: string | undefined): string | null {
  const text = raw?.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}
