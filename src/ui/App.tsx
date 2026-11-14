import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { CircleHelp, CircleUser, Library, ListMusic, Settings } from "lucide-react";
import { isNative } from "../platform";
import { useBackground } from "../state/background";
import { usePaletteOf } from "../state/covers";
import { trackCoverSeed } from "../core/coverArt";
import { usePlayer } from "../state/player";
import { useProfile } from "../state/profile";
import { setSyncUser } from "../sync/playlistSync";
import { useAuthController } from "../sync/useAuthController";
import { Backdrop, Tint } from "./Backdrop";
import { HelpView } from "./HelpView";
import { AuthDialog } from "./dialogs";
import { Landing } from "./Landing";
import { LEGAL_PATHS, LegalPage } from "./LegalPage";
import { LibraryView } from "./LibraryView";
import { icon } from "./parts";
import { NowPlaying, PlayerBar, QueuePanel, useCurrentTrack } from "./Player";
import { PlaylistsView } from "./PlaylistsView";
import { SettingsView } from "./SettingsView";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { closePanel, navigate, useRoute } from "./router";
import { Toaster } from "./toast";
import { TutorialHint, useEncounter } from "./Tutorial";
import { usePresence } from "./motion";
import { PaletteContext } from "./usePalette";
import { useShortcuts } from "./useShortcuts";

function NavLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  const follow = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a aria-current={active ? "page" : undefined} className="nav-link" href={isNative ? `#${to}` : to} onClick={follow}>
      {children}
    </a>
  );
}

function Shell() {
  const { path, panel, queue } = useRoute();
  const auth = useAuthController();
  const avatarUrl = useProfile((state) => state.avatarUrl);
  const [account, setAccount] = useState(false);
  const track = useCurrentTrack();
  const palette = usePaletteOf(track?.coverHash, track && trackCoverSeed(track));
  // Los paneles salen con animación (--exit): se mantienen montados mientras salen. La cola en columna fija (escritorio, sin
  // reproductor grande) no se anima, así que se desmonta al instante.
  const playerPanel = usePresence(panel === "player");
  const queuePanel = usePresence(queue, panel === "player" || !matchMedia("(min-width: 1000px)").matches);
  useShortcuts(queue);
  const playing = usePlayer((state) => state.isPlaying);
  const shortcutsOn = useBackground((state) => state.shortcuts);
  useEncounter("shortcuts", playing && shortcutsOn); // el aviso de atajos sale cuando suena la primera canción (solo con puntero)
  const userId = auth.session?.user.id ?? null;
  useEffect(() => setSyncUser(userId), [userId]);

  // Sin pista no hay reproductor que mostrar: se quita el panel de la URL. Se reemplaza la entrada del historial
  // (no se retrocede): al recargar con ?panel=player, "atrás" sacaba al usuario de la app.
  useEffect(() => {
    if (panel === "player" && !track) navigate(path, true);
  }, [panel, track, path]);

  // Escape cierra el panel abierto (alternativa de teclado al botón atrás).
  useEffect(() => {
    if (!panel) return;
    // Con un diálogo o menú abierto, Escape es suyo: no debe cerrar también el panel de detrás (uno que ya está saliendo no cuenta).
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !document.querySelector("dialog[open]:not([data-closing])") && closePanel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const style = { "--accent-in": palette.accent, "--on-accent": palette.onAccent, "--glow-in": palette.glow } as CSSProperties;

  return (
    <PaletteContext.Provider value={palette}>
      <div className="shell" data-panel={panel ?? undefined} data-queue={queue || undefined} style={style}>
        {panel !== "player" && <Tint />}
        <Toaster /> {/* fijo en pantalla; va antes que las vistas para no ser el último role=status del DOM */}
        <nav aria-label="Secciones" className="nav">
          <span className="brand">Reproductor</span>
          <NavLink active={path !== "/app/playlists" && path !== "/app/ajustes" && path !== "/app/ayuda"} to="/app">
            <Library {...icon} />
            <span>Biblioteca</span>
          </NavLink>
          <NavLink active={path === "/app/playlists"} to="/app/playlists">
            <ListMusic {...icon} />
            <span>Playlists</span>
          </NavLink>
          <NavLink active={path === "/app/ajustes"} to="/app/ajustes">
            <Settings {...icon} />
            <span>Ajustes</span>
          </NavLink>
          <NavLink active={path === "/app/ayuda"} to="/app/ayuda">
            <CircleHelp {...icon} />
            <span>Ayuda</span>
          </NavLink>
          <button className="nav-link" onClick={() => setAccount(true)} type="button">
            {avatarUrl ? <img alt="" className="nav-avatar" height={24} src={avatarUrl} width={24} /> : <CircleUser {...icon} />}
            <span>{auth.session ? "Cuenta" : "Entrar"}</span>
          </button>
        </nav>
        <main className="main" inert={panel === "player"}>
          {path === "/app/playlists" ? <PlaylistsView auth={auth} onAccount={() => setAccount(true)} /> : path === "/app/ajustes" ? <SettingsView auth={auth} /> : path === "/app/ayuda" ? <HelpView /> : <LibraryView path={path} />}
        </main>
        <TutorialHint enabled={panel !== "player"} slot="dock" />
        {queuePanel.mounted && <QueuePanel closing={queuePanel.closing} />}
        <PlayerBar queueOpen={queue} />
        {playerPanel.mounted && <NowPlaying backdrop={<Backdrop />} closing={playerPanel.closing} queueOpen={queue} />}
        {account && <AuthDialog auth={auth} onClose={() => setAccount(false)} />}
        <ShortcutsHelp />
      </div>
    </PaletteContext.Provider>
  );
}

export default function App() {
  const { path } = useRoute();
  const legalDoc = LEGAL_PATHS[path];
  if (legalDoc) return <LegalPage doc={legalDoc} />; // sin enlace desde la navegación pública: se llega por su dirección
  // La app nativa no tiene landing: siempre abre el reproductor.
  if (path === "/" && !isNative) return <Landing />;
  return <Shell />;
}
