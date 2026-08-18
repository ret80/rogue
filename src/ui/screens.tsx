import { useEffect, useRef, useState } from "react";
import { CLASS_DEFS, TREE_DEFS, TOTAL_TREE_COST, resetMeta } from "../game/save";
import type { Alloc, ClassId, MetaState, RunSummary, TreeKey } from "../game/types";
import { FINAL_FLOOR } from "../game/types";

/* ── иконки (инлайн SVG, без эмодзи) ────────────────────────── */

export function IconFlame({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2c1 4-4 6-4 11a4 4 0 0 0 8 0c0-2-1-3.5-1-3.5S17 11 17 14a5 5 0 0 1-10 0C7 8 12 7 12 2z" />
    </svg>
  );
}
export function IconSkull({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2a8 8 0 0 0-8 8c0 3 1.6 5.4 4 6.7V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.3c2.4-1.3 4-3.7 4-6.7a8 8 0 0 0-8-8zM8.5 13A2 2 0 1 1 8.5 9a2 2 0 0 1 0 4zm7 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM12 17l-1.5-2.5h3L12 17z" />
    </svg>
  );
}
export function IconCoin({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="9" opacity="0.5" />
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" stroke="#3d2b00" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
export function IconSword({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M19 3l-9.5 9.5M19 3h-4M19 3v4M5 15l4 4M4 20l-1-1 3-3 2 2-3 3zM12.5 8.5l3 3-2 2-3-3z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
export function IconLock({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1zm2 0h6V8a3 3 0 0 0-6 0v2zm3 4a1.5 1.5 0 0 0-.75 2.8V18h1.5v-1.2A1.5 1.5 0 0 0 12 14z" />
    </svg>
  );
}
export function IconFlask({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M10 2h4v2h-1v4l4.6 8.1A3 3 0 0 1 15 21H9a3 3 0 0 1-2.6-4.9L11 8V4h-1V2zm1 6v1.3L7.4 15h9.2L13 9.3V8h-2z" />
      <path d="M8.5 15.5h7L17 18a1.6 1.6 0 0 1-1.4 2H8.4A1.6 1.6 0 0 1 7 18l1.5-2.5z" opacity="0.7" />
    </svg>
  );
}
export function IconStairs({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M3 21v-4h4v-4h4V9h4V5h4v4h-4v4h-4v4h-4v4H3z" />
    </svg>
  );
}

/* ── живой фон из угольков ──────────────────────────────────── */

export function EmberCanvas({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    interface Ember { x: number; y: number; vx: number; vy: number; s: number; life: number; max: number; soul: boolean; }
    const embers: Ember[] = [];
    const spawn = (): Ember => ({
      x: Math.random() * w,
      y: h + 10,
      vx: (Math.random() - 0.5) * 14,
      vy: -22 - Math.random() * 46,
      s: 1 + Math.random() * 2.6,
      life: 0,
      max: 4 + Math.random() * 5,
      soul: Math.random() < 0.16,
    });
    for (let i = 0; i < 70; i++) {
      const e = spawn();
      e.y = Math.random() * h;
      e.life = Math.random() * e.max;
      embers.push(e);
    }
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, w, h);
      for (const e of embers) {
        e.life += dt;
        if (e.life > e.max || e.y < -12) Object.assign(e, spawn());
        e.x += (e.vx + Math.sin((e.life + e.y) * 0.6) * 12) * dt;
        e.y += e.vy * dt;
        const a = Math.max(0, Math.min(1, 1 - e.life / e.max)) * 0.9;
        ctx.globalAlpha = a;
        ctx.fillStyle = e.soul ? "#46f0c8" : Math.random() < 0.1 ? "#ffd166" : "#ff9d3d";
        if (e.soul) {
          ctx.shadowColor = "#46f0c8";
          ctx.shadowBlur = 10;
        }
        ctx.fillRect(e.x, e.y, e.s, e.s);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className={`absolute inset-0 w-full h-full ${className}`} />;
}

/* ── общие атомы ────────────────────────────────────────────── */

export function SoulCounter({ value, big = false }: { value: number; big?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 text-soul ${big ? "text-2xl" : "text-sm"} font-pixel`}>
      <span className="rs-soulglow inline-flex"><IconFlame className={big ? "w-6 h-6" : "w-4 h-4"} /></span>
      {value}
    </span>
  );
}

export function StatPips({ level, max = 10, color }: { level: number; max?: number; color: string }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="rs-statpip" style={i < level ? { background: color, boxShadow: `0 0 8px ${color}` } : undefined} />
      ))}
    </div>
  );
}

function Portrait({ cls, size = 84 }: { cls: ClassId; size?: number }) {
  if (cls === "knight")
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <rect x="0" y="0" width="100" height="100" fill="#1a2130" />
        <path d="M20 90 L20 45 Q20 18 50 18 Q80 18 80 45 L80 90 Z" fill="#8d99a6" />
        <path d="M28 90 L28 48 Q28 26 50 26 Q72 26 72 48 L72 90 Z" fill="#5c6774" />
        <rect x="30" y="52" width="40" height="7" fill="#10151f" />
        <rect x="33" y="54" width="10" height="3" fill="#ff9d3d" />
        <rect x="57" y="54" width="10" height="3" fill="#ff9d3d" />
        <rect x="47" y="14" width="6" height="24" fill="#ff6b2e" />
        <path d="M50 6 L58 16 L42 16 Z" fill="#ff9d3d" />
      </svg>
    );
  if (cls === "thief")
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <rect x="0" y="0" width="100" height="100" fill="#152218" />
        <path d="M22 90 Q18 40 50 30 Q82 40 78 90 Z" fill="#3d5a3a" />
        <path d="M30 90 Q28 48 50 40 Q72 48 70 90 Z" fill="#243a24" />
        <path d="M50 18 Q66 22 64 44 L50 36 L36 44 Q34 22 50 18Z" fill="#3d5a3a" />
        <rect x="36" y="52" width="28" height="8" fill="#0c130c" />
        <rect x="40" y="54" width="7" height="4" fill="#46f0c8" />
        <rect x="54" y="54" width="7" height="4" fill="#46f0c8" />
        <path d="M70 62 L92 40 L88 62 Z" fill="#c9d4e4" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <rect x="0" y="0" width="100" height="100" fill="#1c1526" />
      <path d="M50 8 L74 44 L26 44 Z" fill="#6d5a8f" />
      <path d="M24 44 L76 44 L70 56 L30 56 Z" fill="#4a3b63" />
      <circle cx="50" cy="30" r="4" fill="#b98cff" />
      <path d="M30 56 L70 56 L76 90 L24 90 Z" fill="#8a63c9" />
      <rect x="38" y="62" width="8" height="5" fill="#10151f" />
      <rect x="54" y="62" width="8" height="5" fill="#10151f" />
      <rect x="41" y="63" width="4" height="3" fill="#46f0c8" />
      <rect x="57" y="63" width="4" height="3" fill="#46f0c8" />
      <circle cx="84" cy="70" r="7" fill="#b98cff" opacity="0.85" />
      <circle cx="84" cy="70" r="3" fill="#e9e2cf" />
    </svg>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-pixel text-[8px] text-bone-dim w-8">{label}</span>
      <div className="rs-bar rs-chip h-2.5 flex-1">
        <i style={{ width: `${(value / max) * 100}%`, backgroundImage: `linear-gradient(180deg, ${color}, ${color}88)` }} />
      </div>
      <span className="font-pixel text-[9px] w-6 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

/* ── главное меню ───────────────────────────────────────────── */

export function MenuScreen({
  meta, onPlay, onTree,
}: { meta: MetaState; onPlay: () => void; onTree: () => void }) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="relative h-full w-full overflow-hidden bg-abyss">
      <EmberCanvas />
      {/* силуэт подземелья */}
      <svg className="absolute bottom-0 left-0 w-full opacity-40" viewBox="0 0 1200 240" preserveAspectRatio="none" aria-hidden>
        <path d="M0 240 L0 140 L80 140 L80 90 L140 90 L140 160 L240 160 L240 60 L260 60 L260 40 L280 40 L280 60 L300 60 L300 160 L400 160 L400 110 L520 110 L520 180 L640 180 L640 70 L700 70 L700 120 L800 120 L800 40 L820 40 L820 20 L840 20 L840 40 L860 40 L860 150 L980 150 L980 100 L1080 100 L1080 170 L1200 170 L1200 240 Z" fill="#10151f" />
        <path d="M250 70 L255 60 L260 70 Z M270 50 L275 40 L280 50 Z M810 50 L815 40 L820 50 Z M830 30 L835 20 L840 30 Z" fill="#ff9d3d" opacity="0.8" />
      </svg>
      <div className="relative z-10 h-full flex flex-col justify-between px-5 sm:px-12 py-6 sm:py-10 max-w-6xl mx-auto">
        <header className="rs-rise">
          <p className="font-pixel text-[9px] sm:text-[10px] text-ember tracking-widest">ACTION-ROGUELIKE · 20 ЭТАЖЕЙ · ОДНА ЖИЗНЬ</p>
          <h1 className="rs-title font-pixel text-bone leading-none mt-3 text-[34px] sm:text-6xl md:text-7xl">
            RETRO<span className="text-ember"> SOULS</span>
          </h1>
          <p className="mt-3 max-w-md text-sm sm:text-base text-bone-dim font-body">
            Спустись в процедурные склепы, рази тварей кликом, собирай
            <span className="text-soul font-semibold"> Огни Душ</span> и корми ими Древо — смерть здесь лишь начало прокачки.
          </p>
        </header>

        <div className="grid sm:grid-cols-[1fr_auto] gap-6 sm:gap-14 items-end mt-6">
          {/* сводка прогресса */}
          <div className="rs-panel p-4 sm:p-5 rs-rise" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <SoulCounter value={meta.souls} big />
              <span className="font-pixel text-[8px] text-bone-dim">ДРЕВО: {Object.values(meta.tree).reduce((a, b) => a + b, 0)}/{TREE_DEFS.length * 10}</span>
            </div>
            <div className="rs-divider my-3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-body text-sm">
              <div><p className="font-pixel text-[9px] text-gold">{meta.bestFloor}</p><p className="text-bone-dim text-xs">лучший этаж</p></div>
              <div><p className="font-pixel text-[9px] text-blood">{meta.kills}</p><p className="text-bone-dim text-xs">убийств</p></div>
              <div><p className="font-pixel text-[9px] text-ember">{meta.runs}</p><p className="text-bone-dim text-xs">забегов</p></div>
              <div><p className="font-pixel text-[9px] text-gold">{meta.chests}</p><p className="text-bone-dim text-xs">сундуков</p></div>
            </div>
          </div>

          {/* меню */}
          <div className="flex flex-col gap-3 min-w-[240px] rs-rise" style={{ animationDelay: "0.18s" }}>
            <button className="rs-btn rs-btn-ember rs-chip px-6 py-4 text-sm sm:text-base" onClick={onPlay}>
              СПУСТИТЬСЯ
            </button>
            <button className="rs-btn rs-btn-soul rs-chip px-6 py-3.5 text-xs" onClick={onTree}>
              ДРЕВО ДУШ
            </button>
            <button
              className="rs-btn rs-btn-dark rs-chip px-6 py-3 text-[10px]"
              onClick={() => {
                if (confirmReset) {
                  resetMeta();
                  window.location.reload();
                } else setConfirmReset(true);
              }}
            >
              {confirmReset ? "ТОЧНО СТЕРЕТЬ?" : "СБРОС ПРОГРЕССА"}
            </button>
          </div>
        </div>

        <footer className="rs-rise mt-6" style={{ animationDelay: "0.26s" }}>
          <div className="rs-divider mb-3" />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-bone-dim font-body items-center">
            <span className="inline-flex items-center gap-2"><kbd className="rs-chip bg-stone-700 border border-stone-600 px-2 py-0.5 font-pixel text-[8px] text-bone">ЛКМ / ТАП</kbd> движение и действия</span>
            <span className="inline-flex items-center gap-2"><kbd className="rs-chip bg-stone-700 border border-stone-600 px-2 py-0.5 font-pixel text-[8px] text-bone">РЯДОМ С ВРАГОМ</kbd> атака — автоматически</span>
            <span className="inline-flex items-center gap-2"><kbd className="rs-chip bg-stone-700 border border-stone-600 px-2 py-0.5 font-pixel text-[8px] text-bone">ESC</kbd> пауза</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ── выбор класса ───────────────────────────────────────────── */

export function SelectScreen({
  meta, onPick, onBack,
}: { meta: MetaState; onPick: (c: ClassId) => void; onBack: () => void }) {
  const [sel, setSel] = useState<ClassId>("knight");
  return (
    <div className="relative h-full w-full overflow-hidden bg-abyss">
      <EmberCanvas className="opacity-60" />
      <div className="relative z-10 h-full max-w-6xl mx-auto px-4 sm:px-8 py-5 sm:py-8 flex flex-col">
        <div className="flex items-end justify-between gap-4 rs-rise">
          <div>
            <p className="font-pixel text-[9px] text-ember tracking-widest">ВЫБОР СОСУДА</p>
            <h2 className="font-pixel text-2xl sm:text-4xl text-bone mt-1">КТО ПОЙДЁТ ВО ТЬМУ?</h2>
          </div>
          <button className="rs-btn rs-btn-dark rs-chip px-4 py-2.5 text-[10px]" onClick={onBack}>НАЗАД</button>
        </div>

        <div className="grid md:grid-cols-3 gap-3 sm:gap-4 mt-5 sm:mt-7 flex-1 min-h-0">
          {CLASS_DEFS.map((c, i) => {
            const unlocked = c.isUnlocked(meta);
            const active = sel === c.id;
            return (
              <button
                key={c.id}
                disabled={!unlocked}
                onClick={() => { if (unlocked) { setSel(c.id); } }}
                className={`rs-panel rs-rise relative text-left p-4 sm:p-5 transition-all duration-150 ${active ? "border-2 border-ember -translate-y-1" : "hover:-translate-y-0.5"} ${unlocked ? "cursor-pointer" : "cursor-not-allowed opacity-90"}`}
                style={{ animationDelay: `${0.08 + i * 0.08}s` }}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={`rs-chip overflow-hidden shrink-0 border border-black ${unlocked ? "" : "grayscale"}`}>
                    <Portrait cls={c.id} size={76} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-pixel text-sm sm:text-base" style={{ color: unlocked ? c.accent : "#5c6774" }}>{c.name}</p>
                    <p className="text-[11px] text-bone-dim font-body italic">{c.title}</p>
                  </div>
                </div>
                <p className="mt-3 text-[13px] leading-snug text-bone/85 font-body min-h-[52px]">{c.desc}</p>
                <div className="mt-3 space-y-1.5">
                  <MiniBar label="HP" value={c.hp} max={130} color="#e8434f" />
                  <MiniBar label="СИЛ" value={c.str} max={16} color="#ff9d3d" />
                  <MiniBar label="ЛОВ" value={c.dex} max={16} color="#46f0c8" />
                  <MiniBar label="ИНТ" value={c.int} max={16} color="#b98cff" />
                </div>
                {c.ranged && <p className="mt-2 font-pixel text-[8px] text-arcane">ДАЛЬНЯЯ АТАКА</p>}
                {!unlocked && (
                  <div className="absolute inset-0 rs-chip bg-abyss/82 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <IconLock className="w-8 h-8 text-stone-600" />
                    <p className="font-pixel text-[9px] text-bone-dim leading-relaxed">{c.unlockText}</p>
                    {c.id === "thief" && <p className="font-pixel text-[9px] text-gold">СУНДУКИ: {Math.min(10, meta.chests)}/10</p>}
                    {c.id === "mage" && <p className="font-pixel text-[9px] text-gold">{meta.bossesKilled.includes(5) ? "ГОТОВО" : "БОСС ЭТАЖА 5 НЕ ПАЛ"}</p>}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 sm:mt-6 flex justify-end rs-rise" style={{ animationDelay: "0.3s" }}>
          <button className="rs-btn rs-btn-ember rs-chip px-8 py-4 text-xs sm:text-sm" onClick={() => onPick(sel)}>
            ВЫБРАТЬ · {CLASS_DEFS.find((c) => c.id === sel)?.name}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── распределение очков ────────────────────────────────────── */

const ALLOC_POINTS = 5;

export function AllocateScreen({
  cls, onStart, onBack,
}: { cls: ClassId; onStart: (a: Alloc) => void; onBack: () => void }) {
  const [pts, setPts] = useState<Alloc>({ str: 0, dex: 0, int: 0 });
  const left = ALLOC_POINTS - pts.str - pts.dex - pts.int;
  const c = CLASS_DEFS.find((d) => d.id === cls)!;
  const rows: { key: keyof Alloc; name: string; desc: string; color: string; base: number }[] = [
    { key: "str", name: "СИЛА", desc: "урон ближнего боя", color: "#ff9d3d", base: c.str },
    { key: "dex", name: "ЛОВКОСТЬ", desc: "крит. шанс и скорость", color: "#46f0c8", base: c.dex },
    { key: "int", name: "ИНТЕЛЛЕКТ", desc: "урон магии (для мага — основной)", color: "#b98cff", base: c.int },
  ];
  return (
    <div className="relative h-full w-full overflow-hidden bg-abyss">
      <EmberCanvas className="opacity-40" />
      <div className="relative z-10 h-full max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col justify-center">
        <p className="font-pixel text-[9px] text-ember tracking-widest rs-rise">ЗАКАЛКА ДУХА</p>
        <h2 className="font-pixel text-xl sm:text-3xl text-bone mt-1 rs-rise">РАСПРЕДЕЛИ {ALLOC_POINTS} ОЧКОВ</h2>

        <div className="rs-panel p-4 sm:p-6 mt-5 space-y-4 rs-rise" style={{ animationDelay: "0.1s" }}>
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3 sm:gap-4">
              <div className="w-28 sm:w-36 shrink-0">
                <p className="font-pixel text-[10px]" style={{ color: r.color }}>{r.name}</p>
                <p className="text-[11px] text-bone-dim font-body">{r.desc}</p>
              </div>
              <button
                className="rs-btn rs-btn-dark rs-chip w-10 h-10 text-base"
                disabled={pts[r.key] <= 0}
                onClick={() => setPts((p) => ({ ...p, [r.key]: p[r.key] - 1 }))}
              >−</button>
              <div className="flex-1 flex items-center justify-center gap-2">
                <span className="font-pixel text-lg sm:text-2xl" style={{ color: r.color }}>{r.base + pts[r.key]}</span>
                {pts[r.key] > 0 && <span className="font-pixel text-[9px] text-soul">+{pts[r.key]}</span>}
              </div>
              <button
                className="rs-btn rs-btn-ember rs-chip w-10 h-10 text-base"
                disabled={left <= 0}
                onClick={() => setPts((p) => ({ ...p, [r.key]: p[r.key] + 1 }))}
              >+</button>
            </div>
          ))}
          <div className="rs-divider" />
          <div className="flex items-center justify-between">
            <p className="font-body text-sm text-bone-dim">Осталось: <span className={`font-pixel text-base ${left > 0 ? "text-gold" : "text-soul"}`}>{left}</span></p>
            <p className="font-body text-xs text-bone-dim hidden sm:block">HP {c.hp} · Крит {Math.round((0.05 + (c.dex + pts.dex) / 100) * 100)}% · Темп {c.atkCd}с</p>
          </div>
        </div>

        <div className="flex gap-3 mt-5 justify-end rs-rise" style={{ animationDelay: "0.18s" }}>
          <button className="rs-btn rs-btn-dark rs-chip px-6 py-3.5 text-[10px]" onClick={onBack}>НАЗАД</button>
          <button
            className="rs-btn rs-btn-ember rs-chip px-8 py-3.5 text-xs sm:text-sm"
            disabled={left > 0}
            onClick={() => onStart(pts)}
          >
            {left > 0 ? "ИСТРАТЬ ВСЁ" : "В ПОДЗЕМЕЛЬЕ"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── древо душ ──────────────────────────────────────────────── */

export function TreeScreen({
  meta, onBuy, onBack,
}: { meta: MetaState; onBuy: (k: TreeKey) => void; onBack: () => void }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-abyss">
      <EmberCanvas className="opacity-50" />
      <div className="relative z-10 h-full max-w-5xl mx-auto px-4 sm:px-8 py-5 sm:py-8 flex flex-col min-h-0">
        <div className="flex items-end justify-between gap-4 rs-rise">
          <div>
            <p className="font-pixel text-[9px] text-soul tracking-widest">МЕТА-ПРОГРЕССИЯ</p>
            <h2 className="font-pixel text-2xl sm:text-4xl text-bone mt-1">ДРЕВО ДУШ</h2>
          </div>
          <div className="text-right">
            <SoulCounter value={meta.souls} big />
            <p className="text-[11px] text-bone-dim font-body mt-1">полный прокач: {TOTAL_TREE_COST} осколков</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5 overflow-y-auto rs-scroll pb-2 flex-1 min-h-0">
          {TREE_DEFS.map((d, i) => {
            const lvl = meta.tree[d.key];
            const maxed = lvl >= d.max;
            const cost = d.cost(lvl);
            const afford = meta.souls >= cost;
            return (
              <div key={d.key} className="rs-panel p-4 rs-rise flex flex-col" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-center justify-between">
                  <p className="font-pixel text-[11px]" style={{ color: d.color }}>{d.name}</p>
                  <span className="font-pixel text-[9px] text-bone-dim">{lvl}/{d.max}</span>
                </div>
                <div className="mt-2.5"><StatPips level={lvl} color={d.color} /></div>
                <p className="mt-2.5 text-xs text-bone-dim font-body flex-1">{d.per}</p>
                <button
                  className={`rs-btn rs-chip mt-3 px-3 py-2.5 text-[9px] ${maxed ? "rs-btn-dark" : afford ? "rs-btn-soul" : "rs-btn-dark"}`}
                  disabled={maxed || !afford}
                  onClick={() => onBuy(d.key)}
                >
                  {maxed ? "МАКСИМУМ" : `УЛУЧШИТЬ · ${cost}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="rs-panel mt-3 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center rs-rise">
          <div><p className="font-pixel text-[10px] text-gold">{meta.chests}/10</p><p className="text-[11px] text-bone-dim font-body">сундуков → Вор</p></div>
          <div><p className="font-pixel text-[10px] text-arcane">{meta.bossesKilled.includes(5) ? "ДА" : "НЕТ"}</p><p className="text-[11px] text-bone-dim font-body">босс 5 этажа → Маг</p></div>
          <div><p className="font-pixel text-[10px] text-ember">{meta.bestFloor}/{FINAL_FLOOR}</p><p className="text-[11px] text-bone-dim font-body">лучший этаж</p></div>
          <div><p className="font-pixel text-[10px] text-blood">{meta.kills}</p><p className="text-[11px] text-bone-dim font-body">всего убийств</p></div>
        </div>

        <div className="mt-4 flex justify-between items-center rs-rise">
          <p className="text-xs text-bone-dim font-body max-w-md">Осколки душ капают с каждого убитого врага и сохраняются после смерти. Трать с умом — смерть неизбежна.</p>
          <button className="rs-btn rs-btn-ember rs-chip px-6 py-3 text-[10px] shrink-0 ml-3" onClick={onBack}>К КОСТРУ</button>
        </div>
      </div>
    </div>
  );
}

/* ── финал забега ───────────────────────────────────────────── */

export function EndScreen({
  summary, onRetry, onMenu,
}: { summary: RunSummary; onRetry: () => void; onMenu: () => void }) {
  const v = summary.victory;
  return (
    <div className="relative h-full w-full overflow-hidden bg-abyss">
      <EmberCanvas />
      <div className="relative z-10 h-full max-w-2xl mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center">
        <div className="text-center rs-pop">
          <div className={`inline-flex mb-4 ${v ? "text-gold" : "text-blood"}`}>
            {v ? <IconFlame className="w-14 h-14" /> : <IconSkull className="w-14 h-14" />}
          </div>
          <h2 className={`rs-title font-pixel text-3xl sm:text-5xl ${v ? "text-gold" : "text-blood"}`}>
            {v ? "ПОДЗЕМЬЕ ПАЛО" : "ВЫ ПАЛИ"}
          </h2>
          <p className="font-body text-bone-dim mt-2 text-sm sm:text-base">
            {v
              ? "Пожиратель Душ развеян. Костёр пылает ярко — легенда записана."
              : `Тьма забрала тело на этаже ${summary.floor}. Но душа донесла осколки до костра.`}
          </p>
        </div>

        {summary.newUnlocks.length > 0 && (
          <div className="rs-panel mt-5 p-4 text-center rs-pop border border-gold" style={{ animationDelay: "0.2s" }}>
            <p className="font-pixel text-[10px] text-gold">НОВЫЕ ОТКРЫТИЯ</p>
            {summary.newUnlocks.map((u) => (
              <p key={u} className="font-pixel text-xs text-soul mt-2">{u}</p>
            ))}
          </div>
        )}

        <div className="rs-panel mt-5 p-5 rs-rise" style={{ animationDelay: "0.12s" }}>
          <div className="flex items-center justify-center pb-4">
            <div className="text-center">
              <SoulCounter value={summary.soulsBanked} big />
              <p className="text-[11px] text-bone-dim font-body mt-1">осколков в копилку {v ? "(×2 за победу)" : ""} · всего {summary.totalSouls}</p>
            </div>
          </div>
          <div className="rs-divider mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center font-body">
            <div><p className="font-pixel text-sm text-ember">{summary.floor}</p><p className="text-[11px] text-bone-dim">этаж</p></div>
            <div><p className="font-pixel text-sm text-blood">{summary.kills}</p><p className="text-[11px] text-bone-dim">убийств</p></div>
            <div><p className="font-pixel text-sm text-gold">{summary.chests}</p><p className="text-[11px] text-bone-dim">сундуков</p></div>
            <div><p className="font-pixel text-sm text-gold">{summary.gold}</p><p className="text-[11px] text-bone-dim">золота</p></div>
            <div><p className="font-pixel text-sm text-soul">{Math.floor(summary.timeSec / 60)}:{String(summary.timeSec % 60).padStart(2, "0")}</p><p className="text-[11px] text-bone-dim">время</p></div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center rs-rise" style={{ animationDelay: "0.2s" }}>
          <button className="rs-btn rs-btn-ember rs-chip px-8 py-4 text-xs" onClick={onRetry}>НОВЫЙ ЗАБЕГ</button>
          <button className="rs-btn rs-btn-dark rs-chip px-8 py-4 text-xs" onClick={onMenu}>К КОСТРУ</button>
        </div>
      </div>
    </div>
  );
}

/* ── справка по управлению (для паузы) ─────────────────────── */

export function ControlsGuide({ compact = false }: { compact?: boolean }) {
  const rows = [
    ["ЛКМ / ТАП ПО ПОЛУ", "идти к точке (удерживай — вести)"],
    ["КЛИК ПО ВРАГУ", "подойти · атака сработает сама"],
    ["КЛИК ПО СУНДУКУ / ТОРГОВЦУ", "открыть / торговать (вблизи)"],
    ["БОЧКА", "ударь — она полетит и покалечит врагов"],
    ["ESC / P", "пауза"],
  ];
  return (
    <div className={`space-y-2 ${compact ? "" : "text-sm"}`}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start gap-3">
          <kbd className="rs-chip bg-stone-700 border border-stone-600 px-2 py-1 font-pixel text-[8px] text-bone shrink-0 mt-0.5">{k}</kbd>
          <span className="font-body text-xs text-bone-dim">{v}</span>
        </div>
      ))}
    </div>
  );
}

