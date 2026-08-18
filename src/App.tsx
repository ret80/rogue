import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Sfx } from "./game/audio";
import { Engine } from "./game/engine";
import { TREE_DEFS, loadMeta, saveMeta } from "./game/save";
import type { Alloc, ClassId, EngineEvent, HudData, MetaState, RunSummary, TreeKey } from "./game/types";
import { Hud } from "./ui/hud";
import { AllocateScreen, EndScreen, MenuScreen, SelectScreen, TreeScreen } from "./ui/screens";

type Screen = "menu" | "select" | "allocate" | "game" | "tree" | "end";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [meta, setMeta] = useState<MetaState>(() => loadMeta());
  const [cls, setCls] = useState<ClassId>("knight");
  const [alloc, setAlloc] = useState<Alloc>({ str: 2, dex: 2, int: 1 });
  const [runId, setRunId] = useState(0);
  const [summary, setSummary] = useState<RunSummary | null>(null);

  const metaRef = useRef(meta);
  metaRef.current = meta;

  const sfxRef = useRef<Sfx | null>(null);
  if (!sfxRef.current) sfxRef.current = new Sfx();
  const sfx = sfxRef.current;
  sfx.muted = meta.muted;

  // ловим любые неперехваченные ошибки, чтобы вместо чёрного экрана был диагноз
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  useEffect(() => {
    const onErr = (e: ErrorEvent) => setGlobalErr(`${e.message}\n(${e.filename}:${e.lineno}:${e.colno})`);
    const onRej = (e: PromiseRejectionEvent) => setGlobalErr(String(e.reason));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  const updateMeta = useCallback((fn: (m: MetaState) => MetaState) => {
    setMeta((prev) => {
      const next = fn(prev);
      saveMeta(next);
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    updateMeta((m) => {
      sfx.setMuted(!m.muted);
      return { ...m, muted: !m.muted };
    });
  }, [sfx, updateMeta]);

  const applyRunResult = useCallback((s: RunSummary) => {
    const prev = metaRef.current;
    const wasThief = prev.chests >= 10;
    const wasMage = prev.bossesKilled.includes(5);
    const next: MetaState = {
      ...prev,
      souls: prev.souls + s.soulsBanked,
      chests: prev.chests + s.chests,
      kills: prev.kills + s.kills,
      runs: prev.runs + 1,
      bestFloor: Math.max(prev.bestFloor, s.floor),
      bossesKilled: Array.from(new Set([...prev.bossesKilled, ...s.bossFloors])),
    };
    const unlocks: string[] = [];
    if (!wasThief && next.chests >= 10) unlocks.push("ОТКРЫТ КЛАСС: ВОР");
    if (!wasMage && next.bossesKilled.includes(5)) unlocks.push("ОТКРЫТ КЛАСС: МАГ");
    s.newUnlocks = unlocks;
    saveMeta(next);
    setMeta(next);
    setSummary(s);
    setScreen("end");
  }, []);

  const quitRun = useCallback((soulsCarried: number) => {
    updateMeta((m) => ({ ...m, souls: m.souls + soulsCarried, runs: m.runs + 1 }));
    setScreen("menu");
  }, [updateMeta]);

  const buyTree = useCallback((key: TreeKey) => {
    const def = TREE_DEFS.find((d) => d.key === key);
    const m = metaRef.current;
    if (!def) return;
    const lvl = m.tree[key];
    if (lvl >= def.max) return;
    const cost = def.cost(lvl);
    if (m.souls < cost) {
      sfx.error();
      return;
    }
    sfx.buy();
    updateMeta((mm) => ({ ...mm, souls: mm.souls - cost, tree: { ...mm.tree, [key]: mm.tree[key] + 1 } }));
  }, [sfx, updateMeta]);

  return (
    <div className="fixed inset-0 bg-abyss overflow-hidden font-body">
      {screen === "menu" && (
        <MenuScreen
          meta={meta}
          onPlay={() => { sfx.unlock(); sfx.click(); setScreen("select"); }}
          onTree={() => { sfx.unlock(); sfx.click(); setScreen("tree"); }}
        />
      )}
      {screen === "select" && (
        <SelectScreen
          meta={meta}
          onBack={() => { sfx.click(); setScreen("menu"); }}
          onPick={(c) => { sfx.click(); setCls(c); setScreen("allocate"); }}
        />
      )}
      {screen === "allocate" && (
        <AllocateScreen
          cls={cls}
          onBack={() => { sfx.click(); setScreen("select"); }}
          onStart={(a) => { sfx.click(); setAlloc(a); setRunId((r) => r + 1); setScreen("game"); }}
        />
      )}
      {screen === "tree" && (
        <TreeScreen meta={meta} onBuy={buyTree} onBack={() => { sfx.click(); setScreen("menu"); }} />
      )}
      {screen === "game" && (
        <CrashBoundary>
          <GameView
            key={runId}
            cls={cls}
            alloc={alloc}
            meta={meta}
            sfx={sfx}
            onEvent={(e) => applyRunResult(e.summary)}
            onQuit={quitRun}
            muted={meta.muted}
            onToggleMute={toggleMute}
          />
        </CrashBoundary>
      )}
      {screen === "end" && summary && (
        <EndScreen
          summary={summary}
          onRetry={() => { sfx.click(); setScreen("select"); }}
          onMenu={() => { sfx.click(); setScreen("menu"); }}
        />
      )}
      {globalErr && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[60] max-w-[92vw]">
          <div className="rs-panel p-3 flex items-start gap-3">
            <div className="min-w-0">
              <p className="font-pixel text-[10px] text-blood">ФОНОВАЯ ОШИБКА</p>
              <pre className="text-[10px] text-bone-dim whitespace-pre-wrap break-words max-h-24 overflow-auto mt-1">{globalErr}</pre>
            </div>
            <button className="rs-btn rs-btn-dark rs-chip px-3 py-2 text-[9px] shrink-0" onClick={() => setGlobalErr(null)}>
              ОК
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── игровая сцена ── */

function GameView({
  cls, alloc, meta, sfx, onEvent, onQuit, muted, onToggleMute,
}: {
  cls: ClassId;
  alloc: Alloc;
  meta: MetaState;
  sfx: Sfx;
  onEvent: (e: EngineEvent) => void;
  onQuit: (soulsCarried: number) => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [hud, setHud] = useState<HudData | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // onHud вызывается синхронно ещё внутри конструктора,
    // поэтому движок держим в замыкаемой переменной с проверкой
    let eng: Engine | null = null;
    let created: Engine;
    try {
      created = new Engine(
        canvas,
        { cls, alloc, meta },
        sfx,
        {
          onHud: () => {
            if (eng) setHud(eng.getHud());
          },
          onEvent: (e) => onEventRef.current(e),
          onFatal: (msg) => setFatal(msg),
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ""}` : String(err);
      // eslint-disable-next-line no-console
      console.error("[RETRO SOULS] engine constructor failed:", msg);
      setFatal(msg);
      return;
    }
    eng = created;
    engineRef.current = created;
    setHud(created.getHud());
    setEngine(created);
    return () => {
      created.destroy();
      engineRef.current = null;
    };
    // создаётся один раз на забег (key={runId} пересоздаёт компонент)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sfx.setMuted(muted);
  }, [muted, sfx]);

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0" style={{ touchAction: "none" }}>
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
      {engine && hud && (
        <Hud
          engine={engine}
          hud={hud}
          muted={muted}
          onToggleMute={onToggleMute}
          onQuit={() => onQuit(hud.souls)}
        />
      )}
      {fatal && (
        <div className="absolute inset-0 z-50 bg-abyss/95 flex items-center justify-center p-4">
          <div className="rs-panel rs-pop p-6 max-w-lg w-full">
            <p className="font-pixel text-sm text-blood">СБОЙ В ПОДЗЕМЕЛЬЕ</p>
            <p className="font-body text-xs text-bone-dim mt-2">
              Игра поймала ошибку вместо чёрного экрана. Скопируйте текст — он поможет починить забег.
            </p>
            <pre className="mt-3 text-[11px] leading-relaxed text-ember bg-black/50 border border-stone-700 p-3 whitespace-pre-wrap break-words max-h-52 overflow-auto rs-scroll">
              {fatal}
            </pre>
            <button className="rs-btn rs-btn-ember rs-chip mt-4 px-6 py-3 text-[10px]" onClick={() => onQuit(0)}>
              В МЕНЮ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── страховка от падений React-дерева ── */

class CrashBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 z-50 bg-abyss flex items-center justify-center p-4">
          <div className="rs-panel p-6 max-w-lg w-full">
            <p className="font-pixel text-sm text-blood">ДУША СПОТКНУЛАСЬ</p>
            <pre className="mt-3 text-[11px] text-ember bg-black/50 border border-stone-700 p-3 whitespace-pre-wrap break-words max-h-52 overflow-auto">
              {this.state.error}
            </pre>
            <button
              className="rs-btn rs-btn-ember rs-chip mt-4 px-6 py-3 text-[10px]"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              ПЕРЕЗАПУСТИТЬ
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
