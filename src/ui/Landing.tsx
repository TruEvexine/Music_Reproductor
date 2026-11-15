import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ImgHTMLAttributes, MouseEvent } from "react";
import libraryDesktop from "../assets/landing/biblioteca-escritorio.jpg";
import libraryPhone from "../assets/landing/biblioteca-movil.jpg";
import equalizerPhone from "../assets/landing/ecualizador-movil.jpg";
import playerDesktop from "../assets/landing/reproductor-escritorio.jpg";
import playerPhone from "../assets/landing/reproductor-movil.jpg";
import { APP_NAME } from "../core/brand";
import { cssMs } from "../core/format";
import { emailLink, getSupabase, supabaseConfigured } from "../sync/supabaseClient";
import { CafeButton } from "./CafeLink";
import { motionReduced } from "./motion";
import { navigate } from "./router";

// Versiones AVIF a los anchos reales (scripts/avif-landing.mjs); el JPG de arriba es el respaldo de los navegadores sin AVIF.
const avif = import.meta.glob<string>("../assets/landing/*.avif", { eager: true, query: "?url", import: "default" });
const avifSet = (name: string, widths: number[]) => widths.map((width) => `${avif[`../assets/landing/${name}-${width}.avif`]} ${width}w`).join(", ");
const phones = "(min-width: 900px) 21vw, min(calc((100vw - 3.5rem) / 2), 307px)"; // dos móviles a la par
const column = "min(calc(100vw - 2.5rem), 630px)"; // ancho de una imagen a una columna (hasta 630 px)

function Shot({ name, widths, sizes, jpg, ...img }: { name: string; widths: number[]; sizes: string; jpg: string } & ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <picture>
      <source sizes={sizes} srcSet={avifSet(name, widths)} type="image/avif" />
      <img decoding="async" loading="lazy" src={jpg} {...img} />
    </picture>
  );
}

const BRAND_MS = 600; // paso de marca al abrir la app

// El símbolo de la carga vive en index.html (dentro de #root; React lo sustituye al montar). Este módulo se evalúa antes del montaje:
// se guarda una copia para el paso de marca y así el SVG existe en un solo sitio.
const brandMark = document.querySelector(".satin-carga")?.cloneNode(true) as HTMLElement | undefined;

/**
 * Paso de la landing a la app: el símbolo entra (--fast) sobre el fondo, la app monta debajo y el SDK de cuentas se descarga mientras
 * tanto; a los BRAND_MS sale (--exit). Con movimiento reducido, solo un fundido corto: entra, cambia y sale, sin brillo ni espera.
 */
function openApp() {
  if (supabaseConfigured) void getSupabase().catch(() => {}); // la app lo pide al montar; así empieza ya
  if (!brandMark || document.querySelector(".satin-paso")) return navigate("/app");
  const token = (name: string) => cssMs(getComputedStyle(document.documentElement).getPropertyValue(name));
  const overlay = brandMark.cloneNode(true) as HTMLElement;
  overlay.classList.add("satin-paso");
  document.body.append(overlay);
  const total = motionReduced() ? token("--fast") + token("--exit") : BRAND_MS;
  setTimeout(() => navigate("/app"), token("--fast")); // cuando ya tapa la landing
  setTimeout(() => overlay.setAttribute("data-closing", ""), total - token("--exit"));
  setTimeout(() => overlay.remove(), total);
}

// Landing de transición: legible en móvil y escritorio, con capturas reales de la app (scripts/gen-landing.mjs) hechas con música
// CC0 o de dominio público (scripts/descargar-musica-landing.mjs; créditos por archivo en CREDITOS.md y resumidos en el pie de esta página).
// Cada frase del texto se puede comprobar en el código (docs/COPY_LANDING.md). La definitiva (prerenderizada, con SEO) es la Fase 7.
export function Landing() {
  const open = (event: MouseEvent) => {
    event.preventDefault();
    openApp();
  };
  const rise = (index: number) => ({ "--i": index }) as CSSProperties;
  // Las secciones de más abajo aparecen al llegar a la vista, una sola vez. Sin script (o sin la clase "js") ya están visibles.
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => void emailLink.then((problem) => problem && navigate("/app")), []); // el aviso del enlace fallido vive en la app
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
        <span className="brand">{APP_NAME}</span>
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
              Elige una carpeta y {APP_NAME} lee las etiquetas, las portadas y la calidad de cada archivo sin salir del navegador. Acepta
              FLAC, WAV, MP3, M4A, OGG y Opus; no pide cuenta y no envía tu música a ningún servidor.
            </p>
            <a className="button primary" data-rise href="/app" onClick={open} style={rise(2)}>
              Abrir el reproductor
            </a>
          </div>
          <picture data-rise style={rise(3)}>
            <source media="(min-width: 900px)" sizes="55vw" srcSet={avifSet("biblioteca-escritorio", [780, 1440])} type="image/avif" />
            <source media="(min-width: 900px)" srcSet={libraryDesktop} />
            <source sizes={column} srcSet={avifSet("biblioteca-movil", [390, 780])} type="image/avif" />
            {/* El LCP es el texto: la captura de la primera pantalla no debe quitarle ancho de banda al JS ni a la fuente. */}
            <img alt="La vista de álbumes con cinco portadas de álbumes y un nocturno de Chopin sonando en la barra" className="landing-shot" fetchPriority="low" height={1688} src={libraryPhone} width={780} />
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
            <Shot alt="El reproductor en pantalla completa en un móvil, con la portada de un nocturno de Chopin" data-reveal height={1688} jpg={playerPhone} name="reproductor-movil" sizes={phones} style={rise(2)} widths={[390, 780]} width={780} />
            <Shot alt="La página del ecualizador en un móvil, con el ajuste Graves aplicado a las diez bandas" data-reveal height={1688} jpg={equalizerPhone} name="ecualizador-movil" sizes={phones} style={rise(3)} widths={[390, 780]} width={780} />
          </div>
        </section>

        <section className="landing-quality">
          <Shot alt="El reproductor grande en escritorio, con la portada, el formato del archivo, el progreso y los controles" data-reveal height={900} jpg={playerDesktop} name="reproductor-escritorio" sizes={`(min-width: 900px) 52vw, ${column}`} widths={[390, 780, 1440]} width={1440} />
          <div className="landing-copy">
            <h2 data-reveal style={rise(1)}>Formato y calidad de cada pista</h2>
            <p data-reveal style={rise(2)}>
              En los archivos sin pérdida, cada pista muestra su formato, su profundidad de bits y su frecuencia (FLAC 24/96); en los demás, el
              formato y la tasa de bits (MP3 320). Las de alta resolución llevan la etiqueta Hi-Res. El fondo toma los colores de la portada, sigue
              el ritmo de la música o se queda en negro puro para pantallas OLED.
            </p>
          </div>
        </section>

        <section className="landing-free">
          <h2 data-reveal>Qué es gratis hoy</h2>
          <div className="landing-copy">
            <p data-reveal style={rise(1)}>
              Todo lo que corre en tu dispositivo: reproducir, la biblioteca, el ecualizador, los fondos, las playlists y la copia de seguridad en un archivo. No hace
              falta cuenta y no hay anuncios.
            </p>
            <p data-reveal style={rise(2)}>Si más adelante hay extras que cuesten servidor, serán opcionales.</p>
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
        <CafeButton />
      </footer>
    </div>
  );
}
