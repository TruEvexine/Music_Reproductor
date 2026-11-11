import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/instrument-sans/wdth.css";
import { target } from "./platform";
import { initBackground } from "./state/background";
import { initSession } from "./state/player";
import { playlists } from "./state/playlists";
import App from "./ui/App";
import "./ui/styles/tokens.css";
import "./ui/styles/base.css";
import "./ui/styles/shell.css";
import "./ui/styles/library.css";
import "./ui/styles/player.css";
import "./ui/styles/menu.css";
import "./ui/styles/backdrop.css";

// Las variantes por plataforma se resuelven en CSS con [data-platform], no con componentes distintos.
document.documentElement.dataset.platform = target;
void initSession();
void initBackground();
void playlists.init();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
