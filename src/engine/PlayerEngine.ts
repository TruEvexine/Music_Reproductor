import { dbToGain, EQ_BANDS } from "../core/audio";
import type { EqChain } from "../core/audio";

// Motor de audio: único dueño de los <audio> y del grafo Web Audio. No conoce React, la cola ni la biblioteca.
//
//   deck A ─ ganancia(ReplayGain) ─ fundido ─┐
//                                            ├─ preamp ─ EQ ×10 ─ graves ─ agudos ─ balance ─ volumen ─ limitador ─ analizador ─ salida
//   deck B ─ ganancia(ReplayGain) ─ fundido ─┘
//
// Dos decks: uno suena y el otro precarga la siguiente pista (salto casi sin hueco) o entra en crossfade.
// El gapless es aproximado: depende de lo rápido que el navegador arranque el segundo <audio>.

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
      this.master.gain.cancelScheduledValues(0);
      this.master.gain.value = this.volume;
    } else for (const deck of this.decks) deck.audio.volume = this.volume;
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

  /** Rampa del volumen general (no toca los fundidos de cada deck). */
  private rampMaster(target: number, seconds: number, from = this.master?.gain.value ?? 0) {
    if (!this.master || !this.context) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(0);
    this.master.gain.setValueAtTime(from, now);
    this.master.gain.linearRampToValueAtTime(target, now + seconds);
  }

  /** Rechaza con el error del navegador (salvo AbortError: otra carga interrumpió esta). `fade`: segundos de entrada. */
  async play(fade = 0): Promise<void> {
    try {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = undefined;
      await this.graph()?.resume();
      if (fade > 0 && this.master) this.rampMaster(this.volume, fade, this.current.audio.paused ? 0 : undefined);
      else this.applyVolume();
      await this.current.audio.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    }
  }

  /** `fade` > 0: baja el volumen y pausa al terminar (pausa suave y temporizador de apagado). Sin Web Audio, pausa al instante. */
  pause(fade = 0) {
    clearTimeout(this.pauseTimer);
    this.pauseTimer = undefined;
    const hardPause = () => {
      this.pauseTimer = undefined;
      this.cancelFade();
      this.idle.audio.pause();
      this.current.audio.pause();
      this.applyVolume();
    };
    if (fade > 0 && this.master && !this.current.audio.paused) {
      this.rampMaster(0, fade);
      this.pauseTimer = setTimeout(hardPause, fade * 1000);
    } else hardPause();
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
      rate: this.current.audio.playbackRate,
      src: this.current.audio.src,
    };
  }
}
