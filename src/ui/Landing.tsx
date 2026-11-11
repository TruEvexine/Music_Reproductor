import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import libraryDesktop from "../assets/landing/biblioteca-escritorio.jpg";
import libraryPhone from "../assets/landing/biblioteca-movil.jpg";
import equalizerPhone from "../assets/landing/ecualizador-movil.jpg";
import playerDesktop from "../assets/landing/reproductor-escritorio.jpg";
import playerPhone from "../assets/landing/reproductor-movil.jpg";
import { navigate } from "./router";

// Landing de transición: legible en móvil y escritorio, con capturas reales de la app (scripts/gen-landing.mjs).
// La definitiva (prerenderizada, con SEO) es la Fase 7.
// TODO(marca): "Reproductor" es un nombre provisional.
export function Landing() {
  const open = (event: MouseEvent) => {
    event.preventDefault();
    navigate("/app");
  };
  const rise = (index: number) => ({ "--i": index }) as CSSProperties;
  // Las secciones de más abajo aparecen al llegar a la vista, una sola vez. Sin script (o sin la clase "js") ya están visibles.
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const seen = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-in", "");
          seen.unobserve(entry.target);
        }),
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    root.current?.querySelectorAll("[data-reveal]").forEach((node) => seen.observe(node));
    return () => seen.disconnect();
  }, []);
  return (
    <div className={ready ? "landing js" : "landing"} ref={root}>
      <header className="landing-bar">
        <span className="brand">Reproductor</span>
        <a className="button" href="/app" onClick={open}>
          Abrir
        </a>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <h1 data-rise style={rise(0)}>
              Tu música, como suena de verdad
            </h1>
            <p data-rise style={rise(1)}>
              Un reproductor para la música que ya tienes: FLAC, MP3 y más, directo desde tu dispositivo. Tu música no se sube a ningún servidor
              y para escuchar no hace falta cuenta.
            </p>
            <a className="button primary" data-rise href="/app" onClick={open} style={rise(2)}>
              Abrir el reproductor
            </a>
          </div>
          <picture data-rise style={rise(3)}>
            <source media="(min-width: 900px)" srcSet={libraryDesktop} />
            <img alt="La biblioteca del reproductor con una canción sonando" className="landing-shot" height={1688} src={libraryPhone} width={780} />
          </picture>
        </section>

        <section className="landing-thumb">
          <div className="landing-copy">
            <h2 data-reveal>Pensado para el pulgar</h2>
            <p data-reveal style={rise(1)}>
              Desliza una canción para reproducirla a continuación o añadirla a la cola. Mantén pulsada para ver más acciones, y baja el
              reproductor con un gesto para cerrarlo. Todo tiene también su botón.
            </p>
          </div>
          <div className="landing-phones">
            <img alt="El reproductor en pantalla completa en un móvil" data-reveal height={1688} src={playerPhone} style={rise(2)} width={780} />
            <img alt="El ecualizador de diez bandas en un móvil" data-reveal height={1688} src={equalizerPhone} style={rise(3)} width={780} />
          </div>
        </section>

        <section className="landing-quality">
          <img alt="El reproductor grande con la portada, el progreso y los controles" data-reveal height={900} src={playerDesktop} width={1440} />
          <div className="landing-copy">
            <h2 data-reveal style={rise(1)}>Calidad que se nota</h2>
            <p data-reveal style={rise(2)}>
              Reproduce FLAC, WAV, MP3, M4A, OGG y Opus. Ecualizador de diez bandas, fundido entre canciones, ReplayGain y un fondo que
              sigue el ritmo de lo que suena.
            </p>
          </div>
        </section>

        <section className="landing-close">
          <h2 data-reveal>Abre tu carpeta y empieza a escuchar</h2>
          <a className="button primary" data-reveal href="/app" onClick={open} style={rise(1)}>
            Abrir el reproductor
          </a>
          <p data-reveal style={rise(2)}>Una cuenta solo sirve para sincronizar tus playlists entre dispositivos. La música se queda donde está.</p>
        </section>
      </main>
    </div>
  );
}
