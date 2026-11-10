import { oklchToRgb } from "../core/palette";
import type { Rgb } from "../core/palette";

// Render WebGL del fondo: un solo triángulo a pantalla completa y un shader que suma manchas gaussianas de color.
// Sin librerías: es un shader de ~40 líneas. El lienzo se dibuja a baja resolución (los degradados no necesitan más)
// y el navegador lo escala. El coste en CPU por cuadro es un puñado de uniformes y una llamada de dibujo.

export interface Frame {
  /** Tiempo simulado (s): ya incluye la velocidad elegida. */
  time: number;
  bass: number;
  mid: number;
  treble: number;
  /** Pulso del último golpe, 1 → 0 en ~120 ms. */
  beat: number;
}

export interface Look {
  colors: Rgb[];
  intensity: number;
  blobs: number;
}

export interface Renderer {
  draw(frame: Frame, look: Look): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const vertex = `attribute vec2 position;
varying vec2 uv;
void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = `precision mediump float;
varying vec2 uv;
uniform vec2 res;
uniform float time, bass, mid, treble, beat, intensity;
uniform int blobs;
uniform vec3 base, c0, c1, c2, c3;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  float aspect = res.x / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec3 col = base;
  // Las manchas derivan despacio; con música, los agudos aceleran el giro, los graves hinchan y el golpe pulsa.
  float drift = time * (1.0 + treble * 1.5);
  for (int i = 0; i < 5; i++) {
    if (i >= blobs) break;
    float f = float(i);
    vec2 centre = vec2(aspect * (0.5 + 0.42 * sin(drift * (0.17 + 0.05 * f) + f * 2.3)), 0.5 + 0.4 * cos(drift * (0.13 + 0.04 * f) + f * 1.7));
    float radius = 0.4 + 0.1 * sin(time * 0.21 + f) + bass * 0.16 + beat * 0.08 + mid * 0.04;
    float d = length(p - centre) / radius;
    vec3 tint = i == 0 ? c0 : i == 1 ? c1 : i == 2 ? c2 : i == 3 ? c3 : mix(c0, c2, 0.5);
    col += tint * exp(-d * d * 2.2) * intensity * min(0.9 + bass * 0.5 + beat * 0.3, 1.25);
  }
  // Más oscuro hacia abajo, donde están los controles: el texto claro sigue legible con cualquier portada.
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.55, uv.y));
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0; // ruido mínimo: evita las bandas del degradado
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

const BASE = oklchToRgb(0.145, 0.004, 70); // el --bg de la app (tokens.css)

/**
 * Crea el render sobre `canvas`. Devuelve null si no hay WebGL o el shader no compila (el llamador usa el respaldo CSS).
 * `onLost` se llama si el navegador pierde el contexto (GPU reiniciada, demasiados contextos).
 */
export function createRenderer(canvas: HTMLCanvasElement, onLost: () => void): Renderer | null {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "low-power" });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, vertex);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const at = (name: string) => gl.getUniformLocation(program, name);
  const u = { res: at("res"), time: at("time"), bass: at("bass"), mid: at("mid"), treble: at("treble"), beat: at("beat"), intensity: at("intensity"), blobs: at("blobs"), base: at("base"), colors: [at("c0"), at("c1"), at("c2"), at("c3")] };
  gl.uniform3f(u.base, BASE[0], BASE[1], BASE[2]);

  const lost = (event: Event) => {
    event.preventDefault(); // sin esto el navegador no intentaría restaurarlo; aquí se prefiere el respaldo CSS
    onLost();
  };
  canvas.addEventListener("webglcontextlost", lost);

  return {
    draw(frame, look) {
      gl.uniform1f(u.time, frame.time);
      gl.uniform1f(u.bass, frame.bass);
      gl.uniform1f(u.mid, frame.mid);
      gl.uniform1f(u.treble, frame.treble);
      gl.uniform1f(u.beat, frame.beat);
      gl.uniform1f(u.intensity, look.intensity);
      gl.uniform1i(u.blobs, look.blobs);
      look.colors.forEach((color, i) => i < 4 && gl.uniform3f(u.colors[i], color[0], color[1], color[2]));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    resize(width, height) {
      canvas.width = Math.max(2, Math.round(width));
      canvas.height = Math.max(2, Math.round(height));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.res, canvas.width, canvas.height);
    },
    dispose() {
      canvas.removeEventListener("webglcontextlost", lost);
      gl.getExtension("WEBGL_lose_context")?.loseContext(); // libera el contexto ya: el navegador admite pocos a la vez
    },
  };
}
