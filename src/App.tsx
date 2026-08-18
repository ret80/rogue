import { useCallback, useEffect, useRef, useState } from "react";
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
      )}
      {screen === "end" && summary && (
        <EndScreen
          summary={summary}
          onRetry={() => { sfx.click(); setScreen("select"); }}
          onMenu={() => { sfx.click(); setScreen("menu"); }}
        />
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = new Engine(
      canvas,
      { cls, alloc, meta },
      sfx,
      {
        onHud: () => setHud(eng.getHud()),
        onEvent: (e) => onEventRef.current(e),
      }
    );
    engineRef.current = eng;
    setHud(eng.getHud());
    setEngine(eng);
    return () => {
      eng.destroy();
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
    </div>
  );
}
