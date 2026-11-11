import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from "react";
import { ArrowLeft, Check, ChevronRight, Menu, Moon, Palette, SlidersHorizontal, X } from "lucide-react";
import { EQ_BANDS, EQ_LIMIT_DB, EQ_PRESETS, MAX_CROSSFADE, presetNameOf, SPEED_RANGE } from "../core/audio";
import type { ReplayGainMode } from "../core/audio";
import { isAnimated, SPEED_LIMITS } from "../core/background";
import type { BackgroundMode, PaletteSource } from "../core/background";
import type { RepeatMode } from "../core/queue";
import { background, useBackground } from "../state/background";
import { player, usePlayer } from "../state/player";
import { Backdrop, useReducedMotion } from "./Backdrop";
import { useDragDismiss } from "./gestures";
import { icon, IconButton, iconSmall } from "./parts";

// Menú del reproductor (≡). Móvil: hoja inferior con arrastre. Escritorio: popover anclado al icono.
// Los submenús se navegan en profundidad dentro del mismo panel (flecha de volver), nunca con menús anidados.
// Es un <dialog> modal: el foco queda atrapado y Escape cierra. No guarda estado propio de audio: lee y escribe el store.

type PageId = "root" | "sound" | "eq" | "timer" | "background";

const titles: Record<PageId, string> = { root: "Menú", sound: "Sonido", eq: "Ecualizador", timer: "Temporizador", background: "Fondo" };

// --- Controles reutilizados por las páginas ---

