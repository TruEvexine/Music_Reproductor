// Motor de audio: único dueño del elemento <audio>. No conoce React, ni la cola, ni la biblioteca.
// El store le dice qué URL cargar y él informa de lo que ocurre de verdad en el audio.

export interface EngineEvents {
  onPlaying(playing: boolean): void;
  onTime(position: number): void;
  onDuration(duration: number): void;
  onEnded(): void;
  /** El navegador no pudo cargar o decodificar la fuente actual. */
  onError(): void;
}

export class PlayerEngine {
  private readonly audio = new Audio();
  private pendingSeek = 0;

  constructor(events: EngineEvents) {
    const audio = this.audio;
    audio.preload = "metadata";
    audio.addEventListener("play", () => events.onPlaying(true));
    audio.addEventListener("pause", () => events.onPlaying(false));
    audio.addEventListener("timeupdate", () => events.onTime(audio.currentTime));
    audio.addEventListener("ended", () => events.onEnded());
    audio.addEventListener("error", () => events.onError());
    audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(audio.duration)) events.onDuration(audio.duration);
      if (this.pendingSeek > 0) {
        audio.currentTime = Math.min(this.pendingSeek, audio.duration || this.pendingSeek);
        this.pendingSeek = 0;
      }
    });
  }

  /** Carga una fuente nueva; `startAt` se aplica cuando el audio ya conoce su duración. */
  load(url: string, startAt = 0): void {
    this.pendingSeek = startAt;
    this.audio.src = url;
    this.audio.load();
  }

  /** Rechaza con el error del navegador (salvo AbortError: otra carga interrumpió esta). */
  async play(): Promise<void> {
    try {
      await this.audio.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    }
  }

  pause(): void {
    this.audio.pause();
  }

  stop(): void {
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }

  seek(position: number): void {
    if (Number.isFinite(position)) this.audio.currentTime = Math.max(0, position);
  }

  get position(): number {
    return this.audio.currentTime;
  }

  get paused(): boolean {
    return this.audio.paused;
  }
}
