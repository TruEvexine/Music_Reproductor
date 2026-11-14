import { dbToGain, EQ_BANDS } from "../core/audio";
import type { EqChain } from "../core/audio";
import { ANALYSER_DB } from "../core/rhythm";

// Motor de audio: único dueño de los <audio> y del grafo Web Audio. No conoce React, la cola ni la biblioteca.
//
//   deck A ─ ganancia(ReplayGain) ─ fundido ─┐
//                                            ├─ preamp ─ EQ ×10 ─ graves ─ agudos ─ balance ─ volumen ─ limitador ─ analizador ─ salida
//   deck B ─ ganancia(ReplayGain) ─ fundido ─┘
//
// Dos decks: uno suena y el otro precarga la siguiente pista (salto casi sin hueco) o entra en crossfade.
// El gapless es aproximado: depende de lo rápido que el navegador arranque el segundo <audio>.

const VOLUME_RAMP = 0.015; // s: cambiar el volumen sin escalón audible
const PAUSE_MARGIN = 0.02; // s tras la rampa antes de pausar el <audio>
const SEEK_DIP = 0.04; // s de bajada (y de subida) alrededor de una búsqueda: sin chasquido al saltar
const SEEK_GIVE_UP = 1000; // ms: si `seeked` no llega, el volumen vuelve igual

export interface EngineEvents {
  onPlaying(playing: boolean): void;
  /** El audio activo ya suena de verdad (evento `playing`, no solo `play`): el sistema ya lo reconoce como fuente. */
  onStarted(): void;
  onTime(position: number): void;
  onDuration(duration: number): void;
  onEnded(): void;
  /** El navegador no pudo cargar o decodificar la fuente actual. */
  onError(): void;
}

interface Deck {
  audio: HTMLAudioElement;
  gain?: GainNode;
  fade?: GainNode;
  pendingSeek: number;
}

export class PlayerEngine {
  private readonly decks: [Deck, Deck];
  private active = 0;
  private context?: AudioContext;
  private preamp?: GainNode;
  private filters: BiquadFilterNode[] = [];
  private bass?: BiquadFilterNode;
  private treble?: BiquadFilterNode;
  private panner?: StereoPannerNode;
  private master?: GainNode;
  private volume = 1;
  private eq: EqChain | null = null;
  private balance = 0;
  private speed = 1;
  private fadeTimer?: ReturnType<typeof setTimeout>;
  private pauseTimer?: ReturnType<typeof setTimeout>;
  /** Cambia en cada play/pause: una reanudación que espera a `audio.play()` no pisa una pausa pedida mientras tanto. */
  private turn = 0;
  private ramp = { from: 1, to: 1, start: 0, end: 0 };
  /** Cambia con cada búsqueda suave: la que interrumpe a otra deja sin efecto la anterior. */
  private seekTurn = 0;
  private seekTimer?: ReturnType<typeof setTimeout>;
  /** Destino de la búsqueda mientras baja el volumen (aún no se ha tocado `currentTime`). */
  private seekTarget: number | null = null;
  /** Para el fondo "Ritmo" y visualizadores. Existe tras la primera reproducción. */
  analyser?: AnalyserNode;

  constructor(private readonly events: EngineEvents) {
    this.decks = [this.createDeck(), this.createDeck()];
  }

  private createDeck(): Deck {
    const audio = new Audio();
    audio.preload = "auto";
    audio.defaultPlaybackRate = audio.playbackRate = this.speed;
    const deck: Deck = { audio, pendingSeek: 0 };
    // Solo el deck activo informa: el que precarga o se está apagando en un crossfade no cuenta.
    const whenActive = (handler: () => void) => () => {
      if (this.decks[this.active] === deck) handler();
    };
    audio.addEventListener("play", whenActive(() => this.events.onPlaying(true)));
    audio.addEventListener("pause", whenActive(() => this.events.onPlaying(false)));
    audio.addEventListener("playing", whenActive(() => this.events.onStarted()));
    audio.addEventListener("timeupdate", whenActive(() => this.seekTarget === null && this.events.onTime(audio.currentTime)));
    audio.addEventListener("ended", whenActive(() => this.events.onEnded()));
    audio.addEventListener("error", whenActive(() => audio.getAttribute("src") && this.events.onError()));
    audio.addEventListener("loadedmetadata", () => {
      if (deck.pendingSeek > 0) {
        audio.currentTime = Math.min(deck.pendingSeek, audio.duration || deck.pendingSeek);
        deck.pendingSeek = 0;
      }
      if (this.decks[this.active] === deck && Number.isFinite(audio.duration)) this.events.onDuration(audio.duration);
    });
    return deck;
  }

