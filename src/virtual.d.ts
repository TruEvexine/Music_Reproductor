// Módulo virtual de vite.config.ts: FAQ y borradores legales leídos de docs/producto (marcadores ya sustituidos).
declare module "virtual:docs" {
  export const faq: { group: string; items: { question: string; answer: string[] }[] }[];
  export const legal: { aviso: string; terminos: string; almacenamiento: string };
}
