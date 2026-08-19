import type { GameItem } from "./items";

export const MAP_W = 40;
export const MAP_H = 40;
export const TILE = 32;
export const FINAL_FLOOR = 20;

export type ClassId = "knight" | "thief" | "archer" | "mage";

export interface Alloc {
  str: number;
  dex: number;
  int: number;
  crit: number;
  lock: number;
}

export interface MetaState {
  souls: number;
  tree: Record<TreeKey, number>;
  chests: number;
  bossesKilled: number[];
  bestFloor: number;
  kills: number;
  runs: number;
  muted: boolean;
}

export type TreeKey = "vitality" | "spirit" | "agility" | "wisdom" | "luck" | "will";

export interface ClassDef {
  id: ClassId;
  name: string;
  title: string;
  desc: string;
  hp: number;
  str: number;
  dex: number;
  int: number;
  crit: number;
  lock: number;
  spd: number;
  atkCd: number;
  range: number;
  ranged: boolean;
  color: string;
  accent: string;
  unlockText: string;
  isUnlocked: (m: MetaState) => boolean;
}

export interface ShopInfo {
  potionCost: number;
  weaponCost: number;
  armorCost: number;
  healCost: number;
}

export interface Equipment {
  weapon: GameItem | null;
  offhand: GameItem | null;
  armor: GameItem | null;
  ring: GameItem | null;
  cloak: GameItem | null;
  belt: GameItem | null;
}

export interface HudData {
  hp: number;
  maxHp: number;
  xp: number;
  xpNeed: number;
  level: number;
  floor: number;
  maxFloor: number;
  gold: number;
  souls: number;
  str: number;
  dex: number;
  int: number;
  crit: number;
  lock: number;
  eStr: number;
  eDex: number;
  eInt: number;
  keys: number;
  picks: number;
  bag: GameItem[];
  belt: (GameItem | null)[];
  beltSize: number;
  equipment: Equipment;
  wpnPower: number;
  wpnSpeed: number;
  wpnRange: number;
  wpnCrit: number;
  wpnRanged: boolean;
  wpnTwoHanded: boolean;
  rageT: number;
  skinT: number;
  critPct: number;
  armorPts: number;
  speedPct: number;
  poisonT: number;
  pendingPoints: number;
  modal: "none" | "levelup" | "merchant" | "inventory" | "stairs";
  paused: boolean;
  kills: number;
  chests: number;
  cls: ClassId;
  shop: ShopInfo;
  boss: { name: string; hp: number; maxHp: number } | null;
  hint: { text: string; id: number } | null;
  timeSec: number;
}

export interface RunSummary {
  victory: boolean;
  floor: number;
  kills: number;
  soulsEarned: number;
  soulsBanked: number;
  chests: number;
  gold: number;
  timeSec: number;
  newUnlocks: string[];
  bossFloors: number[];
  totalSouls: number;
}

export type EngineEvent = { t: "death" | "victory"; summary: RunSummary };

export interface EngineCallbacks {
  onHud: () => void;
  onEvent: (e: EngineEvent) => void;
  onFatal?: (msg: string) => void;
}
