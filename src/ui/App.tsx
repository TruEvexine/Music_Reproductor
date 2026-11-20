import { startTransition, useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { CircleHelp, CircleUser, Library, ListMusic, Settings } from "lucide-react";
import { isNative } from "../platform";
import { useBackground } from "../state/background";
import { usePaletteOf } from "../state/covers";
import { APP_NAME } from "../core/brand";
import { offerableOrphans } from "../core/outbox";
import { trackCoverSeed } from "../core/coverArt";
import { usePlayer } from "../state/player";
import { playlists, usePlaylists } from "../state/playlists";
import { useProfile } from "../state/profile";
import { setSyncUser } from "../sync/playlistSync";
import { useAuthController } from "../sync/useAuthController";
import { Backdrop, Tint } from "./Backdrop";
import { HelpView } from "./HelpView";
import { AdoptDialog, AuthDialog } from "./dialogs";
import { Landing } from "./Landing";
import { LEGAL_PATHS, LegalPage } from "./LegalPage";
import { LibraryView } from "./LibraryView";
import { ColorFade, icon } from "./parts";
import { NowPlaying, PlayerBar, QueuePanel, useCurrentTrack } from "./Player";
import { PlaylistsView } from "./PlaylistsView";
import { SettingsView } from "./SettingsView";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { closePanel, navigate, useRoute } from "./router";
import { Toaster } from "./toast";
import { TutorialHint, useEncounter } from "./Tutorial";
import { tokenMs, tokenValue, useKeptPanel } from "./motion";
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
  // Los paneles salen con animación (--exit) y después quedan montados y ocultos: reabrirlos es solo la transición. Se precargan en reposo
  // tras la primera pista (en una transición, que React trocea; primero el reproductor y en otro reposo la cola, para que ningún montaje sea
  // una tarea larga), así ni el primer toque paga el montaje. La cola en columna fija (escritorio, sin reproductor grande) no se anima, así que
  // se oculta al instante.
  const [preloaded, setPreloaded] = useState(0);
  const hasTrack = Boolean(track);
  useEffect(() => {
    if (!hasTrack || preloaded === 2) return;
    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 500));
    idle(() => {
      // Leídos aquí (sin estilo pendiente) y no en el primer toque o cierre, donde forzarían el recálculo de estilo.
      for (const token of ["--exit", "--fast", "--slow"]) tokenMs(token);
      tokenValue("--ease");
      startTransition(() => setPreloaded(preloaded + 1));
    });
  }, [hasTrack, preloaded]);
  const playerPanel = useKeptPanel(panel === "player", preloaded >= 1);
  const queuePanel = useKeptPanel(queue, preloaded >= 2, panel === "player" || !matchMedia("(min-width: 1000px)").matches);
  useShortcuts(queue);
  const playing = usePlayer((state) => state.isPlaying);
  const shortcutsOn = useBackground((state) => state.shortcuts);
  useEncounter("shortcuts", playing && shortcutsOn); // el aviso de atajos sale cuando suena la primera canción (solo con puntero)
  const userId = auth.session?.user.id ?? null;
  useEffect(() => setSyncUser(userId), [userId]);
  // Playlists creadas sin cuenta: se pregunta antes de subirlas. «Decidir luego» dura hasta recargar; «No subir» se guarda.
  const allPlaylists = usePlaylists((state) => state.all);
  const declined = usePlaylists((state) => state.declined);
  const [adoptLater, setAdoptLater] = useState(false);
  const orphans = userId && !adoptLater ? offerableOrphans(allPlaylists, declined) : [];
  const chooseAdopt = (choice: "upload" | "keep" | "later") => {
    const ids = orphans.map((playlist) => playlist.id);
    if (choice === "upload" && userId) void playlists.adoptOwnerless(userId, ids);
    else if (choice === "keep") void playlists.decline(ids);
    else setAdoptLater(true);
  };
  useEffect(() => {
    if (auth.linkProblem) setAccount(true); // el enlace del correo no sirvió: se explica en el diálogo de cuenta
  }, [auth.linkProblem]);

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
  const section = ["/app/playlists", "/app/ajustes", "/app/ayuda"].indexOf(path) + 1; // 0 = Biblioteca (y sus vistas)

  return (
    <PaletteContext.Provider value={palette}>
      <div className="shell" data-panel={panel ?? undefined} data-queue={queue || undefined} style={style}>
        {panel !== "player" && <Tint />}
        <Toaster /> {/* fijo en pantalla; va antes que las vistas para no ser el último role=status del DOM */}
        <nav aria-label="Secciones" className="nav" style={{ "--tabs": auth.isConfigured ? 5 : 4 } as CSSProperties}>
          <span className="brand">{APP_NAME}</span>
          {/* Móvil: la píldora teñida por la portada se desliza bajo el icono de la pestaña activa (la vista cambia en el mismo toque). */}
          <span aria-hidden="true" className="nav-indicator" style={{ transform: `translateX(${section * 100}%)` }}>
            <span className="nav-pill">
              <ColorFade className="nav-pill-fade" />
            </span>
          </span>
          <NavLink active={section === 0} to="/app">
            <Library {...icon} />
            <span>Biblioteca</span>
          </NavLink>
          <NavLink active={section === 1} to="/app/playlists">
            <ListMusic {...icon} />
            <span>Playlists</span>
          </NavLink>
          <NavLink active={section === 2} to="/app/ajustes">
            <Settings {...icon} />
            <span>Ajustes</span>
          </NavLink>
          <NavLink active={section === 3} to="/app/ayuda">
            <CircleHelp {...icon} />
            <span>Ayuda</span>
          </NavLink>
          {auth.isConfigured && (
            <button className="nav-link" onClick={() => setAccount(true)} type="button">
              {avatarUrl ? <img alt="" className="nav-avatar" height={24} src={avatarUrl} width={24} /> : <CircleUser {...icon} />}
              <span>{auth.session ? "Cuenta" : "Entrar"}</span>
            </button>
          )}
        </nav>
        <main className="main" inert={panel === "player"}>
          {path === "/app/playlists" ? <PlaylistsView auth={auth} onAccount={() => setAccount(true)} /> : path === "/app/ajustes" ? <SettingsView auth={auth} /> : path === "/app/ayuda" ? <HelpView /> : <LibraryView path={path} />}
        </main>
        <TutorialHint enabled={panel !== "player"} slot="dock" />
        {queuePanel.render && <QueuePanel closed={queuePanel.closed} closing={queuePanel.closing} />}
        <PlayerBar queueOpen={queue} />
        {playerPanel.render && <NowPlaying backdrop={<Backdrop active={!playerPanel.closed} />} closed={playerPanel.closed} closing={playerPanel.closing} queueOpen={queue} />}
        {account && (
          <AuthDialog
            auth={auth}
            onClose={() => {
              setAccount(false);
              auth.clearLinkProblem();
            }}
          />
        )}
        {!account && orphans.length > 0 && <AdoptDialog count={orphans.length} onChoose={chooseAdopt} />}
        <ShortcutsHelp />
      </div>
    </PaletteContext.Provider>
  );
}

export default function App() {
  const { path } = useRoute();
  const legalDoc = LEGAL_PATHS[path];
  if (legalDoc) return <LegalPage doc={legalDoc} />; // enlazadas solo desde Ajustes → Acerca de (aviso y términos)
  // La app nativa no tiene landing: siempre abre el reproductor.
  if (path === "/" && !isNative) return <Landing />;
  return <Shell />;
}
