import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent, ReactNode } from "react";
import { ChevronDown, ChevronLeft, FilePlus, FolderOpen, FolderSync, ListPlus, ListStart, Play, Plus, Search, TriangleAlert, X } from "lucide-react";
import { formatTime, isHiRes, qualityLabel, searchKey } from "../core/format";
import { groupTracks, matchesAll as matches, recentTracks, searchTextOf, sortGroups, sortTracks } from "../core/library";
import type { GroupBy, GroupSort, TrackGroup, TrackSort } from "../core/library";
import type { Track } from "../core/track";
import { isNative } from "../platform";
import { library, useLibrary } from "../state/library";
import { player, usePlayer } from "../state/player";
import { ActionSheet } from "./ActionSheet";
import { SwipeRow } from "./gestures";
import { LibrarySheet } from "./LibrarySheet";
import { queueAction } from "./toast";
import { Cover, icon, IconButton, iconSmall } from "./parts";
import { navigate } from "./router";
import { VirtualList } from "./VirtualList";

const ACCEPT = ".mp3,.wav,.flac,.m4a,.aac,.ogg,.oga,.opus,.webm,.lrc,audio/*";
const ROW = 64;

type Tab = "canciones" | "albumes" | "artistas" | "carpetas" | "generos" | "recientes";
const tabs: { id: Tab; label: string; group?: GroupBy }[] = [
  { id: "canciones", label: "Canciones" },
  { id: "albumes", label: "Álbumes", group: "album" },
  { id: "artistas", label: "Artistas", group: "artist" },
  { id: "carpetas", label: "Carpetas", group: "folder" },
  { id: "generos", label: "Géneros", group: "genre" },
  { id: "recientes", label: "Recientes" },
];
const trackSorts: { id: TrackSort; label: string }[] = [
  { id: "title", label: "Título" },
  { id: "artist", label: "Artista" },
  { id: "album", label: "Álbum" },
  { id: "added", label: "Añadidas hace poco" },
  { id: "duration", label: "Duración" },
];
const groupSorts: { id: GroupSort; label: string; only?: GroupBy }[] = [
  { id: "name", label: "Nombre" },
  { id: "artist", label: "Artista", only: "album" },
  { id: "year", label: "Año", only: "album" },
  { id: "count", label: "Nº de canciones" },
];

const tabPath = (tab: Tab) => (tab === "canciones" ? "/app" : `/app/${tab}`);
const plural = (count: number) => `${count} ${count === 1 ? "canción" : "canciones"}`;

// Texto de búsqueda por pista: se recalcula solo para las pistas que cambiaron (cada cambio crea un objeto nuevo).
const searchTexts = new WeakMap<Track, string>();
function searchText(track: Track) {
  let text = searchTexts.get(track);
  if (text === undefined) searchTexts.set(track, (text = searchTextOf(track)));
  return text;
}

function follow(to: string) {
  return (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    navigate(to);
  };
}

