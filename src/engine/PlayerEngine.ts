import { dbToGain, EQ_BANDS, eqPreampDb } from "../core/audio";

// Motor de audio: único dueño de los <audio> y del grafo Web Audio. No conoce React, la cola ni la biblioteca.
//
//   deck A ─ ganancia(ReplayGain) ─ fundido ─┐
//                                            ├─ preamp ─ EQ ×10 ─ volumen ─ limitador ─ analizador ─ salida
//   deck B ─ ganancia(ReplayGain) ─ fundido ─┘
//
// Dos decks: uno suena y el otro precarga la siguiente pista (salto casi sin hueco) o entra en crossfade.
// El gapless es aproximado: depende de lo rápido que el navegador arranque el segundo <audio>.

export interface EngineEvents {
  onPlaying(playing: boolean): void;
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
  private master?: GainNode;
  private volume = 1;
  private eq: readonly number[] | null = null;
  private fadeTimer?: ReturnType<typeof setTimeout>;
  /** Para el fondo "Ritmo" y visualizadores. Existe tras la primera reproducción. */
  analyser?: AnalyserNode;

  constructor(private readonly events: EngineEvents) {
    this.decks = [this.createDeck(), this.createDeck()];
  }

  private createDeck(): Deck {
    const audio = new Audio();
    audio.preload = "auto";
    const deck: Deck = { audio, pendingSeek: 0 };
    // Solo el deck activo informa: el que precarga o se está apagando en un crossfade no cuenta.
    const whenActive = (handler: () => void) => () => {
      if (this.decks[this.active] === deck) handler();
    };
    audio.addEventListener("play", whenActive(() => this.events.onPlaying(true)));
    audio.addEventListener("pause", whenActive(() => this.events.onPlaying(false)));
    audio.addEventListener("timeupdate", whenActive(() => this.events.onTime(audio.currentTime)));
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
    this.master = context.createGain();
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 2048;
    const chain: AudioNode[] = [this.preamp, ...this.filters, this.master, limiter, this.analyser, context.destination];
    chain.reduce((from, to) => (from.connect(to), to));
    for (const deck of this.decks) {
      deck.gain = context.createGain();
      deck.fade = context.createGain();
      context.createMediaElementSource(deck.audio).connect(deck.gain).connect(deck.fade).connect(this.preamp);
    }
    this.applyVolume();
    this.applyEq();
    return context;
  }

  private applyVolume() {
    if (this.master) this.master.gain.value = this.volume;
    else for (const deck of this.decks) deck.audio.volume = this.volume;
  }

  private applyEq() {
    if (!this.preamp) return;
    const gains = this.eq ?? EQ_BANDS.map(() => 0);
    this.preamp.gain.value = dbToGain(eqPreampDb(gains));
    this.filters.forEach((filter, index) => (filter.gain.value = gains[index] ?? 0));
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
  setEq(gains: readonly number[] | null) {
    this.eq = gains;
    this.applyEq();
  }

  /** Ganancia de ReplayGain de la pista que suena. */
  setTrackGain(gain: number) {
    if (this.current.gain) this.current.gain.gain.value = gain;
  }

  /** Carga una pista en el deck activo. Si ya estaba precargada en el otro, simplemente cambia de deck. */
  load(url: string, startAt = 0, gain = 1) {
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

  /** Baja el volumen general a cero en `seconds` y pausa (temporizador de apagado). */
  fadeOutAndPause(seconds: number) {
    const done = () => {
      this.pause();
      this.applyVolume();
    };
    if (!this.master || !this.context) return done();
    const now = this.context.currentTime;
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + seconds);
    setTimeout(() => {
      this.master?.gain.cancelScheduledValues(0);
      done();
    }, seconds * 1000);
  }

  /** Rechaza con el error del navegador (salvo AbortError: otra carga interrumpió esta). */
  async play(): Promise<void> {
    try {
      await this.graph()?.resume();
      await this.current.audio.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    }
  }

  pause() {
    this.cancelFade();
    this.idle.audio.pause();
    this.current.audio.pause();
  }

  stop() {
    this.cancelFade();
    for (const deck of this.decks) this.silence(deck);
  }

  seek(position: number) {
    if (Number.isFinite(position)) this.current.audio.currentTime = Math.max(0, position);
  }

  get position(): number {
    return this.current.audio.currentTime;
  }

  get paused(): boolean {
    return this.current.audio.paused;
  }
}