  private get current(): Deck {
    return this.decks[this.active];
  }

  private get idle(): Deck {
    return this.decks[1 - this.active];
  }

  /** El AudioContext solo puede crearse tras un gesto del usuario: se monta en la primera reproducción. */
  private graph(): AudioContext | undefined {
    if (this.context) return this.context;
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return undefined; // sin Web Audio: el <audio> suena directo, sin EQ ni crossfade
    const context = (this.context = new Context());
    this.preamp = context.createGain();
    this.filters = EQ_BANDS.map((frequency) => {
      const filter = context.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = frequency;
      filter.Q.value = 1.41;
      return filter;
    });
    this.bass = context.createBiquadFilter();
    this.bass.type = "lowshelf";
    this.bass.frequency.value = 120;
    this.treble = context.createBiquadFilter();
    this.treble.type = "highshelf";
    this.treble.frequency.value = 6000;
    this.panner = context.createStereoPanner();
    this.master = context.createGain();
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.4; // poco suavizado: los golpes del fondo "Ritmo" necesitan flancos nítidos
    this.analyser.minDecibels = ANALYSER_DB.min;
    this.analyser.maxDecibels = ANALYSER_DB.max;
    const chain: AudioNode[] = [this.preamp, ...this.filters, this.bass, this.treble, this.panner, this.master, limiter, this.analyser, context.destination];
    chain.reduce((from, to) => (from.connect(to), to));
    for (const deck of this.decks) {
      deck.gain = context.createGain();
      deck.fade = context.createGain();
      context.createMediaElementSource(deck.audio).connect(deck.gain).connect(deck.fade).connect(this.preamp);
    }
    this.applyVolume();
    this.applyEq();
    this.panner.pan.value = this.balance;
    return context;
  }

  private applyVolume() {
    if (this.master) {
      // En pleno fundido de pausa manda la rampa a 0; en una búsqueda, su subida (que ya usa el volumen nuevo).
      if (this.pauseTimer === undefined && this.seekTimer === undefined) this.rampMaster(this.volume, VOLUME_RAMP);
    } else for (const deck of this.decks) deck.audio.volume = this.volume;
  }

  /**
   * Rampa lineal del volumen general desde el valor que tiene ahora mismo, también a mitad de otra rampa (alternar rápido).
   * El valor se calcula de la última rampa: `gain.value` llega con retraso y `cancelAndHoldAtTime` no ancla si no hay rampa en curso
   * (la nueva interpolaría desde el evento anterior: escalón). Lineal porque una exponencial no llega a 0. Devuelve el fin, en reloj de audio.
   */
  private rampMaster(target: number, seconds: number): number {
    const gain = this.master!.gain;
    const now = this.context!.currentTime;
    const { from, to, start, end } = this.ramp;
    const value = now >= end ? to : from + ((to - from) * (now - start)) / (end - start);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(value, now);
    gain.linearRampToValueAtTime(target, now + seconds);
    this.ramp = { from: value, to: target, start: now, end: now + seconds };
    return now + seconds;
  }

  private applyEq() {
    if (!this.preamp || !this.bass || !this.treble) return;
    const gains = this.eq?.gains ?? EQ_BANDS.map(() => 0);
    this.preamp.gain.value = dbToGain(this.eq?.preampDb ?? 0);
    this.filters.forEach((filter, index) => (filter.gain.value = gains[index] ?? 0));
    this.bass.gain.value = this.eq?.bass ?? 0;
    this.treble.gain.value = this.eq?.treble ?? 0;
  }

  private cancelFade() {
    clearTimeout(this.fadeTimer);
    this.fadeTimer = undefined;
    for (const deck of this.decks) {
      deck.fade?.gain.cancelScheduledValues(0);
      if (deck.fade) deck.fade.gain.value = 1;
    }
  }

