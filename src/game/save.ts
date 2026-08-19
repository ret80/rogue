import type { ClassDef, MetaState, TreeKey } from "./types";

const KEY = "retro_souls_save_v1";

export function defaultMeta(): MetaState {
  return {
    souls: 0,
    tree: { vitality: 0, spirit: 0, agility: 0, wisdom: 0, luck: 0, will: 0 },
    chests: 0,
    bossesKilled: [],
    bestFloor: 0,
    kills: 0,
    runs: 0,
    muted: false,
  };
}

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultMeta();
    const d = JSON.parse(raw);
    const base = defaultMeta();
    return {
      ...base,
      ...d,
      tree: { ...base.tree, ...(d.tree ?? {}) },
      bossesKilled: Array.isArray(d.bossesKilled) ? d.bossesKilled : [],
    };
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(m: MetaState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* quota — ignore */
  }
}

export function resetMeta() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* ── Древо Душ ─────────────────────────────────────────────── */

export interface TreeDef {
  key: TreeKey;
  name: string;
  per: string;
  max: number;
  cost: (lvl: number) => number;
  color: string;
}

export const TREE_DEFS: TreeDef[] = [
  { key: "vitality", name: "Живучесть", per: "+6 к макс. HP за уровень", max: 10, cost: (l) => 50 + 20 * l, color: "#e8434f" },
  { key: "spirit", name: "Сила духа", per: "+1 к Силе за уровень", max: 10, cost: (l) => 60 + 25 * l, color: "#ff9d3d" },
  { key: "agility", name: "Сноровка", per: "+1 к Ловкости за уровень", max: 10, cost: (l) => 60 + 25 * l, color: "#46f0c8" },
  { key: "wisdom", name: "Мудрость", per: "+1 к Интеллекту за уровень", max: 10, cost: (l) => 60 + 25 * l, color: "#b98cff" },
  { key: "luck", name: "Удача", per: "+2% крит. шанс, +8% золота", max: 10, cost: (l) => 80 + 30 * l, color: "#ffd166" },
  { key: "will", name: "Воля", per: "+3% скорость хода и атаки", max: 10, cost: (l) => 100 + 40 * l, color: "#7db4ff" },
];

export const TOTAL_TREE_COST = TREE_DEFS.reduce(
  (acc, d) => acc + Array.from({ length: d.max }, (_, i) => d.cost(i)).reduce((a, b) => a + b, 0),
  0
);

/* ── Классы ────────────────────────────────────────────────── */

export const CLASS_DEFS: ClassDef[] = [
  {
    id: "knight",
    name: "РЫЦАРЬ",
    title: "Страж Пепла",
    desc: "Тяжёлая броня и широкий меч. Бьёт медленно, но верно, держит удар там, где другие падают.",
    hp: 120,
    str: 12,
    dex: 8,
    int: 4,
    atkCd: 0.85,
    range: 1.3,
    ranged: false,
    color: "#c9d4e4",
    accent: "#ff9d3d",
    unlockText: "Доступен всегда",
    isUnlocked: () => true,
  },
  {
    id: "thief",
    name: "ВОР",
    title: "Тень Склепа",
    desc: "Кинжалы, скорость и критические удары. Хрупок, но враги умирают раньше, чем замечают его.",
    hp: 92,
    str: 8,
    dex: 14,
    int: 5,
    atkCd: 0.52,
    range: 1.08,
    ranged: false,
    color: "#9be88a",
    accent: "#46f0c8",
    unlockText: "Откройте 10 сундуков за любые забеги",
    isUnlocked: (m) => m.chests >= 10,
  },
  {
    id: "mage",
    name: "МАГ",
    title: "Проводник Пустоты",
    desc: "Разит душевными сгустками сквозь весь зал. Держит дистанцию и испепеляет интеллектом.",
    hp: 82,
    str: 5,
    dex: 9,
    int: 14,
    atkCd: 0.9,
    range: 5.4,
    ranged: true,
    color: "#cdb2ff",
    accent: "#b98cff",
    unlockText: "Победите Гигантского Паука (этаж 5)",
    isUnlocked: (m) => m.bossesKilled.includes(5),
  },
];

export function classDef(id: string): ClassDef {
  return CLASS_DEFS.find((c) => c.id === id) ?? CLASS_DEFS[0];
}
