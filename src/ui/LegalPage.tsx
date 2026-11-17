import { useEffect } from "react";
import { legal } from "virtual:docs";
import { Markdown } from "./Markdown";
import { navigate } from "./router";

export type LegalDoc = keyof typeof legal;
/** Rutas de las páginas legales. Aviso y términos se enlazan solo desde Ajustes → Acerca de; almacenamiento, por su dirección. */
export const LEGAL_PATHS: Record<string, LegalDoc> = { "/privacidad": "aviso", "/terminos": "terminos", "/almacenamiento": "almacenamiento" };

/**
 * Renderiza un borrador de docs/producto (LEGAL_BORRADORES.md §3.1 o §5, o la sección «Texto» de TERMINOS.md; el texto sale de `virtual:docs`, sin las notas internas y con los
 * datos personales sustituidos al compilar). Mientras sea borrador lo dice arriba y pide a los buscadores que no lo indexen.
 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  // La primera línea del borrador es el título en negrita; el resto (fecha de actualización incluida) es el cuerpo.
  const heading = /^\*\*([^*\n]+)\*\*[ \t]*\n?/.exec(legal[doc]);
  const title = heading?.[1] ?? null;
  const text = heading ? legal[doc].slice(heading[0].length) : legal[doc];
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.append(robots);
    const before = document.title;
    if (title) document.title = title;
    return () => {
      robots.remove();
      document.title = before;
    };
  }, [title]);
  return (
    <div className="legal">
      <main className="legal-text">
        <a
          className="link"
          href="/app"
          onClick={(event) => {
            event.preventDefault();
            // Desde Ajustes → Acerca de (SettingsView marca la entrada): atrás, que vuelve a esa sección. Por URL directa, a /app.
            if ((history.state as { fromApp?: boolean } | null)?.fromApp) history.back();
            else navigate("/app");
          }}
        >
          Volver a la app
        </a>
        {title && <h1>{title}</h1>}
        <p className="legal-draft">Borrador pendiente de revisión legal: puede cambiar antes de publicarse.</p>
        <Markdown text={text} />
      </main>
    </div>
  );
}