  private silence(deck: Deck) {
    deck.audio.pause();
    deck.audio.removeAttribute("src");
    deck.audio.load();
  }

  /** Volumen 0–1 (0 = silencio). Con Web Audio funciona también en iOS, donde `audio.volume` no se puede cambiar. */
  setVolume(volume: number) {
    this.volume = volume;
    this.applyVolume();
  }

  /** `null` = ecualizador apagado. */
  setEq(chain: EqChain | null) {
    this.eq = chain;
    this.applyEq();
  }

  /** -1 (izquierda) … 1 (derecha). */
  setBalance(balance: number) {
    this.balance = balance;
    if (this.panner) this.panner.pan.value = balance;
  }

  /** Velocidad conservando el tono. `defaultPlaybackRate` evita que se pierda al cambiar de pista. */
  setSpeed(rate: number) {
    this.speed = rate;
    for (const deck of this.decks) {
      deck.audio.defaultPlaybackRate = rate;
      deck.audio.playbackRate = rate;
    }
  }

  /** Ganancia de ReplayGain de la pista que suena. */
  setTrackGain(gain: number) {
    if (this.current.gain) this.current.gain.gain.value = gain;
  }

  /** Carga una pista en el deck activo. Si ya estaba precargada en el otro, simplemente cambia de deck. */
  load(url: string, startAt = 0, gain = 1) {
    this.cancelSeek();
    this.cancelFade();
    if (this.idle.audio.getAttribute("src") === url && startAt === 0) {
      const previous = this.current;
      this.active = 1 - this.active;
      this.silence(previous);
      if (Number.isFinite(this.current.audio.duration)) this.events.onDuration(this.current.audio.duration);
    } else {
      this.silence(this.idle);
      this.current.pendingSeek = startAt;
      this.current.audio.src = url;
      this.current.audio.load();
    }
    this.setTrackGain(gain);
  }

  /** Deja lista la siguiente pista en el deck libre para que el salto sea inmediato. */
  preload(url: string) {
    if (this.idle.audio.getAttribute("src") === url) return;
    this.idle.audio.src = url;
    this.idle.audio.load();
  }

  /** Funde la pista actual con `url` durante `seconds`. Devuelve false si no hay Web Audio (el llamador carga normal). */
  crossfadeTo(url: string, seconds: number, gain = 1): boolean {
    const context = this.graph();
    const from = this.current;
    const to = this.idle;
    if (!context || !from.fade || !to.fade || !to.gain) return false;
    this.cancelSeek();
    this.cancelFade();
    if (to.audio.getAttribute("src") !== url) {
      to.audio.src = url;
      to.audio.load();
    }
    const now = context.currentTime;
    to.gain.gain.value = gain;
    to.fade.gain.setValueAtTime(0, now);
    to.fade.gain.linearRampToValueAtTime(1, now + seconds);
    from.fade.gain.setValueAtTime(1, now);
    from.fade.gain.linearRampToValueAtTime(0, now + seconds);
    this.active = 1 - this.active;
    void to.audio.play().catch(() => this.events.onError());
    this.fadeTimer = setTimeout(() => {
      this.silence(from);
      if (from.fade) from.fade.gain.value = 1;
    }, seconds * 1000 + 50);
    return true;
  }

  /** Rechaza con el error del navegador (salvo AbortError: otra carga interrumpió esta). `fade`: segundos de entrada. */
  async play(fade = 0): Promise<void> {
    const turn = ++this.turn;
    try {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = undefined;
      const context = this.graph();
      await context?.resume();
      const master = this.master;
      if (!context || !master || fade <= 0) {
        this.applyVolume();
        await this.current.audio.play();
      } else if (this.current.audio.paused) {
        // Desde silencio, la subida empieza cuando el <audio> ya entrega muestras: antes arrancaba a media rampa (escalón).
        this.rampMaster(0, 0);
        await this.current.audio.play();
        if (turn === this.turn) this.rampMaster(this.volume, fade);
      } else this.rampMaster(this.volume, fade); // a mitad de un fundido de pausa: sube desde donde iba
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    }
  }