export function TrackRow({ track, queued, number, onPlay }: { track: Track; queued: boolean; number?: number; onPlay: () => void }) {
  const isCurrent = usePlayer((state) => state.queue.current === track.id);
  const isPlaying = usePlayer((state) => isCurrent && state.isPlaying);
  const blocked = track.unplayable || track.unsupported;
  const [sheet, setSheet] = useState(false);
  const playNext = { label: "Reproducir a continuación", icon: <ListStart {...iconSmall} />, run: () => queueAction("Sonará a continuación", () => player.playNext(track.id)) };
  const enqueue = { label: "Añadir a la cola", icon: <ListPlus {...iconSmall} />, run: () => queueAction("Añadida a la cola", () => player.enqueue(track.id)) };
  return (
    <>
    <SwipeRow
      className="track-row"
      current={isCurrent}
      left={queued ? undefined : { ...enqueue, label: "A la cola" }}
      onMenu={() => setSheet(true)}
      right={isCurrent ? undefined : { ...playNext, label: "Siguiente" }}
    >
      <button aria-label={`Reproducir ${track.title}, de ${track.artist}`} className="row-main" onClick={onPlay} type="button">
        {number !== undefined ? (
          <span aria-hidden="true" className="row-number time">
            {track.trackNumber ?? number}
          </span>
        ) : (
          <Cover className="row-cover" hash={track.coverHash} seed={track.album} />
        )}
        <span className="row-copy">
          <span className="title">
            {blocked && (
              <TriangleAlert {...iconSmall} aria-label={track.unsupported ? "Formato no compatible con este navegador" : "No se pudo reproducir"} className="warn" />
            )}
            {track.title}
          </span>
          <span className="subtitle">
            {isCurrent ? (isPlaying ? "Sonando · " : "En pausa · ") : ""}
            {track.artist}
          </span>
        </span>
        <span className="row-album subtitle">{track.album}</span>
        <span className="row-quality quality">
          {track.metadataStatus === "loading" ? "" : qualityLabel(track)}
          {isHiRes(track) && <span className="hires"> Hi-Res</span>}
        </span>
        <span className="row-time time">{formatTime(track.duration)}</span>
      </button>
      {/* Ya en la cola: no hay nada que ofrecer; el hueco mantiene la alineación. */}
      {queued ? (
        <span aria-hidden="true" className="row-spacer" />
      ) : (
        <IconButton label={`Añadir ${track.title} a la cola`} onClick={() => player.enqueue(track.id)}>
          <ListPlus {...iconSmall} />
        </IconButton>
      )}
    </SwipeRow>
    {/* Fuera de la fila: los toques dentro de la hoja no deben contar como gestos de la fila. */}
    {sheet && (
      <ActionSheet
        actions={[
          { label: "Reproducir", icon: <Play {...iconSmall} fill="currentColor" />, run: onPlay },
          ...(isCurrent ? [] : [playNext]),
          ...(queued ? [] : [enqueue]),
        ]}
        onClose={() => setSheet(false)}
        track={track}
      />
    )}
    </>
  );
}

function TrackList({ tracks, label, numbered = false }: { tracks: Track[]; label: string; numbered?: boolean }) {
  const order = usePlayer((state) => state.queue.order);
  const queued = useMemo(() => new Set(order), [order]);
  const ids = useMemo(() => tracks.map((track) => track.id), [tracks]);
  return (
    <VirtualList className="track-list" getKey={(track) => track.id} items={tracks} label={label} ordered={numbered} rowHeight={ROW}>
      {(track, index) => (
        <TrackRow number={numbered ? index + 1 : undefined} onPlay={() => player.playContext(ids, track.id)} queued={queued.has(track.id)} track={track} />
      )}
    </VirtualList>
  );
}

function GroupRows({ groups, tab, byId }: { groups: TrackGroup[]; tab: Tab; byId: Map<string, Track> }) {
  return (
    <VirtualList className="group-list" getKey={(group) => group.key} items={groups} label={tabs.find((item) => item.id === tab)!.label} rowHeight={ROW}>
      {(group) => {
        const first = byId.get(group.trackIds[0]);
        const to = `${tabPath(tab)}/${encodeURIComponent(group.key)}`;
        return (
          <a className="row-main group-row" href={isNative ? `#${to}` : to} onClick={follow(to)}>
            <Cover className="row-cover" hash={group.coverHash} seed={first?.album ?? group.label} />
            <span className="row-copy">
              <span className="title">{group.label}</span>
              <span className="subtitle">{group.subtitle}</span>
            </span>
          </a>
        );
      }}
    </VirtualList>
  );
}

