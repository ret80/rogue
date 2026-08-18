import { useEffect, useRef, useState } from "react";
import type { Engine } from "../game/engine";
import type { Alloc, HudData } from "../game/types";
import { ControlsGuide, IconFlame, IconFlask, IconSkull, IconStairs, IconSword } from "./screens";

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Hud({
  engine, hud, muted, onToggleMute, onQuit,
}: {
  engine: Engine;
  hud: HudData;
  muted: boolean;
  onToggleMute: () => void;
  onQuit: () => void;
}) {
  const mmRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    engine.attachMinimap(mmRef.current);
    return () => engine.attachMinimap(null);
  }, [engine]);

  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / hud.xpNeed) * 100));

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* ── верх слева: витальность ── */}
      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 pointer-events-auto">
        <div className="rs-panel p-2.5 sm:p-3 w-[196px] sm:w-[248px]">
          <div className="flex items-center gap-2">
            <span className="rs-chip bg-stone-800 border border-black px-1.5 py-1 font-pixel text-[9px] text-gold shrink-0">
              УР.{hud.level}
            </span>
            <div className="rs-bar rs-bar-hp rs-chip h-4 flex-1">
              <i style={{ width: `${hpPct}%` }} />
              <span className="absolute inset-0 flex items-center justify-center font-pixel text-[8px] text-bone drop-shadow-[0_1px_0_#000]">
                {hud.hp}/{hud.maxHp}
              </span>
            </div>
          </div>
          <div className="rs-bar rs-bar-xp rs-chip h-2 mt-1.5">
            <i style={{ width: `${xpPct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5 font-pixel text-[8px]">
            <span className="text-ember inline-flex items-center gap-1"><IconStairs className="w-3 h-3" />{hud.floor}/{hud.maxFloor}</span>
            <span className="text-gold">{hud.gold} ЗЛ</span>
            <span className="text-soul inline-flex items-center gap-1"><IconFlame className="w-3 h-3" />{hud.souls}</span>
          </div>
        </div>
        {hud.poisonT > 0 && (
          <p className="mt-1.5 font-pixel text-[8px] text-[#7ed957] bg-black/60 rs-chip inline-block px-2 py-1 rs-shake">
            ОТРАВЛЕН {Math.ceil(hud.poisonT)}с
          </p>
        )}
      </div>

      {/* ── верх справа: миникарта ── */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 pointer-events-auto flex flex-col items-end gap-1.5">
        <canvas
          ref={mmRef}
          width={132}
          height={132}
          className="rs-chip border border-stone-600 w-[88px] h-[88px] sm:w-[132px] sm:h-[132px]"
          style={{ imageRendering: "pixelated", background: "rgba(6,8,13,0.9)" }}
        />
        <div className="flex gap-1.5">
          <button
            className="rs-btn rs-btn-dark rs-chip w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center"
            onClick={onToggleMute}
            aria-label="звук"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
              {muted ? (
                <path d="M4 9v6h4l5 4V5L8 9H4zm14.6 3l2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4-2.7-2.7z" />
              ) : (
                <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a3.5 3.5 0 0 0-2-3.2v6.4a3.5 3.5 0 0 0 2-3.2zm-2-7.6v2.1a6 6 0 0 1 0 11v2.1a8 8 0 0 0 0-15.2z" />
              )}
            </svg>
          </button>
          <button
            className="rs-btn rs-btn-dark rs-chip w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center"
            onClick={() => engine.togglePause()}
            aria-label="пауза"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" />
              <rect x="14" y="5" width="4" height="14" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── босс-бар ── */}
      {hud.boss && (
        <div className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 w-[min(560px,72vw)] pointer-events-none">
          <p className="font-pixel text-[9px] sm:text-[10px] text-arcane text-center drop-shadow-[0_2px_0_#000] tracking-wider">
            {hud.boss.name}
          </p>
          <div className="rs-bar rs-bar-boss rs-chip h-3 mt-1">
            <i style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }} />
          </div>
        </div>
      )}

      {/* ── тост-подсказка ── */}
      {hud.hint && (
        <div key={hud.hint.id} className="absolute top-[18%] left-1/2 -translate-x-1/2 rs-toast pointer-events-none">
          <p className="rs-chip bg-black/75 border border-stone-600 px-4 py-2 font-pixel text-[9px] sm:text-[10px] text-bone text-center">
            {hud.hint.text}
          </p>
        </div>
      )}

      {/* ── низ слева: фляги и статы ── */}
      <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 pointer-events-auto flex items-end gap-2">
        <button
          className="rs-btn rs-btn-soul rs-chip relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center"
          onClick={() => engine.usePotion()}
          disabled={hud.potions <= 0}
          aria-label="выпить зелье"
        >
          <IconFlask className="w-7 h-7" />
          <span className="absolute -top-1.5 -right-1.5 rs-chip bg-black border border-soul px-1.5 font-pixel text-[9px] text-soul">
            {hud.potions}
          </span>
        </button>
        <div className="rs-panel rs-chip px-2.5 py-2 hidden sm:block">
          <div className="flex gap-2.5 font-pixel text-[8px]">
            <span className="text-ember" title="Сила">С {hud.str}</span>
            <span className="text-soul" title="Ловкость">Л {hud.dex}</span>
            <span className="text-arcane" title="Интеллект">И {hud.int}</span>
          </div>
          <div className="flex gap-2.5 font-pixel text-[8px] mt-1">
            <span className="text-gold inline-flex items-center gap-1"><IconSword className="w-3 h-3" />+{hud.weapon}</span>
            <span className="text-[#7db4ff]">Бр +{hud.armor}</span>
            <span className="text-bone-dim hidden sm:inline">{fmtTime(hud.timeSec)}</span>
          </div>
        </div>
      </div>

      {/* ── низ справа: напоминание ── */}
      <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 pointer-events-none hidden sm:block">
        <p className="font-pixel text-[8px] text-bone-dim/70 bg-black/40 rs-chip px-2 py-1.5">
          ТАП — ХОД · АТАКА АВТО
        </p>
      </div>

      {/* ── модальные окна ── */}
      {hud.modal === "levelup" && <LevelUpModal points={hud.pendingPoints} onApply={(a) => engine.applyAlloc(a)} />}
      {hud.modal === "merchant" && (
        <MerchantModal hud={hud} onBuy={(i) => engine.buyItem(i)} onClose={() => engine.closeMerchant()} />
      )}
      {hud.paused && <PauseModal onResume={() => engine.togglePause()} muted={muted} onToggleMute={onToggleMute} onQuit={onQuit} />}
    </div>
  );
}

/* ── уровень ── */

function LevelUpModal({ points, onApply }: { points: number; onApply: (a: Alloc) => void }) {
  const [a, setA] = useState<Alloc>({ str: 0, dex: 0, int: 0 });
  const left = points - a.str - a.dex - a.int;
  const rows: { k: keyof Alloc; name: string; color: string; hint: string }[] = [
    { k: "str", name: "СИЛА", color: "#ff9d3d", hint: "+урон" },
    { k: "dex", name: "ЛОВКОСТЬ", color: "#46f0c8", hint: "+крит" },
    { k: "int", name: "ИНТЕЛЛЕКТ", color: "#b98cff", hint: "+магия" },
  ];
  return (
    <div className="absolute inset-0 pointer-events-auto bg-black/70 flex items-center justify-center p-4">
      <div className="rs-panel rs-pop p-5 sm:p-6 w-full max-w-sm">
        <p className="font-pixel text-[9px] text-soul tracking-widest">ДУША ОКРЕПЛА</p>
        <h3 className="font-pixel text-xl text-gold mt-1">УРОВЕНЬ!</h3>
        <p className="font-body text-xs text-bone-dim mt-1">
          Очков: <span className="font-pixel text-soul">{left}</span> · HP полностью восстановлено
        </p>
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center gap-2">
              <span className="font-pixel text-[9px] w-24" style={{ color: r.color }}>{r.name}<span className="block font-body text-[10px] text-bone-dim">{r.hint}</span></span>
              <button className="rs-btn rs-btn-dark rs-chip w-9 h-9" disabled={a[r.k] <= 0} onClick={() => setA((p) => ({ ...p, [r.k]: p[r.k] - 1 }))}>−</button>
              <span className="font-pixel text-sm w-8 text-center" style={{ color: r.color }}>{a[r.k] > 0 ? `+${a[r.k]}` : "·"}</span>
              <button className="rs-btn rs-btn-ember rs-chip w-9 h-9" disabled={left <= 0} onClick={() => setA((p) => ({ ...p, [r.k]: p[r.k] + 1 }))}>+</button>
            </div>
          ))}
        </div>
        <button
          className="rs-btn rs-btn-soul rs-chip w-full mt-5 py-3.5 text-[11px]"
          disabled={left > 0}
          onClick={() => onApply(a)}
        >
          {left > 0 ? `РАСПРЕДЕЛИ ВСЁ (${left})` : "СКОВАТЬ СУДЬБУ"}
        </button>
      </div>
    </div>
  );
}

/* ── торговец ── */

function MerchantModal({ hud, onBuy, onClose }: { hud: HudData; onBuy: (i: "potion" | "whet" | "armor" | "heal") => void; onClose: () => void }) {
  const items: { id: "potion" | "whet" | "armor" | "heal"; name: string; desc: string; cost: number; color: string }[] = [
    { id: "potion", name: "ФЛЯГА", desc: "лечит 50% HP (макс. 6)", cost: hud.shop.potionCost, color: "#7ed957" },
    { id: "whet", name: "ТОЧИЛО", desc: `оружие +1 (сейчас +${hud.weapon})`, cost: hud.shop.whetCost, color: "#ff9d3d" },
    { id: "armor", name: "ЛАТЫ", desc: `броня +1 (сейчас +${hud.armor})`, cost: hud.shop.armorCost, color: "#7db4ff" },
    { id: "heal", name: "ОБЕТ", desc: "полное исцеление", cost: hud.shop.healCost, color: "#e8434f" },
  ];
  return (
    <div className="absolute inset-0 pointer-events-auto bg-black/70 flex items-center justify-center p-4">
      <div className="rs-panel rs-pop p-5 sm:p-6 w-full max-w-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-pixel text-[9px] text-ember tracking-widest">КОСТЁР ТОРГОВЦА</p>
            <h3 className="font-pixel text-lg text-bone mt-1">ЧТО ВОЗЬМЁШЬ, СТАННИК?</h3>
          </div>
          <span className="font-pixel text-xs text-gold inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-gold inline-block border border-black" />{hud.gold}</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2.5 mt-4">
          {items.map((it) => (
            <button
              key={it.id}
              className="rs-btn rs-btn-dark rs-chip p-3 text-left disabled:opacity-100"
              disabled={hud.gold < it.cost}
              onClick={() => onBuy(it.id)}
            >
              <p className="font-pixel text-[10px]" style={{ color: it.color }}>{it.name}</p>
              <p className="font-body text-[11px] text-bone-dim mt-0.5">{it.desc}</p>
              <p className="font-pixel text-[9px] text-gold mt-1.5">{it.cost} ЗЛ</p>
            </button>
          ))}
        </div>
        <button className="rs-btn rs-btn-ember rs-chip w-full mt-4 py-3 text-[10px]" onClick={onClose}>
          УЙТИ В ТЕМНОТУ
        </button>
      </div>
    </div>
  );
}

/* ── пауза ── */

function PauseModal({ onResume, muted, onToggleMute, onQuit }: { onResume: () => void; muted: boolean; onToggleMute: () => void; onQuit: () => void }) {
  return (
    <div className="absolute inset-0 pointer-events-auto bg-black/75 flex items-center justify-center p-4">
      <div className="rs-panel rs-pop p-5 sm:p-7 w-full max-w-md">
        <div className="flex items-center gap-3">
          <IconSkull className="w-8 h-8 text-ember" />
          <div>
            <h3 className="font-pixel text-2xl text-bone">ПАУЗА</h3>
            <p className="font-body text-xs text-bone-dim">тьма подождёт. недолго.</p>
          </div>
        </div>
        <div className="rs-divider my-4" />
        <ControlsGuide />
        <div className="rs-divider my-4" />
        <div className="flex flex-col gap-2.5">
          <button className="rs-btn rs-btn-ember rs-chip py-3.5 text-[11px]" onClick={onResume}>ПРОДОЛЖИТЬ</button>
          <button className="rs-btn rs-btn-dark rs-chip py-3 text-[10px]" onClick={onToggleMute}>
            ЗВУК: {muted ? "ВЫКЛ" : "ВКЛ"}
          </button>
          <button className="rs-btn rs-btn-blood rs-chip py-3 text-[10px]" onClick={onQuit}>
            ПОКИНУТЬ ЗАБЕГ (осколки донесёт душа)
          </button>
        </div>
      </div>
    </div>
  );
}