  /** `fade` > 0: baja el volumen y pausa al terminar (pausa suave y temporizador de apagado). Sin Web Audio, pausa al instante. */
  pause(fade = 0) {
    this.turn += 1;
    clearTimeout(this.pauseTimer);
    this.pauseTimer = undefined;
    const context = this.context;
    const master = this.master;
    // El volumen se queda donde lo dejó la rampa (0): el <audio> aún entrega unos milisegundos tras pause(), y play() lo vuelve a subir.
    const hardPause = () => {
      this.pauseTimer = undefined;
      this.cancelFade();
      this.idle.audio.pause();
      this.current.audio.pause();
    };
    if (fade > 0 && context && master && !this.current.audio.paused) {
      const end = this.rampMaster(0, fade) + PAUSE_MARGIN;
      // Reloj de audio, no el de JS: el <audio> se para solo cuando la rampa ya se calculó entera.
      const wait = () => {
        this.pauseTimer = context.state !== "running" || context.currentTime >= end ? void hardPause() : setTimeout(wait, 10);
      };
      this.pauseTimer = setTimeout(wait, fade * 1000);
    } else hardPause();
  }

  stop() {
    this.cancelSeek();
    this.cancelFade();
    for (const deck of this.decks) this.silence(deck);
  }

  /**
   * Sonando con Web Audio: baja el volumen SEEK_DIP, salta y lo sube al llegar `seeked` (sin chasquido). En pausa o sin Web Audio, salta directo.
   * Una búsqueda a mitad de otra baja desde donde iba; solo la última salta y sube el volumen.
   */
  seek(position: number) {
    if (!Number.isFinite(position)) return;
    const target = Math.max(0, position);
    const audio = this.current.audio;
    const context = this.context;
    if (!context || !this.master || context.state !== "running" || audio.paused || this.pauseTimer !== undefined) {
      this.cancelSeek();
      audio.currentTime = target;
      return;
    }
    const turn = ++this.seekTurn;
    clearTimeout(this.seekTimer);
    this.seekTarget = target;
    const end = this.rampMaster(0, SEEK_DIP);
    const restore = () => {
      if (turn !== this.seekTurn) return;
      clearTimeout(this.seekTimer);
      this.seekTimer = undefined;
      if (this.pauseTimer === undefined) this.rampMaster(this.volume, SEEK_DIP); // en pleno fundido de pausa manda esa rampa
    };
    // Reloj de audio, como en la pausa: se salta cuando la bajada ya se calculó entera.
    const jump = () => {
      if (turn !== this.seekTurn) return;
      if (context.state === "running" && context.currentTime < end) return void (this.seekTimer = setTimeout(jump, 5));
      this.seekTarget = null;
      audio.addEventListener("seeked", restore, { once: true });
      audio.currentTime = target;
      this.seekTimer = setTimeout(restore, SEEK_GIVE_UP);
    };
    this.seekTimer = setTimeout(jump, SEEK_DIP * 1000);
  }

  /** Abandona una búsqueda suave (cambio de pista, parada, búsqueda en pausa) y devuelve el volumen. */
  private cancelSeek() {
    if (this.seekTimer === undefined) return;
    this.seekTurn += 1;
    clearTimeout(this.seekTimer);
    this.seekTimer = undefined;
    this.seekTarget = null;
    if (this.master && this.pauseTimer === undefined) this.rampMaster(this.volume, SEEK_DIP);
  }

  /** Durante la bajada de una búsqueda, su destino: varias flechas seguidas suman desde ahí. */
  get position(): number {
    return this.seekTarget ?? this.current.audio.currentTime;
  }

  /** Pausada o a punto de estarlo (en pleno fundido de pausa). */
  get paused(): boolean {
    return this.current.audio.paused || this.pauseTimer !== undefined;
  }

  /** Valores reales del grafo, para verificar que un ajuste llega al motor (pruebas en navegador). */
  snapshot() {
    return {
      eq: this.filters.map((filter) => filter.gain.value),
      preamp: this.preamp?.gain.value,
      bass: this.bass?.gain.value,
      treble: this.treble?.gain.value,
      pan: this.panner?.pan.value,
      master: this.master?.gain.value,
      rate: this.current.audio.playbackRate,
      src: this.current.audio.src,
    };
  }
}