/** Rejilla de álbumes: se virtualiza por filas; las columnas salen del ancho disponible. */
function AlbumGrid({ groups }: { groups: TrackGroup[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const gap = 16;
  const columns = Math.max(2, Math.floor((width + gap) / (width < 600 ? 140 + gap : 180 + gap)));
  const tile = width > 0 ? (width - gap * (columns - 1)) / columns : 160;
  const rows = useMemo(() => Array.from({ length: Math.ceil(groups.length / columns) }, (_, row) => groups.slice(row * columns, row * columns + columns)), [groups, columns]);
  return (
    <div className="album-grid-wrap" ref={ref}>
      {width > 0 && (
        <VirtualList className="album-grid" getKey={(row) => row[0].key} items={rows} label="Álbumes" rowHeight={Math.round(tile + 64)}>
          {(row) => (
            <div className="album-row" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {row.map((group) => {
                const to = `/app/albumes/${encodeURIComponent(group.key)}`;
                return (
                  <a className="album-tile" href={isNative ? `#${to}` : to} key={group.key} onClick={follow(to)}>
                    <Cover hash={group.coverHash} seed={group.label} size={tile > 120 ? "large" : "small"} />
                    <span className="title">{group.label}</span>
                    <span className="subtitle">{group.subtitle}</span>
                  </a>
                );
              })}
            </div>
          )}
        </VirtualList>
      )}
    </div>
  );
}

function GroupDetail({ group, tab, tracks }: { group: TrackGroup; tab: Tab; tracks: Track[] }) {
  const album = tab === "albumes";
  const total = tracks.reduce((sum, track) => sum + (track.duration ?? 0), 0);
  // La mejor calidad del grupo: Hi-Res si alguna pista lo es.
  const best = [...tracks].sort((a, b) => Number(isHiRes(b)) - Number(isHiRes(a)) || (b.bitsPerSample ?? 0) - (a.bitsPerSample ?? 0) || (b.sampleRate ?? 0) - (a.sampleRate ?? 0))[0];
  const facts = [album ? group.subtitle.split(" · ")[0] : undefined, album ? group.year : undefined, plural(tracks.length), total > 0 ? formatTime(total) : undefined].filter(Boolean);
  const ids = tracks.map((track) => track.id);
  return (
    <>
      <header className="group-header">
        <Cover className="group-cover" hash={group.coverHash} seed={tracks[0]?.album ?? group.label} size="large" />
        <div className="group-copy">
          <h2>{group.label}</h2>
          <p className="subtitle">{facts.join(" · ")}</p>
          {best && best.metadataStatus !== "loading" && (
            <p className="quality">
              {qualityLabel(best)}
              {isHiRes(best) && <span className="hires"> Hi-Res</span>}
            </p>
          )}
          <button className="button primary" disabled={ids.length === 0} onClick={() => player.playContext(ids, ids[0])} type="button">
            <Play {...iconSmall} fill="currentColor" />
            Reproducir
          </button>
        </div>
      </header>
      <TrackList label={`Canciones de ${group.label}`} numbered={album} tracks={tracks} />
    </>
  );
}

/** «Añadir»: una sola entrada con las dos vías, archivos sueltos o carpeta completa. Se cierra con Escape, fuera o al elegir. */
function AddSplit({ primary = false, onFiles, onFolder }: { primary?: boolean; onFiles: () => void; onFolder: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => !box.current?.contains(event.target as Node) && setOpen(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation(); // que no cierre también un panel
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <div className="split" ref={box}>
      <button aria-controls={open ? menuId : undefined} aria-expanded={open} className={`button${primary ? " primary" : ""}`} onClick={() => setOpen(!open)} ref={toggle} type="button">
        <Plus {...iconSmall} />
        Añadir
        <ChevronDown {...iconSmall} />
      </button>
      {open && (
        <div className="split-menu" id={menuId}>
          <button onClick={choose(onFolder)} type="button">
            <FolderOpen {...icon} />
            <span className="row-copy">
              <span className="title">Carpeta completa</span>
              <span className="subtitle">{library.keepsFolders ? "La recuerda y busca música nueva" : "Importa su contenido; este navegador no recuerda la carpeta"}</span>
            </span>
          </button>
          <button onClick={choose(onFiles)} type="button">
            <FilePlus {...icon} />
            <span className="row-copy">
              <span className="title">Archivos</span>
              <span className="subtitle">Una o varias canciones sueltas</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function ScanBar() {
  const scan = useLibrary((state) => state.scan);
  if (!scan) return null;
  const text = scan.walking
    ? `Buscando música en «${scan.name}»… ${plural(scan.found)}`
    : scan.toRead > 0
      ? `Leyendo etiquetas de «${scan.name}»: ${scan.read} de ${scan.toRead}`
      : `Comprobando «${scan.name}»…`;
  return (
    <div className="scan-bar" role="status">
      <span className="scan-text">{text}</span>
      {!scan.walking && scan.toRead > 0 && (
        <progress aria-label="Progreso del escaneo" max={scan.toRead} value={scan.read} />
      )}
      <button className="link" onClick={library.cancelScan} type="button">
        Cancelar
      </button>
    </div>
  );
}

function Reconnect() {
  const roots = useLibrary((state) => state.roots).filter((root) => root.access === "prompt" || root.access === "denied");
  if (roots.length === 0) return null;
  return (
    <div className="notices">
      {roots.map((root) => (
        <p className="notice" key={root.id}>
          <span>
            Para escuchar «{root.name}» el navegador necesita tu permiso de nuevo.
          </span>
          <button className="button primary" onClick={() => void library.reconnect(root.id)} type="button">
            <FolderSync {...iconSmall} />
            Reconectar
          </button>
        </p>
      ))}
    </div>
  );
}

export function LibraryView({ path }: { path: string }) {
  const tracks = useLibrary((state) => state.tracks);
  const ready = useLibrary((state) => state.ready);
  const notice = useLibrary((state) => state.notice);
  const message = usePlayer((state) => state.message);
  const [search, setSearch] = useState("");
  const [trackSort, setTrackSort] = useState<TrackSort>("title");
  const [groupSort, setGroupSort] = useState<GroupSort>("name");
  const [dragging, setDragging] = useState(false);
  const [sheet, setSheet] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const [, , slug, rawKey] = path.split("/");
  const tab: Tab = tabs.some((item) => item.id === slug) ? (slug as Tab) : "canciones";
  const groupBy = tabs.find((item) => item.id === tab)?.group;
  const groupKey = rawKey ? decodeURIComponent(rawKey) : undefined;

  const byId = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const key = searchKey(search);
  const matching = useMemo(() => (key ? tracks.filter((track) => matches(searchText(track), key)) : tracks), [tracks, key]);
  const groups = useMemo(() => {
    if (!groupBy) return [];
    const all = groupTracks(sortTracks(tracks, "album"), groupBy);
    return groupKey ? all : sortGroups(key ? all.filter((group) => matches(searchKey(`${group.label} ${group.subtitle}`), key)) : all, groupSort);
  }, [tracks, groupBy, groupKey, key, groupSort]);
  const group = groupKey ? groups.find((item) => item.key === groupKey) : undefined;
  const visible = useMemo(() => {
    if (group) {
      const inGroup = group.trackIds.map((id) => byId.get(id)!).filter((track) => !key || matches(searchText(track), key));
      return tab === "albumes" ? inGroup : sortTracks(inGroup, "artist");
    }
    return tab === "recientes" ? recentTracks(matching) : sortTracks(matching, trackSort);
  }, [group, byId, key, tab, matching, trackSort]);

  const addFiles = () => filesInput.current?.click();
  const addFolder = () => (library.keepsFolders ? void library.addFolder() : folderInput.current?.click());
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void library.drop(event.dataTransfer);
  };
  const dropProps = {
    onDragOver: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event: DragEvent) => event.currentTarget === event.target && setDragging(false),
    onDrop,
  };

  const inputs = (
    <>
      <input
        accept={ACCEPT}
        aria-label="Elegir archivos de música"
        className="visually-hidden"
        multiple
        onChange={(event) => {
          void library.addFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
        ref={filesInput}
        tabIndex={-1}
        type="file"
      />
      <input
        aria-label="Elegir una carpeta de música"
        className="visually-hidden"
        multiple
        onChange={(event) => {
          void library.addFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
        ref={(node) => {
          folderInput.current = node;
          node?.setAttribute("webkitdirectory", ""); // atributo no estándar: React no lo conoce
        }}
        tabIndex={-1}
        type="file"
      />
    </>
  );
  const dropHint = dragging && <div aria-hidden="true" className="drop-hint">Suelta para añadir a tu biblioteca</div>;
  const notices = (notice || message) && (
    <div className="notices" role="status">
      {message && (
        <p className="notice">
          {message}
          <button className="link" onClick={player.dismissMessage} type="button">
            Entendido
          </button>
        </p>
      )}
      {notice && (
        <p className="notice">
          {notice}
          <button className="link" onClick={library.dismissNotice} type="button">
            Entendido
          </button>
        </p>
      )}
    </div>
  );

  if (!ready) return <section aria-busy="true" className="view" />;

  if (tracks.length === 0) {
    return (
      <section className="view empty" {...dropProps}>
        {inputs}
        {dropHint}
        <h1>Tu música, en tu dispositivo</h1>
        <p>Elige la carpeta donde guardas tu música y empieza a escuchar. Nada se sube a ningún servidor.</p>
        <ScanBar />
        {notices}
        <AddSplit onFiles={addFiles} onFolder={addFolder} primary />
        <p className="hint">También puedes arrastrarla aquí. MP3, FLAC, WAV, M4A, OGG y Opus.</p>
      </section>
    );
  }

  let content: ReactNode;
  if (groupKey && !group) content = <p className="no-results">Este grupo ya no tiene canciones.</p>;
  else if (group) content = <GroupDetail group={group} tab={tab} tracks={visible} />;
  else if (groupBy && groups.length === 0) content = <p className="no-results">Nada coincide con «{search}».</p>;
  else if (tab === "albumes") content = <AlbumGrid groups={groups} />;
  else if (groupBy) content = <GroupRows byId={byId} groups={groups} tab={tab} />;
  else if (visible.length === 0)
    content = <p className="no-results">{search ? `Nada coincide con «${search}». Prueba con otro título, artista o álbum.` : "Aquí aparecerá lo que escuches y lo último que añadas."}</p>;
  else content = <TrackList label={tabs.find((item) => item.id === tab)!.label} tracks={visible} />;

  const units: Record<GroupBy, [string, string]> = { album: ["álbum", "álbumes"], artist: ["artista", "artistas"], folder: ["carpeta", "carpetas"], genre: ["género", "géneros"] };
  const count = groupBy && !group ? `${groups.length} ${units[groupBy][groups.length === 1 ? 0 : 1]} · ${plural(tracks.length)}` : plural(tracks.length);
  return (
    <section className="view library" {...dropProps}>
      {inputs}
      {dropHint}
      <header className="view-header">
        <div>
          <h1>Biblioteca</h1>
          <p className="subtitle">{count}</p>
        </div>
        <div className="header-actions">
          <AddSplit onFiles={addFiles} onFolder={addFolder} />
          <IconButton label="Carpetas y copia de seguridad" onClick={() => setSheet(true)}>
            <FolderSync {...icon} />
          </IconButton>
        </div>
      </header>
      <ScanBar />
      <Reconnect />
      <nav aria-label="Vistas de la biblioteca" className="tabs">
        {tabs.map((item) => (
          <a aria-current={item.id === tab ? "page" : undefined} className="tab" href={isNative ? `#${tabPath(item.id)}` : tabPath(item.id)} key={item.id} onClick={follow(tabPath(item.id))}>
            {item.label}
          </a>
        ))}
      </nav>
      {group && (
        <a className="back-link" href={isNative ? `#${tabPath(tab)}` : tabPath(tab)} onClick={follow(tabPath(tab))}>
          <ChevronLeft {...iconSmall} />
          {tabs.find((item) => item.id === tab)!.label}
        </a>
      )}
      <div className="toolbar">
        <label className="search">
          <Search {...iconSmall} />
          <input
            aria-label="Buscar en tu música"
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder={groupBy && !group ? `Buscar en ${tabs.find((item) => item.id === tab)!.label.toLowerCase()}` : "Buscar canciones, artistas o álbumes"}
            type="search"
            value={search}
          />
          {search && (
            <IconButton label="Borrar búsqueda" onClick={() => setSearch("")}>
              <X {...iconSmall} />
            </IconButton>
          )}
        </label>
        {!group && tab !== "recientes" && (
          <label className="sort">
            <span className="visually-hidden">Ordenar por</span>
            {groupBy ? (
              <select onChange={(event) => setGroupSort(event.currentTarget.value as GroupSort)} value={groupSort}>
                {groupSorts
                  .filter((sort) => !sort.only || sort.only === groupBy)
                  .map((sort) => (
                    <option key={sort.id} value={sort.id}>
                      {sort.label}
                    </option>
                  ))}
              </select>
            ) : (
              <select onChange={(event) => setTrackSort(event.currentTarget.value as TrackSort)} value={trackSort}>
                {trackSorts.map((sort) => (
                  <option key={sort.id} value={sort.id}>
                    {sort.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}
      </div>
      {notices}
      {content}
      {sheet && <LibrarySheet onClose={() => setSheet(false)} />}
    </section>
  );
}
