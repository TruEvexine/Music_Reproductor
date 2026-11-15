import { Coffee } from "lucide-react";
import { cafeUrl } from "../core/support";
import { iconSmall } from "./parts";

// Se decide al compilar: sin VITE_CAFE_URL (o con una que no sea https) no hay botón en ninguna parte.
const url = cafeUrl(import.meta.env.VITE_CAFE_URL);
export const hasCafe = Boolean(url);

/** «Comprar un café»: un enlace que abre la página de pago en otra pestaña. Sin SDK ni diálogos, y no desbloquea nada. */
export function CafeButton({ className = "button" }: { className?: string }) {
  if (!url) return null;
  return (
    <a className={className} href={url} rel="noopener noreferrer" target="_blank">
      <Coffee {...iconSmall} />
      Comprar un café
    </a>
  );
}

/** Sección de Ajustes con el botón y su explicación; no existe si no hay enlace. */
export function CafeSection() {
  if (!url) return null;
  return (
    <section aria-labelledby="set-cafe" className="settings-section">
      <h2 id="set-cafe">Apoyar el proyecto</h2>
      <p className="subtitle">Si la app te acompaña y te apetece, puedes invitarme un café. Es voluntario y no desbloquea nada: todo sigue igual lo aportes o no.</p>
      <div className="dialog-actions cafe-actions">
        <CafeButton />
      </div>
      <p className="hint">Se abre en otra pestaña, en la página de pago de un tercero.</p>
    </section>
  );
}
