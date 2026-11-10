import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { CircleUser, Library, ListMusic } from "lucide-react";
import { isNative } from "../platform";
import { useAuthController } from "../sync/useAuthController";
import { Backdrop, Tint } from "./Backdrop";
import { AuthDialog } from "./dialogs";
import { Landing } from "./Landing";
import { LibraryView } from "./LibraryView";
import { icon } from "./parts";
import { NowPlaying, PlayerBar, QueuePanel, useCurrentTrack } from "./Player";
import { PlaylistsView } from "./PlaylistsView";
import { closePanel, navigate, useRoute } from "./router";
import { PaletteContext, usePalette } from "./usePalette";
import { useShortcuts } from "./useShortcuts";

function NavLink({ to, path, children }: { to: string; path: string; children: ReactNode }) {
  const follow = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a aria-current={path === to ? "page" : undefined} className="nav-link" href={isNative ? `#${to}` : to} onClick={follow}>
      {children}
    </a>
  );
}

function Shell() {
  const { path, panel } = useRoute();
  const auth = useAuthController();
  const [account, setAccount] = useState(false);
  const track = useCurrentTrack();
  const palette = usePalette(track?.coverUrl);
  useShortcuts(panel);

  // Sin pista no hay reproductor que mostrar: se quita el panel de la URL. Se reemplaza la entrada del historial
  // (no se retrocede): al recargar con ?panel=player, "atrás" sacaba al usuario de la app.
  useEffect(() => {
    if (panel === "player" && !track) navigate(path, true);
  }, [panel, track, path]);

  // Escape cierra el panel abierto (alternativa de teclado al botón atrás).
  useEffect(() => {
    if (!panel) return;
    // Con un diálogo o menú abierto, Escape es suyo: no debe cerrar también el panel de detrás.
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !document.querySelector("dialog[open]") && closePanel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const style = { "--accent": palette.accent, "--on-accent": palette.onAccent, "--glow": palette.glow } as CSSProperties;

  return (
    <PaletteContext.Provider value={palette}>
      <div className="shell" data-panel={panel ?? undefined} style={style}>
        {panel !== "player" && <Tint />}
        <nav aria-label="Secciones" className="nav">
          <span className="brand">Reproductor</span>
          <NavLink path={path} to="/app">
            <Library {...icon} />
            <span>Canciones</span>
          </NavLink>
          <NavLink path={path} to="/app/playlists">
            <ListMusic {...icon} />
            <span>Playlists</span>
          </NavLink>
          <button className="nav-link" onClick={() => setAccount(true)} type="button">
            <CircleUser {...icon} />
            <span>{auth.session ? "Cuenta" : "Entrar"}</span>
          </button>
        </nav>
        <main className="main" inert={panel === "player"}>
          {path === "/app/playlists" ? <PlaylistsView auth={auth} onAccount={() => setAccount(true)} /> : <LibraryView />}
        </main>
        {panel === "queue" && <QueuePanel />}
        <PlayerBar queueOpen={panel === "queue"} />
        {panel === "player" && <NowPlaying backdrop={<Backdrop />} />}
        {account && <AuthDialog auth={auth} onClose={() => setAccount(false)} />}
      </div>
    </PaletteContext.Provider>
  );
}

export default function App() {
  const { path } = useRoute();
  // La app nativa no tiene landing: siempre abre el reproductor.
  if (path === "/" && !isNative) return <Landing />;
  return <Shell />;
}
