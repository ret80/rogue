/* ── Предметы, редкости, генерация лута ─────────────────────── */

export type Rarity = 0 | 1 | 2 | 3 | 4;

export const RARITY_NAMES = ["Обычный", "Необычный", "Редкий", "Эпический", "Легендарный"];
export const RARITY_COLORS = ["#c9d4e4", "#7ed957", "#5a9cff", "#b98cff", "#ffd166"];
export const RARITY_MULT = [1, 1.5, 2.2, 3.1, 4.6];

export type Slot = "weapon" | "armor" | "ring" | "cloak";
export type WeaponType = "knife" | "axe" | "sword" | "bow" | "crossbow" | "shield" | "staff";

export const WEAPON_TYPE_NAMES: Record<WeaponType, string> = {
  knife: "Нож",
  axe: "Топор",
  sword: "Меч",
  bow: "Лук",
  crossbow: "Арбалет",
  shield: "Щит",
  staff: "Жезл",
};

interface WeaponBase {
  type: WeaponType;
  base: number; // базовый урон
  speed: number; // множитель темпа (меньше = быстрее)
  range: number; // дальность в клетках
  crit: number; // бонус крит-шанса, %
  ranged: boolean;
  armor?: number; // для щита
}

export const WEAPON_BASES: WeaponBase[] = [
  { type: "knife", base: 6, speed: 0.78, range: 1.1, crit: 10, ranged: false },
  { type: "sword", base: 9, speed: 1.0, range: 1.35, crit: 5, ranged: false },
  { type: "axe", base: 13, speed: 1.35, range: 1.2, crit: 3, ranged: false },
  { type: "bow", base: 7, speed: 0.9, range: 5.2, crit: 6, ranged: true },
  { type: "crossbow", base: 11, speed: 1.35, range: 6.2, crit: 4, ranged: true },
  { type: "shield", base: 4, speed: 1.05, range: 1.1, crit: 0, ranged: false, armor: 10 },
  { type: "staff", base: 8, speed: 0.95, range: 5.0, crit: 4, ranged: true },
];

interface GearBase {
  slot: Slot;
  base: number;
  stat?: "str" | "dex" | "int" | "crit" | "speed";
  name: string;
}

export const GEAR_BASES: GearBase[] = [
  { slot: "armor", base: 8, name: "Доспех" },
  { slot: "armor", base: 6, stat: "str", name: "Латы" },
  { slot: "ring", base: 3, stat: "str", name: "Кольцо силы" },
  { slot: "ring", base: 3, stat: "dex", name: "Кольцо ловкости" },
  { slot: "ring", base: 3, stat: "int", name: "Кольцо разума" },
  { slot: "ring", base: 2, stat: "crit", name: "Кольцо удачи" },
  { slot: "cloak", base: 3, stat: "speed", name: "Плащ" },
  { slot: "cloak", base: 3, stat: "dex", name: "Мантия тени" },
  { slot: "cloak", base: 3, stat: "int", name: "Мантия мудреца" },
];

export interface GameItem {
  uid: number;
  slot: Slot;
  weaponType?: WeaponType;
  name: string;
  rarity: Rarity;
  power: number; // урон (оружие) / броня (доспех) / бонус (прочее)
  speed: number;
  range: number;
  crit: number;
  ranged: boolean;
  armor: number;
  stat: { str: number; dex: number; int: number; crit: number; speed: number };
  color: string;
}

let UID = 1;

function rollRarity(floor: number, rnd: () => number): Rarity {
  const leg = 0.01 + floor * 0.004;
  const epic = 0.03 + floor * 0.009;
  const rare = 0.09 + floor * 0.016;
  const unc = 0.26 + floor * 0.02;
  const r = rnd();
  if (r < leg) return 4;
  if (r < leg + epic) return 3;
  if (r < leg + epic + rare) return 2;
  if (r < leg + epic + rare + unc) return 1;
  return 0;
}