/** Relleno del deslizador: desde `origin` hasta el valor (variables CSS --from y --to, en %). */
function fill(value: number, min: number, max: number, origin: number): CSSProperties {
  const at = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return { "--from": at(Math.min(value, origin)), "--to": at(Math.max(value, origin)) } as CSSProperties;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  origin = min,
  disabled = false,
  className = "",
}: {
  className?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  /** Valor desde el que se pinta el relleno (el centro en los controles con signo). */
  origin?: number;
  disabled?: boolean;
}) {
  return (
    <label className={`menu-slider ${className}`}>
      <span className="menu-slider-head">
        <span>{label}</span>
        <span className="time">{format(value)}</span>
      </span>
      <input
        aria-valuetext={format(value)}
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        step={step}
        style={fill(value, min, max, origin)}
        type="range"
        value={value}
      />
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="menu-field">
      <span className="menu-field-label">{label}</span>
      <div aria-label={label} className="segmented" role="radiogroup">
        {options.map((option) => (
          <button
            aria-checked={value === option.value}
            className="segment"
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            type="button"
          >
            {value === option.value && <Check {...iconSmall} />}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button aria-checked={checked} className="menu-row" disabled={disabled} onClick={() => onChange(!checked)} role="switch" type="button">
      <span className="menu-label">{label}</span>
      <span aria-hidden="true" className="switch-track">
        <span className="switch-thumb" />
      </span>
    </button>
  );
}

function NavRow({ id, label, value, children, go }: { id: PageId; label: string; value: string; children: ReactNode; go: (page: PageId) => void }) {
  return (
    <button className="menu-row" data-key={id} onClick={() => go(id)} type="button">
      <span aria-hidden="true" className="menu-icon">
        {children}
      </span>
      <span className="menu-label">{label}</span>
      <span className="menu-value">{value}</span>
      <ChevronRight {...iconSmall} />
    </button>
  );
}

// --- Páginas ---

const repeatOptions: { value: RepeatMode; label: string }[] = [
  { value: "off", label: "Apagado" },
  { value: "queue", label: "Cola" },
  { value: "track", label: "Canción" },
];

function sleepSummary(sleep: ReturnType<typeof usePlayer.getState>["sleep"]): string {
  if (sleep === null) return "Apagado";
  return "endOfTrack" in sleep ? "Al terminar la canción" : `A las ${clock(sleep.endsAt)}`;
}

const clock = (time: number) => new Date(time).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

function RootPage({ go }: { go: (page: PageId) => void }) {
  const repeat = usePlayer((state) => state.queue.repeat);
  const shuffle = usePlayer((state) => state.queue.shuffle);
  const audio = usePlayer((state) => state.audio);
  const sleep = usePlayer((state) => state.sleep);
  const backgroundMode = useBackground((state) => state.mode);
  return (
    <>
      <section aria-labelledby="menu-play" className="menu-group">
        <h3 className="visually-hidden" id="menu-play">
          Reproducción
        </h3>
        <Segmented
          label="Repetir"
          onChange={(mode) => {
            // El store solo sabe avanzar off → cola → canción: se avanza hasta llegar al modo pedido.
            for (let i = 0; i < 3 && usePlayer.getState().queue.repeat !== mode; i++) player.cycleRepeat();
          }}
          options={repeatOptions}
          value={repeat}
        />
        <SwitchRow checked={shuffle} label="Aleatorio" onChange={() => player.toggleShuffle()} />
      </section>
      <section aria-labelledby="menu-more" className="menu-group">
        <h3 className="visually-hidden" id="menu-more">
          Ajustes
        </h3>
        <NavRow go={go} id="sound" label="Sonido" value={audio.eqEnabled ? (presetNameOf(audio.eqGains) ?? "Ecualizador a medida") : "Ecualizador apagado"}>
          <SlidersHorizontal {...icon} />
        </NavRow>
        <NavRow go={go} id="timer" label="Temporizador" value={sleepSummary(sleep)}>
          <Moon {...icon} />
        </NavRow>
        <NavRow go={go} id="background" label="Fondo" value={modes.find((mode) => mode.value === backgroundMode)?.label ?? ""}>
          <Palette {...icon} />
        </NavRow>
      </section>
    </>
  );
}

const replayOptions: { value: ReplayGainMode; label: string }[] = [
  { value: "off", label: "Apagado" },
  { value: "track", label: "Canción" },
  { value: "album", label: "Álbum" },
];

const hz = (frequency: number) => (frequency >= 1000 ? `${frequency / 1000} kHz` : `${frequency} Hz`);
const db = (value: number) => `${value > 0 ? "+" : ""}${value} dB`;

function SoundPage({ go }: { go: (page: PageId) => void }) {
  const audio = usePlayer((state) => state.audio);
  return (
    <>
      <section className="menu-group">
        <NavRow go={go} id="eq" label="Ecualizador" value={audio.eqEnabled ? (presetNameOf(audio.eqGains) ?? "A medida") : "Apagado"}>
          <SlidersHorizontal {...icon} />
        </NavRow>
      </section>
      <section className="menu-group">
        <Segmented label="Nivelar volumen (ReplayGain)" onChange={(replayGain) => player.setAudio({ replayGain })} options={replayOptions} value={audio.replayGain} />
        <p className="hint">Solo actúa en canciones que traen esa información en sus etiquetas.</p>
      </section>
      <section className="menu-group">
        <Slider
          format={(value) => (value === 0 ? "Desactivado" : `${value} s`)}
          label="Fundido entre canciones"
          max={MAX_CROSSFADE}
          min={0}
          onChange={(crossfade) => player.setAudio({ crossfade })}
          step={1}
          value={audio.crossfade}
        />
        <SwitchRow checked={audio.fadePause} label="Fundido al pausar y reanudar" onChange={(fadePause) => player.setAudio({ fadePause })} />
      </section>
      <section className="menu-group">
        <Slider
          format={(value) => `${value.toFixed(2).replace(/0$/, "")}×`}
          label="Velocidad"
          max={SPEED_RANGE.max}
          min={SPEED_RANGE.min}
          onChange={(speed) => player.setAudio({ speed })}
          origin={1}
          step={0.05}
          value={audio.speed}
        />
        {audio.speed !== 1 && (
          <button className="link menu-reset" onClick={() => player.setAudio({ speed: 1 })} type="button">
            Velocidad normal
          </button>
        )}
      </section>
    </>
  );
}

function EqPage() {
  const audio = usePlayer((state) => state.audio);
  const preset = presetNameOf(audio.eqGains);
  const off = !audio.eqEnabled;
  return (
    <>
      <section className="menu-group">
        <SwitchRow checked={audio.eqEnabled} label="Ecualizador activado" onChange={(eqEnabled) => player.setAudio({ eqEnabled })} />
      </section>
      <section aria-labelledby="menu-presets" className="menu-group">
        <h3 id="menu-presets">Preajuste</h3>
        <div aria-labelledby="menu-presets" className="chips" role="radiogroup">
          {Object.keys(EQ_PRESETS).map((name) => (
            <button
              aria-checked={preset === name}
              className="chip"
              key={name}
              onClick={() => player.setAudio({ eqGains: [...EQ_PRESETS[name]], eqEnabled: true })}
              role="radio"
              type="button"
            >
              {preset === name && <Check {...iconSmall} />}
              {name}
            </button>
          ))}
        </div>
        {preset === undefined && <p className="hint">Ajuste a medida.</p>}
      </section>
      <section aria-label="Bandas del ecualizador" className="menu-group eq" role="group">
        {EQ_BANDS.map((frequency, index) => (
          <label className="eq-band" key={frequency}>
            <input
              aria-label={hz(frequency)}
              aria-orientation="vertical"
              aria-valuetext={db(audio.eqGains[index])}
              data-vertical="true"
              disabled={off}
              max={EQ_LIMIT_DB}
              min={-EQ_LIMIT_DB}
              onChange={(event) => {
                const eqGains = [...audio.eqGains];
                eqGains[index] = Number(event.currentTarget.value);
                player.setAudio({ eqGains });
              }}
              step={1}
              style={fill(audio.eqGains[index], -EQ_LIMIT_DB, EQ_LIMIT_DB, 0)}
              type="range"
              value={audio.eqGains[index]}
            />
            <span className="time">{hz(frequency)}</span>
            <span className="time">{audio.eqGains[index] > 0 ? "+" : ""}{audio.eqGains[index]}</span>
          </label>
        ))}
      </section>
      <section className="menu-group">
        <Slider disabled={off} format={db} label="Preamplificación" max={EQ_LIMIT_DB} min={-EQ_LIMIT_DB} onChange={(preamp) => player.setAudio({ preamp })} origin={0} step={1} value={audio.preamp} />
        <Slider disabled={off} format={db} label="Graves" max={EQ_LIMIT_DB} min={-EQ_LIMIT_DB} onChange={(bass) => player.setAudio({ bass })} origin={0} step={1} value={audio.bass} />
        <Slider disabled={off} format={db} label="Agudos" max={EQ_LIMIT_DB} min={-EQ_LIMIT_DB} onChange={(treble) => player.setAudio({ treble })} origin={0} step={1} value={audio.treble} />
        <Slider
          format={(value) => (value === 0 ? "Centro" : `${value < 0 ? "Izquierda" : "Derecha"} ${Math.round(Math.abs(value) * 100)} %`)}
          label="Balance"
          max={1}
          min={-1}
          onChange={(balance) => player.setAudio({ balance })}
          origin={0}
          step={0.05}
          value={audio.balance}
        />
      </section>
      <button
        className="button menu-reset"
        onClick={() => player.setAudio({ eqGains: [...EQ_PRESETS.Plano], preamp: 0, bass: 0, treble: 0, balance: 0 })}
        type="button"
      >
        Restablecer
      </button>
    </>
  );
}

const modes: { value: BackgroundMode; label: string; hint: string }[] = [
  { value: "cover", label: "Portada", hint: "Degradado animado con los colores de la portada." },
  { value: "rhythm", label: "Ritmo", hint: "Los graves hinchan las manchas, los golpes las hacen latir y los agudos aceleran el giro." },
  { value: "static", label: "Estático", hint: "Degradado fijo de dos colores de la portada." },
  { value: "amoled", label: "AMOLED", hint: "Negro puro en toda la app: ahorra batería en pantallas OLED." },
];

const sources: { value: PaletteSource; label: string }[] = [
  { value: "cover", label: "Portada" },
  { value: "accent", label: "Acento" },
  { value: "custom", label: "Elegida" },
];

const fpsOptions: { value: "30" | "60" | "auto"; label: string }[] = [
  { value: "30", label: "30" },
  { value: "60", label: "60" },
  { value: "auto", label: "Auto" },
];

const percent = (value: number) => `${Math.round(value * 100)} %`;

function BackgroundPage() {
  const settings = useBackground();
  const reduced = useReducedMotion();
  const mode = modes.find((option) => option.value === settings.mode)!;
  const moves = isAnimated(settings.mode);
  const colorful = settings.mode !== "amoled";
  return (
    <>
      <div aria-hidden="true" className="backdrop-preview">
        <Backdrop />
      </div>
      <section aria-labelledby="menu-mode" className="menu-group">
        <h3 id="menu-mode">Modo</h3>
        <div aria-labelledby="menu-mode" className="chips cols-2" role="radiogroup">
          {modes.map((option) => (
            <button
              aria-checked={settings.mode === option.value}
              className="chip"
              key={option.value}
              onClick={() => background.set({ mode: option.value })}
              role="radio"
              type="button"
            >
              {settings.mode === option.value && <Check {...iconSmall} />}
              {option.label}
            </button>
          ))}
        </div>
        <p className="hint" role="status">
          {mode.hint}
          {reduced && moves && " Tu sistema pide menos movimiento: el fondo se muestra sin animar."}
        </p>
      </section>
      {colorful && (
        <section className="menu-group">
          <Slider format={percent} label="Intensidad" max={1} min={0} onChange={(intensity) => background.set({ intensity })} step={0.05} value={settings.intensity} />
          {moves && (
            <Slider
              format={(value) => `${value.toFixed(2).replace(/0$/, "")}×`}
              label="Velocidad"
              max={SPEED_LIMITS.max}
              min={SPEED_LIMITS.min}
              onChange={(speed) => background.set({ speed })}
              step={0.05}
              value={settings.speed}
            />
          )}
        </section>
      )}
      {colorful && (
        <section className="menu-group">
          <Segmented label="Colores de" onChange={(palette) => background.set({ palette })} options={sources} value={settings.palette} />
          {settings.palette === "custom" && (
            <Slider className="hue" format={(value) => `${Math.round(value)}°`} label="Tono elegido" max={359} min={0} onChange={(hue) => background.set({ hue })} step={1} value={settings.hue} />
          )}
        </section>
      )}
      {moves && (
        <section className="menu-group">
          <Segmented
            label="Cuadros por segundo"
            onChange={(fps) => background.set({ fps: fps === "auto" ? "auto" : (Number(fps) as 30 | 60) })}
            options={fpsOptions}
            value={String(settings.fps) as "30" | "60" | "auto"}
          />
          <SwitchRow checked={settings.batterySaver} label="Ahorro de batería automático" onChange={(batterySaver) => background.set({ batterySaver })} />
          <p className="hint">Con batería baja o ahorro de datos, el fondo usa menos manchas y menos cuadros. También baja solo si el dispositivo no lo aguanta.</p>
        </section>
      )}
    </>
  );
}

const sleepChoices: { label: string; value: number | "track" }[] = [
  { label: "5 minutos", value: 5 },
  { label: "15 minutos", value: 15 },
  { label: "30 minutos", value: 30 },
  { label: "45 minutos", value: 45 },
  { label: "60 minutos", value: 60 },
  { label: "90 minutos", value: 90 },
  { label: "Al terminar la canción", value: "track" },
];

function TimerPage() {
  const sleep = usePlayer((state) => state.sleep);
  return (
    <>
      <p className="menu-status" role="status">
        {sleep === null
          ? "Sin temporizador."
          : "endOfTrack" in sleep
            ? "La música se detendrá al terminar esta canción."
            : `La música se apagará a las ${clock(sleep.endsAt)}, con un fundido final.`}
      </p>
      <section aria-label="Apagar la música" className="menu-group">
        {sleepChoices.map((choice) => {
          const active = sleep !== null && (choice.value === "track" ? "endOfTrack" in sleep : false);
          return (
            <button aria-pressed={active} className="menu-row" key={choice.label} onClick={() => player.setSleep(choice.value)} type="button">
              <span className="menu-label">{choice.label}</span>
              {active && <Check {...iconSmall} />}
            </button>
          );
        })}
      </section>
      <button className="button menu-reset" disabled={sleep === null} onClick={() => player.setSleep(null)} type="button">
        Cancelar temporizador
      </button>
    </>
  );
}

// --- Panel ---

const wideQuery = "(min-width: 600px)";
function useWide(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(wideQuery);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    () => window.matchMedia(wideQuery).matches,
  );
}

/** Posición del popover junto al icono: hacia arriba si el icono está en la mitad inferior, hacia abajo si no. */
function popoverStyle(anchor: HTMLElement | null): CSSProperties {
  if (!anchor) return {};
  const rect = anchor.getBoundingClientRect();
  const margin = 8;
  const width = Math.min(22 * 16, window.innerWidth - 2 * margin);
  const right = Math.min(Math.max(window.innerWidth - rect.right, margin), window.innerWidth - width - margin);
  const up = rect.top > window.innerHeight / 2;
  return {
    width,
    right,
    ...(up
      ? { bottom: window.innerHeight - rect.top + margin, maxHeight: rect.top - 2 * margin }
      : { top: rect.bottom + margin, maxHeight: window.innerHeight - rect.bottom - 2 * margin }),
  };
}

function MenuPanel({ anchor, onClose }: { anchor: RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const wide = useWide();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<string | null>(null);
  const [stack, setStack] = useState<PageId[]>([]);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [style, setStyle] = useState<CSSProperties>({});
  const page = stack.at(-1) ?? "root";

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useLayoutEffect(() => {
    if (!wide) return setStyle({});
    const place = () => setStyle(popoverStyle(anchor.current));
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [wide, anchor]);

  // Al cambiar de página el foco va al título (el lector de pantalla la anuncia); al volver, a la fila que la abrió.
  useEffect(() => {
    const back = opener.current && dialog.current?.querySelector<HTMLElement>(`[data-key="${opener.current}"]`);
    (back || heading.current)?.focus({ preventScroll: true });
    opener.current = null;
  }, [page]);

  const go = (next: PageId) => {
    opener.current = null;
    setDirection("forward");
    setStack((pages) => [...pages, next]);
  };
  const goBack = () => {
    opener.current = page;
    setDirection("back");
    setStack((pages) => pages.slice(0, -1));
  };
  const close = () => dialog.current?.close(); // el evento "close" desmonta y devuelve el foco al icono

  // Teclado: Tab da la vuelta; ↑/↓ recorren los controles (salvo los deslizadores verticales del ecualizador, que usan sus flechas);
  // ←/→ cambian de opción dentro de un grupo de opciones.
  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    const target = event.target as HTMLElement;
    if (event.key === "Tab") {
      // El foco da la vuelta dentro del menú (no escapa a la barra del navegador ni a la página de detrás).
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
      const edge = event.shiftKey ? items[0] : items.at(-1);
      if (target === edge || (event.shiftKey && target === heading.current)) {
        event.preventDefault();
        (event.shiftKey ? items.at(-1) : items[0])?.focus();
      }
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (target.dataset.vertical) return;
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
      const down = event.key === "ArrowDown";
      const index = items.indexOf(target);
      const next = index === -1 ? (down ? items.find((item) => item.closest(".menu-page")) : items.at(-1)) : items[(index + (down ? 1 : -1) + items.length) % items.length];
      event.preventDefault();
      next?.focus();
    } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && target.getAttribute("role") === "radio") {
      const options = [...(target.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])];
      const step = event.key === "ArrowRight" ? 1 : -1;
      event.preventDefault();
      options[(options.indexOf(target) + step + options.length) % options.length]?.focus();
    }
  }

  // Hoja inferior: arrastrar la cabecera hacia abajo la cierra. Quien no puede arrastrar usa Escape o el botón cerrar.
  const drag = useDragDismiss(dialog, close, { enabled: !wide });

  return (
    <dialog
      aria-label="Menú del reproductor"
      className="menu"
      data-presentation={wide ? "popover" : "sheet"}
      onClick={(event) => event.target === dialog.current && close()}
      onClose={onClose}
      onKeyDown={onKeyDown}
      ref={dialog}
      style={style}
    >
      <header className="menu-head" {...drag}>
        {!wide && <span aria-hidden="true" className="menu-grabber" />}
        <div className="menu-head-row">
          {stack.length > 0 && (
            <IconButton label={`Volver a ${titles[stack.length > 1 ? stack[stack.length - 2] : "root"]}`} onClick={goBack}>
              <ArrowLeft {...icon} />
            </IconButton>
          )}
          <h2 ref={heading} tabIndex={-1}>
            {titles[page]}
          </h2>
          <IconButton label="Cerrar menú" onClick={close}>
            <X {...icon} />
          </IconButton>
        </div>
      </header>
      <div className="menu-body">
        <div className="menu-page" data-direction={direction} key={page}>
          {page === "root" && <RootPage go={go} />}
          {page === "sound" && <SoundPage go={go} />}
          {page === "eq" && <EqPage />}
          {page === "timer" && <TimerPage />}
          {page === "background" && <BackgroundPage />}
        </div>
      </div>
    </dialog>
  );
}

/** Icono ≡ que abre el menú. Cada barra (mini, escritorio, expandido) tiene el suyo; solo uno está abierto a la vez. */
export function MenuButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <IconButton
        aria-expanded={open}
        aria-haspopup="dialog"
        className={className}
        label="Menú del reproductor"
        onClick={() => setOpen(true)}
        ref={button}
      >
        <Menu {...icon} />
      </IconButton>
      {open && <MenuPanel anchor={button} onClose={() => setOpen(false)} />}
    </>
  );
}
