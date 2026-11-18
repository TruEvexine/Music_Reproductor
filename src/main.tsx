import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/instrument-sans/wdth.css";
import { target } from "./platform";
import { initBackground } from "./state/background";
import { initSession } from "./state/player";
import { initProfile } from "./state/profile";
import { playlists } from "./state/playlists";
import { initTutorials } from "./state/tutorials";
import App from "./ui/App";
import "./ui/styles/tokens.css";
import "./ui/styles/base.css";
import "./ui/styles/range.css";
import "./ui/styles/shell.css";
import "./ui/styles/library.css";
import "./ui/styles/player.css";
import "./ui/styles/menu.css";
import "./ui/styles/backdrop.css";
import "./ui/styles/landing.css";
import "./ui/styles/legal.css";

// Las variantes por plataforma se resuelven en CSS con [data-platform], no con componentes distintos.
document.documentElement.dataset.platform = target;
// Última forma de interacción: Chromium dibuja el aro de foco al abrir un diálogo aunque se haya abierto con el dedo.
// CSS (base.css) lo oculta mientras el último gesto no fuera de teclado.
const root = document.documentElement;
addEventListener("keydown", () => (root.dataset.input = "key"), true);
addEventListener("pointerdown", () => delete root.dataset.input, true);
void initSession();
void initBackground();
void initTutorials();
void initProfile();
void playlists.init();
// Diagnóstico de audio para probar en un teléfono; se carga aparte y solo si se pide.
if (new URLSearchParams(location.search).get("diag") === "1") void import("./ui/diag").then(({ startDiagnostics }) => startDiagnostics());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