const scale = (base: number, rarity: Rarity, floor: number) =>
  Math.max(1, Math.round(base * RARITY_MULT[rarity] * (1 + (floor - 1) * 0.05)));

export function makeWeapon(type: WeaponType, rarity: Rarity, floor: number): GameItem {
  const b = WEAPON_BASES.find((w) => w.type === type)!;
  const power = scale(b.base, rarity, floor);
  return {
    uid: UID++,
    slot: "weapon",
    weaponType: type,
    name: WEAPON_TYPE_NAMES[type],
    rarity,
    power,
    speed: b.speed,
    range: b.range,
    crit: b.crit,
    ranged: b.ranged,
    armor: b.armor ?? 0,
    stat: { str: 0, dex: 0, int: 0, crit: 0, speed: 0 },
    color: RARITY_COLORS[rarity],
  };
}

export function makeGear(slot: Slot, rarity: Rarity, floor: number, rnd: () => number): GameItem {
  const options = GEAR_BASES.filter((g) => g.slot === slot);
  const b = options[Math.floor(rnd() * options.length)];
  const power = scale(b.base, rarity, floor);
  const stat = { str: 0, dex: 0, int: 0, crit: 0, speed: 0 };
  if (slot === "ring" || slot === "cloak") {
    const key = b.stat ?? "str";
    if (key === "crit") stat.crit = Math.round(power / 2);
    else if (key === "speed") stat.speed = Math.round(power) / 10;
    else stat[key] = Math.max(1, Math.round(power / 3));
  }
  return {
    uid: UID++,
    slot,
    name: b.name,
    rarity,
    power: slot === "armor" ? power : 0,
    speed: 1,
    range: 0,
    crit: 0,
    ranged: false,
    armor: slot === "armor" ? power : 0,
    stat,
    color: RARITY_COLORS[rarity],
  };
}

export function randomWeaponType(rnd: () => number): WeaponType {
  const pool: WeaponType[] = ["knife", "sword", "axe", "bow", "crossbow", "shield"];
  return pool[Math.floor(rnd() * pool.length)];
}

/* Случайный предмет: оружие или экипировка */
export function generateItem(floor: number, rnd: () => number): GameItem {
  const rarity = rollRarity(floor, rnd);
  if (rnd() < 0.55) {
    return makeWeapon(randomWeaponType(rnd), rarity, floor);
  }
  const slots: Slot[] = ["armor", "ring", "cloak"];
  const slot = slots[Math.floor(rnd() * slots.length)];
  return makeGear(slot, rarity, floor, rnd);
}

/* Стартовое оружие класса */
export function startingWeapon(cls: "knight" | "thief" | "mage"): GameItem {
  const type: WeaponType = cls === "knight" ? "sword" : cls === "thief" ? "knife" : "staff";
  return makeWeapon(type, 0, 1);
}

/* Сводная строка описания предмета */
export function itemDesc(it: GameItem): string {
  const parts: string[] = [];
  if (it.slot === "weapon") {
    parts.push(`урон ${it.power}`);
    parts.push(`темп ×${it.speed.toFixed(2)}`);
    if (it.ranged) parts.push(`дальн. ${it.range}`);
    if (it.crit) parts.push(`крит +${it.crit}%`);
    if (it.armor) parts.push(`броня +${it.armor}`);
  } else if (it.slot === "armor") {
    parts.push(`броня +${it.power}`);
  } else {
    const s = it.stat;
    if (s.str) parts.push(`сила +${s.str}`);
    if (s.dex) parts.push(`ловк. +${s.dex}`);
    if (s.int) parts.push(`инт. +${s.int}`);
    if (s.crit) parts.push(`крит +${s.crit}%`);
    if (s.speed) parts.push(`скор. +${Math.round(s.speed * 100)}%`);
  }
  return parts.join(" · ");
}

export const SLOT_NAMES: Record<Slot, string> = {
  weapon: "Оружие",
  armor: "Доспех",
  ring: "Кольцо",
  cloak: "Плащ",
};
