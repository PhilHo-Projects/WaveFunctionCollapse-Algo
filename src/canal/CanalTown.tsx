import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronDown,
  Eye,
  Focus,
  Hammer,
  Layers3,
  LoaderCircle,
  Moon,
  MousePointer2,
  Paintbrush,
  Pause,
  Play,
  Redo2,
  Shuffle,
  Sparkles,
  StepForward,
  Sun,
  Undo2,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import { applyEdit, buildProblem, findBridge, readDocument } from "./world";
import { createTownGrid } from "./grid";
import { createCatalog } from "./catalog";
import { recoveryProblem } from "./recovery";
import { solve } from "./solver";
import { replay } from "./replay";
import { PALETTE, paintBuilding } from "./appearance";
import { TownSound } from "./sound";
import { BUILD_SPEEDS, createRevealPlan } from "./reveal";
import type { RevealPlan, RevealProgress } from "./reveal";
import type {
  ModuleDefinition,
  Preset,
  Size,
  SolverEvent,
  TownDocument,
  TownState,
} from "./types";
import type { TownRequest } from "./worker";
import "./canal.css";

const CanalScene = lazy(() => import("./CanalScene"));
const STORAGE = "canal-town:v1";
const SPEED_STORAGE = "canal-town:build-interval";
const presets: Record<Preset, { name: string; caption: string }> = {
  village: {
    name: "Canal village",
    caption: "Quiet houses along a winding waterway.",
  },
  market: {
    name: "Market bend",
    caption: "Shopfronts, close neighbors, a busy waterfront.",
  },
  bridges: {
    name: "Bridge quarter",
    caption: "A small town stitched together by crossings.",
  },
};
const catalog = createCatalog();
const visibleEvents = (events: SolverEvent[]) =>
  events.filter((e) => e.type !== "constraint" || e.remaining > 1);
class SceneBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="scene-error">
        <Waves size={36} />
        <h2>The town couldn’t load</h2>
        <p>Check that the Blender kit is available, then reload.</p>
        <details>
          <summary>Details</summary>
          {this.state.error}
        </details>
        <button onClick={() => location.reload()}>Reload town</button>
        <Link to="/learn">Explore the 2D demos</Link>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function CanalTown() {
  const [town, setTown] = useState<TownState | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState("komorebi"),
    [preset, setPreset] = useState<Preset>("village"),
    [size, setSize] = useState<Size>("medium");
  const [night, setNight] = useState(false),
    [lens, setLens] = useState(false),
    [generatorOpen, setGeneratorOpen] = useState(false),
    [tool, setTool] = useState<"build" | "remove" | "bridge" | "paint">(
      "build",
    );
  const [paint, setPaint] = useState(1),
    [soundEnabled, setSoundEnabled] = useState(false);
  const sound = useRef(new TownSound()),
    soundOn = useRef(false);
  const [selected, setSelected] = useState<number | null>(null),
    [hovered, setHovered] = useState<number | null>(null),
    [bridgeStart, setBridgeStart] = useState<number | null>(null),
    [view, setView] = useState(0),
    [candidateId, setCandidateId] = useState(-1);
  const [events, setEvents] = useState<SolverEvent[]>([]),
    [cursor, setCursor] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(12),
    [study, setStudy] = useState(false);
  const [stats, setStats] = useState({ calls: 0, triangles: 0, fps: 0 }),
    [historyVersion, setHistoryVersion] = useState(0),
    [saveNotice, setSaveNotice] = useState("Saved on this device");
  const [pulse, setPulse] = useState<{
    cell: number;
    revision: number;
    failed?: boolean;
  } | null>(null);
  const [reducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [buildInterval, setBuildInterval] = useState(() => {
    try {
      const saved = localStorage.getItem(SPEED_STORAGE);
      const value = saved === null ? 100 : Number(saved);
      return BUILD_SPEEDS.some((speed) => speed.value === value) ? value : 100;
    } catch {
      return 100;
    }
  });
  const intervalRef = useRef(buildInterval),
    pendingReveal = useRef(false),
    presentationId = useRef(0);
  const [presentation, setPresentation] = useState<{
    id: number;
    plan: RevealPlan | null;
  }>({ id: 0, plan: null });
  const [revealProgress, setRevealProgress] = useState<RevealProgress>({
    active: false,
    shown: 0,
    total: 0,
  });
  const [finishPresentation, setFinishPresentation] = useState(-1);
  const finishTown = useCallback(() => {
    setFinishPresentation(presentationId.current);
    setRevealProgress((old) => ({ ...old, active: false }));
  }, []);
  const presentTown = useCallback(
    (state: TownState, sequence: boolean) => {
      const plan =
        sequence && intervalRef.current > 0 && !reducedMotion
          ? createRevealPlan(state.grid, state.document.intent)
          : null;
      const id = ++presentationId.current;
      setPresentation({ id, plan });
      setRevealProgress({
        active: !!plan,
        shown: 0,
        total: plan?.steps.length ?? 0,
      });
    },
    [reducedMotion],
  );
  const reportReveal = useCallback((id: number, progress: RevealProgress) => {
    if (id !== presentationId.current) return;
    setRevealProgress((old) =>
      old.active === progress.active &&
      old.shown === progress.shown &&
      old.total === progress.total
        ? old
        : progress,
    );
  }, []);
  const changeBuildSpeed = (value: number) => {
    intervalRef.current = value;
    setBuildInterval(value);
    try {
      localStorage.setItem(SPEED_STORAGE, String(value));
    } catch {
      /* Preference is optional. */
    }
    if (value === 0) finishTown();
  };
  const worker = useRef<Worker | null>(null),
    revision = useRef(0),
    townRef = useRef<TownState | null>(null),
    history = useRef<TownDocument[]>([]),
    future = useRef<TownDocument[]>([]),
    pendingEdit = useRef(false),
    fileInput = useRef<HTMLInputElement>(null);
  const send = useCallback(
    (
      request: Omit<TownRequest, "revision">,
      edit = false,
      sequence = false,
    ) => {
      if (!worker.current) return;
      pendingEdit.current = edit;
      pendingReveal.current = sequence;
      if (!edit) finishTown();
      setBusy(true);
      setError(null);
      setStudy(false);
      setPlaying(false);
      setEvents([]);
      setCursor(0);
      worker.current.postMessage({ ...request, revision: ++revision.current });
    },
    [finishTown],
  );
  useEffect(() => {
    let w: Worker;
    try {
      w = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      setBusy(false);
      setError("This browser could not start the town generator.");
      return;
    }
    worker.current = w;
    w.onmessage = ({ data }) => {
      if (data.revision !== revision.current) return;
      if (data.type === "progress") {
        setEvents((old) => [...old, ...visibleEvents(data.events)]);
        return;
      }
      setBusy(false);
      if (data.type === "error") {
        setError(data.message);
        if (data.cell !== undefined)
          setPulse({ cell: data.cell, revision: data.revision, failed: true });
        return;
      }
      if (data.type === "complete") {
        if (pendingEdit.current && soundOn.current && data.cell !== undefined) {
          const before =
            townRef.current?.document.intent.heights[data.cell] ?? 0;
          const after = data.state.document.intent.heights[data.cell];
          sound.current.play(after < before ? "remove" : "build", after);
        }
        if (pendingEdit.current && townRef.current)
          history.current.push(townRef.current.document);
        else history.current = [];
        history.current = history.current.slice(-60);
        future.current = [];
        setHistoryVersion((v) => v + 1);
        townRef.current = data.state;
        setTown(data.state);
        if (!pendingEdit.current)
          presentTown(data.state, pendingReveal.current);
        setEvents(visibleEvents(data.state.result.events));
        setSelected(null);
        setBridgeStart(null);
        if (data.cell !== undefined)
          setPulse({ cell: data.cell, revision: data.revision });
        else setPulse(null);
      }
    };
    w.onerror = () => {
      setBusy(false);
      setError(
        "The generator stopped. Your last valid town is preserved. Try generating again.",
      );
    };
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) {
        const doc = readDocument(saved),
          grid = createTownGrid(doc.intent.seed, doc.intent.size);
        const state: TownState = {
          grid,
          document: doc,
          result: {
            status: "success",
            assignments: doc.assignments,
            events: [],
            counts: doc.assignments.map(() => 1),
            backtracks: 0,
            operations: 0,
          },
        };
        townRef.current = state;
        setTown(state);
        setSeed(doc.intent.seed);
        setPreset(doc.intent.preset);
        setSize(doc.intent.size);
        setBusy(false);
      } else send({ seed: "komorebi", size: "medium", preset: "village" });
    } catch {
      setSaveNotice("Previous save could not load");
      send({ seed: "komorebi", size: "medium", preset: "village" });
    }
    return () => {
      w.terminate();
      worker.current = null;
    };
  }, [send, presentTown]);
  useEffect(() => () => sound.current.dispose(), []);
  useEffect(() => {
    if (!town) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(town.document));
      setSaveNotice("Saved on this device");
    } catch {
      setSaveNotice("Save unavailable · export a copy");
    }
  }, [town]);
  useEffect(() => {
    if (!playing || !lens) return;
    const timer = setInterval(
      () =>
        setCursor((old) => {
          if (old >= events.length - 1) {
            setPlaying(false);
            return old;
          }
          return old + 1;
        }),
      1000 / speed,
    );
    return () => clearInterval(timer);
  }, [playing, lens, speed, events.length]);
  const cancel = useCallback(() => {
    revision.current++;
    setBusy(false);
    setError(null);
    worker.current?.postMessage({
      revision: revision.current,
      seed: "cancel",
      size: "small",
      preset: "village",
      cancel: true,
    });
  }, []);
  const onPick = useCallback(
    (cell: number, remove: boolean) => {
      const current = townRef.current;
      if (!current || busy || revealProgress.active) return;
      if (lens) {
        setSelected(cell);
        setPlaying(false);
        return;
      }
      try {
        if (soundOn.current) void sound.current.unlock();
        if (tool === "paint" && !remove) {
          const intent = paintBuilding(
            current.grid,
            current.document.intent,
            cell,
            paint,
          );
          if (intent === current.document.intent) return;
          history.current = [...history.current, current.document].slice(-60);
          future.current = [];
          const state = {
            ...current,
            document: {
              ...current.document,
              intent,
              edit: current.document.edit + 1,
            },
          };
          townRef.current = state;
          setTown(state);
          setHistoryVersion((v) => v + 1);
          setEvents([]);
          setCursor(0);
          setError(null);
          if (soundOn.current) sound.current.play("paint");
          return;
        }
        if (tool === "bridge") {
          if (bridgeStart === null) {
            if (current.document.intent.ground[cell] !== "quay")
              throw new Error("Choose a stone quay as the first landing.");
            setBridgeStart(cell);
            return;
          }
          const bridge = findBridge(
            current.grid,
            current.document.intent,
            bridgeStart,
            cell,
          );
          setBridgeStart(null);
          if (!bridge)
            throw new Error(
              "Choose the opposite quay, across one to three water cells.",
            );
          send(
            {
              ...current.document.intent,
              intent: {
                ...current.document.intent,
                bridges: [...current.document.intent.bridges, bridge],
              },
              previous: current.document,
              cell: bridgeStart,
            },
            true,
          );
          return;
        }
        const intent = applyEdit(
          current.document.intent,
          cell,
          remove || tool === "remove" ? "remove" : "build",
        );
        if (intent === current.document.intent) return;
        send({ ...intent, intent, previous: current.document, cell }, true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not edit this cell.");
      }
    },
    [busy, lens, tool, bridgeStart, paint, send, revealProgress.active],
  );
  // Canvas reconciles in a separate React root. Gestures must see the current
  // toolbar selection even before that root has rendered its next frame.
  const pickHandler = useRef(onPick);
  useLayoutEffect(() => {
    pickHandler.current = onPick;
  }, [onPick]);
  const dispatchPick = useCallback((cell: number, remove: boolean) => {
    pickHandler.current(cell, remove);
  }, []);
  const undo = useCallback(
    (redo = false) => {
      if (busy || revealProgress.active) return;
      const current = townRef.current;
      if (!current) return;
      const source = redo ? future.current : history.current,
        destination = redo ? history.current : future.current,
        doc = source.pop();
      if (!doc) return;
      destination.push(current.document);
      const state: TownState = {
        ...current,
        document: doc,
        result: {
          status: "success",
          assignments: doc.assignments,
          events: [],
          counts: doc.assignments.map(() => 1),
          backtracks: 0,
          operations: 0,
        },
      };
      townRef.current = state;
      setTown(state);
      setEvents([]);
      setCursor(0);
      setSelected(null);
      setBridgeStart(null);
      setHistoryVersion((v) => v + 1);
    },
    [busy, revealProgress.active],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo(e.shiftKey);
      }
      if (e.key === "Escape") {
        setLens(false);
        setGeneratorOpen(false);
        setBridgeStart(null);
      }
      if (e.key.toLowerCase() === "i") setLens((v) => !v);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [undo]);
  const generate = (reroll = false) => {
    const value = reroll
      ? `river-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`
      : seed.trim() || "komorebi";
    setSeed(value);
    setGeneratorOpen(false);
    setLens(false);
    setHovered(null);
    setView((v) => v + 1);
    send({ seed: value, size, preset }, false, true);
  };
  const exportTown = () => {
    if (!town) return;
    const blob = new Blob([JSON.stringify(town.document, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `canal-town-${town.document.intent.seed.replace(/[^a-zA-Z0-9-]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importTown = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 3_000_000)
        throw new Error("Choose a town file smaller than 3 MB.");
      const doc = readDocument(await file.text());
      revision.current++;
      const state: TownState = {
        grid: createTownGrid(doc.intent.seed, doc.intent.size),
        document: doc,
        result: {
          status: "success",
          assignments: doc.assignments,
          events: [],
          counts: doc.assignments.map(() => 1),
          backtracks: 0,
          operations: 0,
        },
      };
      townRef.current = state;
      setTown(state);
      presentTown(state, false);
      setSeed(doc.intent.seed);
      setSize(doc.intent.size);
      setPreset(doc.intent.preset);
      history.current = [];
      future.current = [];
      setHistoryVersion((v) => v + 1);
      setBusy(false);
      setEvents([]);
      setSelected(null);
      setHovered(null);
      setBridgeStart(null);
      setPlaying(false);
      setStudy(false);
      setError(null);
      setView((v) => v + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load this town.",
      );
    }
  };
  const problem = useMemo(
    () =>
      town ? buildProblem(town.grid, town.document.intent, catalog) : null,
    [town],
  );
  const recovery = useMemo(() => recoveryProblem(), []),
    modules: ModuleDefinition[] = study ? recovery.modules : catalog,
    event = events[Math.min(cursor, events.length - 1)];
  const activeCell =
    (lens ? selected : null) ??
    hovered ??
    (lens && !study && town && event?.slot !== undefined && event.slot >= 0
      ? event.slot % town.grid.cells.length
      : lens && town
        ? town.document.intent.heights.findIndex((h) => h > 0)
        : null);
  const replayed = useMemo(
    () =>
      problem && lens && !study && events.length
        ? replay(town?.result.initialDomains ?? problem.domains, events, cursor)
        : null,
    [town, problem, lens, study, events, cursor],
  );
  const renderTown = useMemo(
    () =>
      town && replayed
        ? {
            ...town,
            document: { ...town.document, assignments: replayed.assignments },
          }
        : town,
    [town, replayed],
  );
  const slot = study
    ? (event?.slot ?? 0)
    : selected === null && hovered === null && event && event.slot >= 0
      ? event.slot
      : town && activeCell !== null
        ? (town.document.intent.heights[activeCell] > 0
            ? town.document.intent.heights[activeCell] + 1
            : town.document.intent.bridges.some((b) =>
                  b.cells.includes(activeCell),
                )
              ? 1
              : 0) *
            town.grid.cells.length +
          activeCell
        : 0;
  const candidates = study
    ? (event?.candidates ?? [0, 1, 2])
    : (replayed?.domains[slot] ?? problem?.domains[slot] ?? []);
  const inspected =
    modules[candidates.includes(candidateId) ? candidateId : candidates[0]];
  const ghost =
    inspected && ["roof", "room", "bridge"].includes(inspected.category)
      ? inspected.mesh
      : undefined;
  const crossingPreview = useMemo(
    () =>
      town && tool === "bridge" && bridgeStart !== null && hovered !== null
        ? findBridge(town.grid, town.document.intent, bridgeStart, hovered)
        : null,
    [town, tool, bridgeStart, hovered],
  );
  const runStudy = () => {
    const result = solve(recovery);
    setStudy(true);
    setEvents(result.events);
    setCursor(0);
    setPlaying(true);
    setSelected(null);
  };
  const inspectTown = () => {
    setStudy(false);
    setEvents(visibleEvents(town?.result.events ?? []));
    setCursor(0);
    setPlaying(false);
  };
  const report = useCallback((value: typeof stats) => setStats(value), []);
  const buildings =
    town?.document.intent.heights.filter((h) => h > 0).length ?? 0;
  return (
    <div
      className={`canal-app ${night ? "is-night" : ""} ${lens ? "lens-open" : ""}`}
    >
      <header className="canal-topbar">
        <Link className="canal-brand" to="/" aria-label="Canal Town home">
          <span className="brand-mark">
            <Waves size={22} />
          </span>
          <span>
            <strong>Canal Town</strong>
            <small>A little world, one choice at a time.</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/learn">
            <BookOpen size={15} />
            <span>Learn WFC</span>
          </Link>
          <button
            className={lens ? "is-active" : ""}
            aria-label="WFC lens"
            onClick={() => {
              setLens((v) => !v);
              setGeneratorOpen(false);
            }}
            aria-pressed={lens}
          >
            <Eye size={16} />
            <span>WFC lens</span>
            <kbd>I</kbd>
          </button>
          <span className="topbar-divider" />
          <button
            className="icon-button sound-toggle"
            aria-label={
              soundEnabled ? "Mute placement sounds" : "Enable placement sounds"
            }
            aria-pressed={soundEnabled}
            onClick={async () => {
              const enabled = !soundEnabled;
              if (enabled) {
                try {
                  await sound.current.unlock();
                } catch {
                  setError("Placement sounds are unavailable in this browser.");
                  return;
                }
              }
              soundOn.current = enabled;
              setSoundEnabled(enabled);
              if (enabled) sound.current.play("paint");
            }}
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button
            className="icon-button"
            aria-label={
              night ? "Switch to daylight" : "Switch to lantern evening"
            }
            onClick={() => setNight((v) => !v)}
          >
            {night ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="generate-button"
            aria-label="Make a town"
            onClick={() => setGeneratorOpen((v) => !v)}
            aria-expanded={generatorOpen}
          >
            <Sparkles size={15} />
            <span>Make a town</span>
            <ChevronDown size={13} />
          </button>
        </nav>
      </header>
      <main className="canal-stage">
        {renderTown ? (
          <SceneBoundary>
            <Suspense
              fallback={
                <div className="town-loading">
                  <LoaderCircle className="spin" />
                  <span>Opening the Blender kit…</span>
                </div>
              }
            >
              <CanalScene
                state={renderTown}
                night={night}
                lens={lens && !study}
                counts={replayed?.counts}
                selected={activeCell}
                bridgeStart={bridgeStart}
                crossingPreview={crossingPreview}
                pulse={pulse}
                event={!study ? event : undefined}
                ghostMesh={ghost}
                ghostRotation={inspected?.rotation ?? 0}
                ghostLayer={
                  town ? Math.floor(slot / town.grid.cells.length) : 1
                }
                tool={tool}
                onPick={dispatchPick}
                onHover={setHovered}
                onStats={report}
                view={view}
                reducedMotion={reducedMotion}
                presentation={presentation}
                buildInterval={buildInterval}
                finishPresentation={finishPresentation}
                revealing={revealProgress.active}
                onRevealProgress={reportReveal}
              />
            </Suspense>
          </SceneBoundary>
        ) : (
          <div className="town-loading">
            <Waves size={34} />
            <span>Finding a place by the water…</span>
          </div>
        )}
        <div className="scene-caption" aria-hidden="true">
          <span className="scene-eyebrow">A small place to get lost</span>
          <h1>
            {night
              ? "When the lanterns come on."
              : "Somewhere along the water."}
          </h1>
          <p>
            {night
              ? "The same little town, in a different light."
              : "Click to build. Follow your curiosity."}
          </p>
        </div>
        <div className="scene-coordinate" aria-hidden="true">
          <span>水辺の町</span>
          <span>{town?.document.intent.seed ?? seed}</span>
          <span className="coordinate-rule" />
        </div>
        {busy && (
          <div className="solve-status" role="status">
            <LoaderCircle className="spin" size={15} />
            <span>{town ? "Finding the joins…" : "Shaping the town…"}</span>
            {town && <button onClick={cancel}>Cancel</button>}
          </div>
        )}
        <button
          className="reset-camera icon-button"
          aria-label="Reset camera"
          onClick={() => setView((v) => v + 1)}
        >
          <Focus size={19} />
        </button>
        {generatorOpen && (
          <section
            className="generator-panel floating-panel"
            aria-label="Town generation"
          >
            <div className="panel-title">
              <span>Make room for possibility</span>
              <button
                aria-label="Close generation controls"
                onClick={() => setGeneratorOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <h2>A different bend in the river.</h2>
            <p>Choose a character. The town will find its own details.</p>
            <div className="preset-list">
              {(Object.keys(presets) as Preset[]).map((id) => (
                <button
                  key={id}
                  className={preset === id ? "selected" : ""}
                  onClick={() => setPreset(id)}
                >
                  <span className={`preset-drawing preset-${id}`}>
                    <Waves size={30} />
                  </span>
                  <span>
                    <strong>{presets[id].name}</strong>
                    <small>{presets[id].caption}</small>
                  </span>
                  {preset === id && <Check size={16} />}
                </button>
              ))}
            </div>
            <label className="field-label">
              Town size
              <select
                aria-label="Town size"
                value={size}
                onChange={(e) => setSize(e.target.value as Size)}
              >
                <option value="small">Small · a quiet corner</option>
                <option value="medium">Medium · a neighborhood</option>
                <option value="large">Large · room to wander</option>
              </select>
            </label>
            <label className="field-label">
              Seed
              <input
                aria-label="Seed"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                maxLength={100}
                spellCheck={false}
              />
            </label>
            <label className="field-label">
              Build speed
              <select
                aria-label="Build speed"
                value={buildInterval}
                onChange={(e) => changeBuildSpeed(Number(e.target.value))}
              >
                {BUILD_SPEEDS.map((speed) => (
                  <option key={speed.value} value={speed.value}>
                    {speed.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="build-speed-note">
              {reducedMotion
                ? "Reduced motion is on. Your town will appear instantly."
                : "Watch each plot grow into place, or choose Instant."}
            </p>
            <div className="generation-actions">
              <button
                className="primary-action"
                onClick={() => generate()}
                disabled={busy}
              >
                <Sparkles size={15} />
                Generate town
              </button>
              <button
                aria-label="Generate a random town"
                onClick={() => generate(true)}
                disabled={busy}
              >
                <Shuffle size={17} />
              </button>
            </div>
          </section>
        )}
        {lens && (
          <aside
            className="lens-panel floating-panel"
            aria-label="WFC inspector"
          >
            <div className="panel-title">
              <span>
                <Eye size={14} />
                Inside the choices
              </span>
              <button
                aria-label="Close WFC lens"
                onClick={() => {
                  setLens(false);
                  setPlaying(false);
                }}
              >
                <X size={16} />
              </button>
            </div>
            <h2>
              {study ? "A way out of a dead end." : "Watch the town think."}
            </h2>
            <p>
              {study
                ? "Three slots, two tempting choices, one hidden conflict. This is the real solver finding its way back."
                : "The planner sets the places. WFC finds the pieces that can live together."}
            </p>
            <div className="lens-tabs">
              <button
                className={!study ? "selected" : ""}
                onClick={inspectTown}
              >
                Town solve
              </button>
              <button className={study ? "selected" : ""} onClick={runStudy}>
                Recovery study
              </button>
            </div>
            {study && (
              <div className="recovery-nodes">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={event?.slot === i ? "current" : ""}>
                    {i + 1}
                  </span>
                ))}
              </div>
            )}
            <div className={`event-card event-${event?.type ?? "ready"}`}>
              <span className="event-kind">
                {event?.type ?? "Ready to inspect"}
                {event?.slot !== undefined && event.slot >= 0 && (
                  <small>Slot {event.slot}</small>
                )}
              </span>
              <p>
                {event?.reason ??
                  "Generate a town to record its decisions, or open the recovery study."}
              </p>
            </div>
            <div className="playback">
              <button
                aria-label={
                  playing ? "Pause solver replay" : "Play solver replay"
                }
                onClick={() => {
                  if (cursor >= events.length - 1) setCursor(0);
                  setPlaying((v) => !v);
                }}
                disabled={!events.length}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button
                aria-label="Step solver replay"
                disabled={!events.length}
                onClick={() => {
                  setPlaying(false);
                  setCursor((v) => Math.min(v + 1, events.length - 1));
                }}
              >
                <StepForward size={18} />
              </button>
              <input
                type="range"
                aria-label="Solver replay position"
                min="0"
                max={Math.max(0, events.length - 1)}
                value={Math.min(cursor, Math.max(0, events.length - 1))}
                onChange={(e) => {
                  setPlaying(false);
                  setCursor(Number(e.target.value));
                }}
              />
              <span>
                {events.length ? cursor + 1 : 0}/{events.length}
              </span>
            </div>
            <label className="speed-control">
              Replay speed
              <input
                aria-label="Replay speed"
                type="range"
                min="1"
                max="50"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <span>{speed}/s</span>
            </label>
            <div className="candidate-header">
              <span>Possible pieces</span>
              <strong>{candidates.length}</strong>
            </div>
            <div className="candidate-list">
              {candidates.slice(0, 8).map((id) => (
                <button
                  key={id}
                  className={inspected === modules[id] ? "selected" : ""}
                  onClick={() => setCandidateId(id)}
                  title={modules[id]?.id}
                >
                  <Layers3 size={14} />
                  {modules[id]?.family}
                </button>
              ))}
              {candidates.length > 8 && (
                <small>+{candidates.length - 8} more</small>
              )}
              {!candidates.length && (
                <span>No candidate remains at this step.</span>
              )}
            </div>
            {inspected && (
              <div className="connector-inspector">
                <div>
                  <strong>{inspected.family}</strong>
                  <span>
                    {inspected.rotation * 90}° · slot {slot}
                  </span>
                </div>
                <code>{inspected.id}</code>
                <dl>
                  {inspected.sockets.map((socket, face) => (
                    <div key={face}>
                      <dt>
                        {
                          [
                            "edge 0",
                            "edge 1",
                            "edge 2",
                            "edge 3",
                            "below",
                            "above",
                          ][face]
                        }
                      </dt>
                      <dd>{socket}</dd>
                    </div>
                  ))}
                </dl>
                <small>
                  Event entropy {event?.entropy.toFixed(3) ?? "—"} ·{" "}
                  {event?.type === "constraint"
                    ? "Planner constraint"
                    : "Architectural WFC"}
                </small>
              </div>
            )}
            <div className="lens-metrics">
              <span>
                {stats.fps}
                <small>FPS</small>
              </span>
              <span>
                {stats.calls}
                <small>draw calls</small>
              </span>
              <span>
                {
                  events
                    .slice(0, cursor + 1)
                    .filter((e) => e.type === "backtrack").length
                }
                <small>backtracks</small>
              </span>
            </div>
            <small className="lens-note">
              Recorded solver events · step through or hover a place to inspect
              it.
            </small>
          </aside>
        )}
        {error && (
          <div className="town-message" role="alert">
            <span>{error}</span>
            <button aria-label="Dismiss message" onClick={() => setError(null)}>
              <X size={15} />
            </button>
          </div>
        )}
        <div className="construction-area">
          {revealProgress.active && !lens && (
            <section
              className="build-reveal"
              aria-label="Town construction playback"
            >
              <div className="build-reveal-heading">
                <span>
                  <Sparkles size={14} />
                  Growing your town
                </span>
                <span>
                  {revealProgress.shown} / {revealProgress.total} plots
                </span>
              </div>
              <progress
                aria-label="Town construction progress"
                value={revealProgress.shown}
                max={revealProgress.total}
              />
              <div className="build-reveal-controls">
                <select
                  aria-label="Playback speed"
                  value={buildInterval}
                  onChange={(e) => changeBuildSpeed(Number(e.target.value))}
                >
                  {BUILD_SPEEDS.map((speed) => (
                    <option key={speed.value} value={speed.value}>
                      {speed.label}
                    </option>
                  ))}
                </select>
                <button onClick={finishTown}>
                  Finish now
                  <StepForward size={14} />
                </button>
              </div>
            </section>
          )}
          {!lens && !revealProgress.active && tool === "paint" && (
            <div
              className="paint-palette"
              role="toolbar"
              aria-label="Building colours"
            >
              <span>{PALETTE[paint].name}</span>
              <div>
                {PALETTE.map((colour, index) => (
                  <button
                    key={colour.name}
                    aria-label={`Paint with ${colour.name}`}
                    aria-pressed={paint === index}
                    title={colour.name}
                    className={paint === index ? "selected" : ""}
                    style={{ backgroundColor: colour.colour }}
                    onClick={() => setPaint(index)}
                  >
                    {paint === index && <Check size={15} />}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="interaction-hint">
            {revealProgress.active && !lens ? (
              <>
                <MousePointer2 size={13} />
                Drag to orbit while the town takes shape.
              </>
            ) : lens ? (
              <>
                <Eye size={13} />
                Inspect a place, or step through a decision.
              </>
            ) : tool === "bridge" ? (
              <>
                <Waves size={13} />
                {bridgeStart === null
                  ? "Choose the first quay, then the opposite bank."
                  : "Choose the opposite quay to complete the crossing."}
              </>
            ) : tool === "paint" ? (
              <>
                <Paintbrush size={13} />
                Click a building to give it a little colour.
              </>
            ) : (
              <>
                <MousePointer2 size={13} />
                <span>
                  Click to {tool === "remove" ? "remove" : "build"}
                  <i />
                  Drag to orbit
                  <i />
                  Scroll to wander closer
                </span>
              </>
            )}
          </div>
          <div
            className="construction-dock"
            role="toolbar"
            aria-label="Construction tools"
          >
            <div className="tool-group">
              <button
                aria-label="Build"
                aria-pressed={tool === "build" && !lens}
                className={tool === "build" && !lens ? "selected" : ""}
                onClick={() => {
                  setTool("build");
                  setLens(false);
                  setBridgeStart(null);
                }}
              >
                <Hammer size={19} />
                <span>Build</span>
                <kbd>+</kbd>
              </button>
              <button
                aria-label="Remove"
                aria-pressed={tool === "remove" && !lens}
                className={tool === "remove" && !lens ? "selected" : ""}
                onClick={() => {
                  setTool("remove");
                  setLens(false);
                  setBridgeStart(null);
                }}
              >
                <Layers3 size={19} />
                <span>Remove</span>
              </button>
              <button
                aria-label="Paint"
                aria-pressed={tool === "paint" && !lens}
                className={tool === "paint" && !lens ? "selected" : ""}
                onClick={() => {
                  setTool("paint");
                  setLens(false);
                  setBridgeStart(null);
                }}
              >
                <Paintbrush size={19} />
                <span>Paint</span>
              </button>
              <button
                aria-label="Bridge"
                aria-pressed={tool === "bridge" && !lens}
                className={tool === "bridge" && !lens ? "selected" : ""}
                onClick={() => {
                  setTool("bridge");
                  setLens(false);
                  setBridgeStart(null);
                }}
              >
                <Waves size={19} />
                <span>Bridge</span>
              </button>
            </div>
            <span className="dock-divider" />
            <div className="history-group" data-history={historyVersion}>
              <button
                aria-label="Undo"
                disabled={
                  !history.current.length || busy || revealProgress.active
                }
                onClick={() => undo()}
              >
                <Undo2 size={18} />
              </button>
              <button
                aria-label="Redo"
                disabled={
                  !future.current.length || busy || revealProgress.active
                }
                onClick={() => undo(true)}
              >
                <Redo2 size={18} />
              </button>
            </div>
          </div>
        </div>
      </main>
      <footer className="canal-statusbar">
        <span className="save-state">
          <span className="status-dot" />
          {busy ? "Resolving architecture" : saveNotice}
        </span>
        <span className="town-counts" data-testid="town-counts">
          {buildings} occupied plots<span>·</span>
          {town?.document.intent.bridges.length ?? 0} bridges<span>·</span>
          {town?.grid.cells.length ?? 0} cells
        </span>
        <div>
          <button onClick={exportTown} disabled={!town || busy}>
            <ArrowDownToLine size={14} />
            Export
          </button>
          <button onClick={() => fileInput.current?.click()} disabled={busy}>
            <ArrowUpFromLine size={14} />
            Open
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            onChange={importTown}
            hidden
          />
        </div>
      </footer>
    </div>
  );
}
