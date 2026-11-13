import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import libraryDesktop from "../assets/landing/biblioteca-escritorio.jpg";
import libraryPhone from "../assets/landing/biblioteca-movil.jpg";
import equalizerPhone from "../assets/landing/ecualizador-movil.jpg";
import playerDesktop from "../assets/landing/reproductor-escritorio.jpg";
import playerPhone from "../assets/landing/reproductor-movil.jpg";
import { navigate } from "./router";

// Landing de transición: legible en móvil y escritorio, con capturas reales de la app (scripts/gen-landing.mjs) hechas con música
// CC0 o de dominio público (scripts/descargar-musica-landing.mjs; créditos por archivo en CREDITOS.md y resumidos en el pie de esta página).
// Cada frase del texto se puede comprobar en el código (docs/COPY_LANDING.md). La definitiva (prerenderizada, con SEO) es la Fase 7.
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
              Tus FLAC y MP3, sin subirlos
            </h1>
            <p data-rise style={rise(1)}>
              Elige una carpeta y el reproductor lee las etiquetas, las portadas y la calidad de cada archivo sin salir del navegador. Acepta
              FLAC, WAV, MP3, M4A, OGG y Opus; no pide cuenta y no envía tu música a ningún servidor.
            </p>
            <a className="button primary" data-rise href="/app" onClick={open} style={rise(2)}>
              Abrir el reproductor
            </a>
          </div>
          <picture data-rise style={rise(3)}>
            <source media="(min-width: 900px)" srcSet={libraryDesktop} />
            <img alt="La vista de álbumes con cinco portadas de álbumes y un nocturno de Chopin sonando en la barra" className="landing-shot" height={1688} src={libraryPhone} width={780} />
          </picture>
        </section>

        <section className="landing-thumb">
          <div className="landing-copy">
            <h2 data-reveal>Cola con gestos y ecualizador</h2>
            <p data-reveal style={rise(1)}>
              Desliza una canción a la derecha para tocarla a continuación o a la izquierda para añadirla a la cola; el aviso permite deshacerlo.
              Una pulsación larga abre sus acciones. El ecualizador tiene diez bandas de ±12 dB, siete ajustes de partida y ReplayGain por pista o
              por álbum.
            </p>
          </div>
          <div className="landing-phones">
            <img alt="El reproductor en pantalla completa en un móvil, con la portada de un nocturno de Chopin" data-reveal decoding="async" height={1688} loading="lazy" src={playerPhone} style={rise(2)} width={780} />
            <img alt="La página del ecualizador en un móvil, con el ajuste Graves aplicado a las diez bandas" data-reveal decoding="async" height={1688} loading="lazy" src={equalizerPhone} style={rise(3)} width={780} />
          </div>
        </section>

        <section className="landing-quality">
          <img alt="El reproductor grande en escritorio, con la portada, el formato del archivo, el progreso y los controles" data-reveal decoding="async" height={900} loading="lazy" src={playerDesktop} width={1440} />
          <div className="landing-copy">
            <h2 data-reveal style={rise(1)}>Formato y calidad de cada pista</h2>
            <p data-reveal style={rise(2)}>
              En los archivos sin pérdida, cada pista muestra su formato, su profundidad de bits y su frecuencia (FLAC 24/96); en los demás, el
              formato y la tasa de bits (MP3 320). Las de alta resolución llevan la etiqueta Hi-Res. El fondo toma los colores de la portada, sigue
              el ritmo de la música o se queda en negro puro para pantallas OLED.
            </p>
          </div>
        </section>

        <section className="landing-close">
          <h2 data-reveal>Elige una carpeta y dale a play</h2>
          <a className="button primary" data-reveal href="/app" onClick={open} style={rise(1)}>
            Abrir el reproductor
          </a>
          <p data-reveal style={rise(2)}>La cuenta es opcional y solo sincroniza tus playlists entre dispositivos. Los archivos se quedan en el dispositivo donde están.</p>
        </section>
      </main>
      <footer className="landing-credits">
        <p>
          Música y portadas de las capturas, en CC0 o dominio público (Wikimedia Commons): Kimiko Ishizaka, Luke Faulkner, Olga Gurevich, Diana
          Hughes y Scott Joplin; retratos de Bach, Chopin y Delacroix y la partitura de Maple Leaf Rag.
        </p>
      </footer>
    </div>
  );
}
