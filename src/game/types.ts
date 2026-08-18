import type { GameItem } from "./items";

export type ClassId = "knight" | "thief" | "mage";
export type TreeKey = "vitality" | "spirit" | "agility" | "wisdom" | "luck" | "will";

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

export interface Alloc {
  str: number;
  dex: number;
  int: number;
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

export interface ShopInfo {
  potionCost: number;
  weaponCost: number;
  armorCost: number;
  healCost: number;
}

export interface Equipment {
  weapon: GameItem | null;
  armor: GameItem | null;
  ring: GameItem | null;
  cloak: GameItem | null;
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
  potions: number;
  str: number;
  dex: number;
  int: number;
  eStr: number;
  eDex: number;
  eInt: number;
  keys: number;
  picks: number;
  bag: GameItem[];
  equipment: Equipment;
  wpnPower: number;
  wpnSpeed: number;
  wpnRange: number;
  wpnCrit: number;
  wpnRanged: boolean;
  critPct: number;
  armorPts: number;
  speedPct: number;
  poisonT: number;
  pendingPoints: number;
  modal: "none" | "levelup" | "merchant" | "inventory";
  paused: boolean;
  kills: number;
  chests: number;
  cls: ClassId;
  shop: ShopInfo;
  boss: { name: string; hp: number; maxHp: number } | null;
  hint: { text: string; id: number } | null;
  timeSec: number;
}

export type EngineEvent =
  | { t: "death"; summary: RunSummary }
  | { t: "victory"; summary: RunSummary };

export interface EngineCallbacks {
  onHud: () => void;
  onEvent: (e: EngineEvent) => void;
  onFatal?: (msg: string) => void;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  title: string;
  desc: string;
  hp: number;
  str: number;
  dex: number;
  int: number;
  atkCd: number;
  range: number;
  ranged: boolean;
  color: string;
  accent: string;
  unlockText: string;
  isUnlocked: (m: MetaState) => boolean;
}

export const TILE = 32;
export const MAP_W = 40;
export const MAP_H = 40;
export const FINAL_FLOOR = 20;
