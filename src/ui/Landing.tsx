import type { MouseEvent } from "react";
import { navigate } from "./router";

// Landing provisional. La definitiva (prerenderizada, con SEO) es la Fase 7.
// TODO(marca): "Reproductor" es un nombre provisional.
export function Landing() {
  const open = (event: MouseEvent) => {
    event.preventDefault();
    navigate("/app");
  };
  return (
    <main className="landing">
      <h1>Tu música, como suena de verdad</h1>
      <p>
        Un reproductor para la música que ya tienes: FLAC, MP3 y más, directamente desde tu dispositivo. Sin subir nada,
        sin cuenta y sin conexión.
      </p>
      <a className="button primary" href="/app" onClick={open}>
        Abrir el reproductor
      </a>
    </main>
  );
}
