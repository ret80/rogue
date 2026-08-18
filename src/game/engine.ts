import { Sfx } from "./audio";
import {
  generateDungeon,
  mulberry32,
  tileX,
  tileY,
  T_FLOOR,
  T_STAIRS,
  T_TRAP,
  T_WALL,
  type DungeonData,
} from "./dungeon";
import { classDef } from "./save";
import {
  FINAL_FLOOR,
  MAP_H,
  MAP_W,
  TILE,
  type Alloc,
  type ClassId,
  type EngineCallbacks,
  type HudData,
  type MetaState,
  type RunSummary,
} from "./types";

/* ───────────────────────── определения врагов ───────────────────────── */

export type EnemyKind =
  | "rat" | "slime" | "slimeSmall" | "skeleton" | "spider" | "archer"
  | "necromancer" | "golem" | "banshee"
  | "bossSpider" | "bossGolem" | "bossNecro" | "bossSoul";

interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number; dmg: number; spd: number; range: number; cd: number;
  exp: number; souls: number; r: number; color: string;
  coward?: boolean; ranged?: boolean; splits?: boolean; shieldFront?: boolean;
  poison?: boolean; summoner?: boolean; knockback?: boolean; phasing?: boolean;
  boss?: boolean; minFloor: number; weight: number;
}

const ENEMIES: Record<EnemyKind, EnemyDef> = {
  rat:         { kind: "rat", name: "Крыса", hp: 20, dmg: 5, spd: 3.5, range: 1.0, cd: 0.8, exp: 8, souls: 2, r: 9, color: "#8a8f9c", minFloor: 1, weight: 10 },
  slime:       { kind: "slime", name: "Слизь", hp: 40, dmg: 8, spd: 1.5, range: 1.2, cd: 1.2, exp: 12, souls: 3, r: 12, color: "#7ed957", splits: true, minFloor: 1, weight: 8 },
  slimeSmall:  { kind: "slimeSmall", name: "Слизёныш", hp: 15, dmg: 5, spd: 2.3, range: 1.0, cd: 1.0, exp: 5, souls: 1, r: 8, color: "#9be88a", minFloor: 1, weight: 0 },
  skeleton:    { kind: "skeleton", name: "Скелет", hp: 55, dmg: 12, spd: 2.8, range: 1.25, cd: 1.0, exp: 16, souls: 4, r: 11, color: "#e9e2cf", shieldFront: true, minFloor: 3, weight: 8 },
  spider:      { kind: "spider", name: "Паук", hp: 45, dmg: 10, spd: 3.2, range: 1.3, cd: 1.5, exp: 15, souls: 4, r: 11, color: "#6d5a8f", poison: true, minFloor: 3, weight: 7 },
  archer:      { kind: "archer", name: "Гоблин-лучник", hp: 50, dmg: 10, spd: 3.0, range: 4.6, cd: 1.8, exp: 18, souls: 5, r: 11, color: "#7fb069", coward: true, ranged: true, minFloor: 6, weight: 7 },
  necromancer: { kind: "necromancer", name: "Некромант", hp: 70, dmg: 8, spd: 2.2, range: 5.0, cd: 2.0, exp: 26, souls: 8, r: 12, color: "#b98cff", ranged: true, summoner: true, minFloor: 8, weight: 5 },
  golem:       { kind: "golem", name: "Каменный голем", hp: 180, dmg: 22, spd: 1.5, range: 1.6, cd: 2.5, exp: 40, souls: 12, r: 17, color: "#8d99a6", knockback: true, minFloor: 11, weight: 4 },
  banshee:     { kind: "banshee", name: "Баньши", hp: 80, dmg: 15, spd: 3.8, range: 1.5, cd: 1.2, exp: 30, souls: 10, r: 12, color: "#7df5d8", phasing: true, minFloor: 12, weight: 4 },
  bossSpider:  { kind: "bossSpider", name: "ГИГАНТСКИЙ ПАУК", hp: 460, dmg: 18, spd: 3.0, range: 1.6, cd: 1.3, exp: 120, souls: 70, r: 24, color: "#8a63c9", poison: true, boss: true, minFloor: 5, weight: 0 },
  bossGolem:   { kind: "bossGolem", name: "ГОЛЕМ-ВЛАДЫКА", hp: 950, dmg: 30, spd: 1.7, range: 1.8, cd: 2.2, exp: 220, souls: 120, r: 28, color: "#a8b4c2", knockback: true, boss: true, minFloor: 10, weight: 0 },
  bossNecro:   { kind: "bossNecro", name: "ПОВЕЛИТЕЛЬ КОСТЕЙ", hp: 780, dmg: 20, spd: 2.4, range: 5.5, cd: 1.6, exp: 320, souls: 180, r: 24, color: "#cdb2ff", ranged: true, summoner: true, coward: true, boss: true, minFloor: 15, weight: 0 },
  bossSoul:    { kind: "bossSoul", name: "ПОЖИРАТЕЛЬ ДУШ", hp: 1350, dmg: 34, spd: 3.4, range: 1.7, cd: 1.1, exp: 500, souls: 350, r: 30, color: "#46f0c8", phasing: true, summoner: true, boss: true, minFloor: 20, weight: 0 },
};

const BOSS_FLOORS: Record<number, EnemyKind> = { 5: "bossSpider", 10: "bossGolem", 15: "bossNecro", 20: "bossSoul" };

/* ───────────────────────── сущности ───────────────────────── */

type EntKind = "enemy" | "barrel" | "chest" | "item" | "proj" | "corpse";

interface Ent {
  id: number;
  kind: EntKind;
  x: number; y: number; vx: number; vy: number; r: number;
  hp: number; maxHp: number;
  seed: number;
  def?: EnemyDef;
  state?: "idle" | "chase" | "attack" | "flee";
  timer?: number; atkCd?: number; wanderX?: number; wanderY?: number;
  facing?: number; summonCd?: number; teleCd?: number;
  flash?: number; dead?: boolean;
  opened?: boolean;
  itemType?: "potion" | "gold";
  from?: "player" | "enemy"; dmg?: number; ttl?: number; magic?: boolean;
  ttlMax?: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  grav?: number; glow?: boolean;
}

interface Floater {
  x: number; y: number; text: string; color: string;
  life: number; max: number; big?: boolean;
}

/* ───────────────────────── движок ───────────────────────── */

export interface EngineSetup {
  cls: ClassId;
  alloc: Alloc;
  meta: MetaState;
}

let NEXT_ID = 1;

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private minimap: HTMLCanvasElement | null = null;
  private sfx: Sfx;
  private cb: EngineCallbacks;
  private setup: EngineSetup;

  private raf = 0;
  private lastT = 0;
  private destroyed = false;

  private viewW = 800;
  private viewH = 600;
  private dpr = 1;
  private scale = 1;

  private floor = 1;
  private dungeon!: DungeonData;
  private rng: () => number = Math.random;
  private mapCanvas!: HTMLCanvasElement;
  private fogCanvas!: HTMLCanvasElement;
  private seen = new Uint8Array(MAP_W * MAP_H);
  private lastVisTile = -1;
  private trapAnim = new Map<number, number>();

  private ents: Ent[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];

  private player = {
    x: 0, y: 0, vx: 0, vy: 0, r: 11,
    hp: 100, maxHp: 100, xp: 0, level: 1,
    str: 10, dex: 10, int: 10, freePoints: 0,
    weapon: 0, armor: 0, gold: 0, souls: 0, potions: 1,
    poisonT: 0, poisonDps: 0,
    atkCd: 0, swingT: 0, facing: 0, moving: false,
    stepPhase: 0, invulnT: 0,
  };
  private path: number[] = [];
  private moveTarget: { x: number; y: number } | null = null;
  private pendingInteract: Ent | null = null;
  private holding = false;

  private cam = { x: 0, y: 0 };
  private shake = 0;
  private flashRed = 0;
  private flashTeal = 0;
  private transT = 0;

  private kills = 0;
  private chestsRun = 0;
  private bossesDown: number[] = [];
  private time = 0;
  private hint: { text: string; id: number } | null = null;
  private hintId = 0;

  modal: "none" | "levelup" | "merchant" | "pause" = "none";
  private over = false;
  private victory = false;
  private endTimer = -1;
  private emitted = false;

  private resizeObs: ResizeObserver | null = null;
  private onResize = () => this.resize();
  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "p" || e.key === "P" || e.key === "з" || e.key === "З") {
      if (!this.over) this.togglePause();
    }
  };

  constructor(canvas: HTMLCanvasElement, setup: EngineSetup, sfx: Sfx, cb: EngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.setup = setup;
    this.sfx = sfx;
    this.cb = cb;

    const c = classDef(setup.cls);
    const t = setup.meta.tree;
    const p = this.player;
    p.str = c.str + setup.alloc.str + t.spirit;
    p.dex = c.dex + setup.alloc.dex + t.agility;
    p.int = c.int + setup.alloc.int + t.wisdom;
    p.maxHp = Math.round((c.hp + t.vitality * 6) * 1);
    p.hp = p.maxHp;
    if (setup.cls === "knight") p.armor = 1;

    this.resize();
    window.addEventListener("resize", this.onResize);
    this.resizeObs = new ResizeObserver(this.onResize);
    if (canvas.parentElement) this.resizeObs.observe(canvas.parentElement);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("contextmenu", this.onCtx);
    window.addEventListener("keydown", this.onKey);

    this.startFloor(1, true);
    this.sfx.startDrone();
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      this.update(dt);
      this.render(t / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /* ── lifecycle ── */

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.resizeObs?.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
    window.removeEventListener("keydown", this.onKey);
    this.sfx.stopDrone();
  }

  attachMinimap(el: HTMLCanvasElement | null) {
    this.minimap = el;
  }

  private resize() {
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = w;
    this.viewH = h;
    this.canvas.width = Math.max(1, Math.round(w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(h * this.dpr));
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.scale = Math.min(1.4, Math.max(0.72, Math.min(w / 860, h / 640)));
  }

  /* ── floors ── */

  private startFloor(floor: number, first = false) {
    this.floor = floor;
    this.rng = mulberry32(this.setup.meta.runs * 1013 + floor * 7919 + 17);
    this.dungeon = generateDungeon(this.setup.meta.runs * 1013 + 9973, floor);
    this.seen = new Uint8Array(MAP_W * MAP_H);
    this.lastVisTile = -1;
    this.trapAnim.clear();
    this.ents = [];
    this.particles = [];
    this.floaters = [];
    this.path = [];
    this.pendingInteract = null;
    this.moveTarget = null;

    const p = this.player;
    p.x = (tileX(this.dungeon.spawnIdx) + 0.5) * TILE;
    p.y = (tileY(this.dungeon.spawnIdx) + 0.5) * TILE;
    p.vx = 0; p.vy = 0;
    this.cam.x = p.x; this.cam.y = p.y;

    this.prerenderMap();
    this.spawnContents();
    this.updateVisibility();

    if (!first) {
      this.transT = 1;
      this.sfx.stairs();
      this.showHint(`ЭТАЖ ${floor} · ${floor >= FINAL_FLOOR ? "ФИНАЛ" : this.bossKind() ? "ЛОГОВО БОССА" : ""}`.trim());
    } else {
      this.showHint("Кликните по полу, чтобы идти · Атака — автоматически");
    }
    this.pushHud();
  }

  private bossKind(): EnemyKind | null {
    return BOSS_FLOORS[this.floor] ?? null;
  }

  private floorMult() {
    const f = this.floor;
    return {
      hp: 1 + (f - 1) * 0.12,
      dmg: 1 + (f - 1) * 0.12,
      spd: 1 + (f - 1) * 0.02,
      exp: 1 + (f - 1) * 0.15,
    };
  }

  private spawnContents() {
    const rooms = this.dungeon.rooms;
    const m = this.floorMult();
    const spawnRoom = rooms[0];
    const stairsRoom = rooms.reduce((a, b) =>
      Math.hypot(b.cx - spawnRoom.cx, b.cy - spawnRoom.cy) > Math.hypot(a.cx - spawnRoom.cx, a.cy - spawnRoom.cy) ? b : a
    );

    let enemyCount = 0;
    const maxEnemies = Math.min(26, 6 + this.floor * 2);
    let chests = 0;

    const pool = Object.values(ENEMIES).filter((d) => d.minFloor <= this.floor && d.weight > 0);
    const totalW = pool.reduce((a, d) => a + d.weight, 0);
    const pickKind = (): EnemyDef => {
      let roll = this.rng() * totalW;
      for (const d of pool) {
        roll -= d.weight;
        if (roll <= 0) return d;
      }
      return pool[0];
    };

    for (const room of rooms) {
      if (room === spawnRoom) continue;
      const isStairsRoom = room === stairsRoom;

      // объекты
      const spots = 2 + Math.floor(this.rng() * 3) + (room.w * room.h > 24 ? 1 : 0);
      for (let i = 0; i < spots; i++) {
        const pos = this.randomRoomSpot(room);
        if (!pos) continue;
        const roll = this.rng();
        if (roll < 0.30 && this.countKind("barrel") < 24) {
          this.ents.push(this.makeEnt("barrel", pos.x, pos.y, { hp: 20, r: 13 }));
        } else if ((roll < 0.46 || chests < 2) && chests < 6) {
          this.ents.push(this.makeEnt("chest", pos.x, pos.y, { r: 12 }));
          chests++;
        } else if (roll < 0.60) {
          this.ents.push(this.makeEnt("item", pos.x, pos.y, { r: 8, itemType: this.rng() < 0.5 ? "potion" : "gold" }));
        }
      }

      // враги
      if (isStairsRoom) continue;
      const n = 1 + Math.floor(this.rng() * Math.min(3, 1 + this.floor / 4));
      for (let i = 0; i < n; i++) {
        if (enemyCount >= maxEnemies) break;
        const pos = this.randomRoomSpot(room);
        if (!pos) continue;
        this.spawnEnemy(pickKind(), pos.x, pos.y, m);
        enemyCount++;
      }
    }

    // гарантированные сундуки
    while (chests < 2) {
      const room = rooms[1 + Math.floor(this.rng() * (rooms.length - 1))];
      const pos = this.randomRoomSpot(room);
      if (pos) {
        this.ents.push(this.makeEnt("chest", pos.x, pos.y, { r: 12 }));
        chests++;
      } else break;
    }

    // босс охраняет лестницу
    const bk = this.bossKind();
    if (bk) {
      const def = ENEMIES[bk];
      const e = this.spawnEnemy(def, (tileX(this.dungeon.stairsIdx) + 0.5) * TILE, (tileY(this.dungeon.stairsIdx) + 0.5) * TILE, m, true);
      e.state = "idle";
      this.sfx.roar();
      this.shakeIt(8);
      this.showHint(`БОСС: ${def.name}`);
    }

    // торговец
    if (this.dungeon.merchantIdx !== null) {
      const e = this.makeEnt("item", (tileX(this.dungeon.merchantIdx) + 0.5) * TILE, (tileY(this.dungeon.merchantIdx) + 0.5) * TILE, { r: 13 });
      e.itemType = undefined;
      e.kind = "item";
      (e as Ent & { merchant?: boolean }).merchant = true;
      this.ents.push(e);
    }
  }

  private countKind(kind: EntKind) {
    let n = 0;
    for (const e of this.ents) if (e.kind === kind && !e.dead) n++;
    return n;
  }

  private randomRoomSpot(room: { x: number; y: number; w: number; h: number }) {
    for (let t = 0; t < 10; t++) {
      const tx = room.x + 1 + Math.floor(this.rng() * Math.max(1, room.w - 2));
      const ty = room.y + 1 + Math.floor(this.rng() * Math.max(1, room.h - 2));
      const i = ty * MAP_W + tx;
      const tile = this.dungeon.tiles[i];
      if ((tile === T_FLOOR || tile === T_TRAP) && i !== this.dungeon.spawnIdx) {
        return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
      }
    }
    return null;
  }

  private makeEnt(kind: EntKind, x: number, y: number, extra: Partial<Ent> = {}): Ent {
    return {
      id: NEXT_ID++, kind, x, y, vx: 0, vy: 0, r: 10,
      hp: 1, maxHp: 1, seed: this.rng() * 1000, ...extra,
    };
  }

  private spawnEnemy(def: EnemyDef, x: number, y: number, m: ReturnType<Engine["floorMult"]>, isBoss = false): Ent {
    const hp = Math.round(def.hp * m.hp * (isBoss ? 1 : 1));
    const e = this.makeEnt("enemy", x, y, {
      r: def.r, hp, maxHp: hp, def,
      state: "idle", timer: 1 + this.rng() * 2, atkCd: 0,
      facing: this.rng() * Math.PI * 2,
      summonCd: def.summoner ? 8 : undefined,
      teleCd: def.phasing ? 6 : undefined,
    });
    this.ents.push(e);
    return e;
  }

  /* ── input ── */

  private onCtx = (e: Event) => e.preventDefault();

  private screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - this.viewW / 2) / this.scale + this.cam.x,
      y: (sy - this.viewH / 2) / this.scale + this.cam.y,
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    this.sfx.unlock();
    if (this.over || this.modal !== "none") return;
    this.holding = true;
    this.handlePointer(e);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.holding || this.over || this.modal !== "none") return;
    this.handlePointer(e, true);
  };

  private onPointerUp = () => {
    this.holding = false;
  };

  private handlePointer(e: PointerEvent, drag = false) {
    const rect = this.canvas.getBoundingClientRect();
    const w = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const p = this.player;

    if (!drag) {
      // интерактивные объекты под кликом
      for (const ent of this.ents) {
        if (ent.dead || ent.kind === "proj" || ent.kind === "corpse") continue;
        const merchant = (ent as Ent & { merchant?: boolean }).merchant;
        if (ent.kind === "chest" && ent.opened) continue;
        if (ent.kind !== "chest" && !merchant) continue;
        const d = Math.hypot(ent.x - w.x, ent.y - w.y);
        if (d < Math.max(24, ent.r + 10)) {
          const dp = Math.hypot(ent.x - p.x, ent.y - p.y);
          if (dp < TILE * 1.7) {
            if (merchant) this.openMerchant();
            else this.openChest(ent);
            return;
          }
          this.pendingInteract = ent;
          this.setDestination(ent.x, ent.y, true);
          return;
        }
      }
    }
    this.pendingInteract = null;
    this.setDestination(w.x, w.y, false);
  }

  private setDestination(wx: number, wy: number, nearEntity: boolean) {
    let tx = Math.floor(wx / TILE);
    let ty = Math.floor(wy / TILE);
    tx = Math.max(0, Math.min(MAP_W - 1, tx));
    ty = Math.max(0, Math.min(MAP_H - 1, ty));
    // ищем ближайшую проходимую клетку
    if (!this.walkable(tx, ty)) {
      outer: for (let rad = 1; rad <= 4; rad++) {
        for (let dy = -rad; dy <= rad; dy++)
          for (let dx = -rad; dx <= rad; dx++) {
            if (this.walkable(tx + dx, ty + dy)) {
              tx += dx; ty += dy;
              break outer;
            }
          }
      }
    }
    const p = this.player;
    const fromI = Math.floor(p.y / TILE) * MAP_W + Math.floor(p.x / TILE);
    const toI = ty * MAP_W + tx;
    const path = this.findPath(fromI, toI);
    if (path) {
      this.path = path;
      this.moveTarget = nearEntity
        ? { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }
        : { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
      this.spawnClickRing(this.moveTarget.x, this.moveTarget.y);
    } else if (!nearEntity) {
      this.moveTarget = null;
      this.path = [];
    }
  }

  private spawnClickRing(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.addParticle({
        x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 10,
        vx: Math.cos(a) * 18, vy: Math.sin(a) * 18,
        life: 0.3, max: 0.3, size: 2, color: "#ffd166",
      });
    }
  }

  private walkable(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    const t = this.dungeon.tiles[ty * MAP_W + tx];
    return t === T_FLOOR || t === T_STAIRS || t === T_TRAP;
  }

  private findPath(fromI: number, toI: number): number[] | null {
    if (fromI === toI) return [];
    if (!this.walkable(toI % MAP_W, Math.floor(toI / MAP_W))) return null;
    const prev = new Int32Array(MAP_W * MAP_H).fill(-1);
    const visited = new Uint8Array(MAP_W * MAP_H);
    const q = new Int32Array(MAP_W * MAP_H);
    let head = 0;
    let tail = 0;
    q[tail++] = fromI;
    visited[fromI] = 1;
    while (head < tail) {
      const cur = q[head++];
      if (cur === toI) break;
      const cx = cur % MAP_W;
      const cy = Math.floor(cur / MAP_W);
      const nbs = [cur - 1, cur + 1, cur - MAP_W, cur + MAP_W];
      const nxc = [cx - 1, cx + 1, cx, cx];
      const nyc = [cy, cy, cy - 1, cy + 1];
      for (let k = 0; k < 4; k++) {
        const n = nbs[k];
        if (nxc[k] < 0 || nyc[k] < 0 || nxc[k] >= MAP_W || nyc[k] >= MAP_H) continue;
        if (visited[n] || !this.walkable(nxc[k], nyc[k])) continue;
        visited[n] = 1;
        prev[n] = cur;
        q[tail++] = n;
      }
    }
    if (!visited[toI]) return null;
    const path: number[] = [];
    let c = toI;
    while (c !== fromI && c >= 0) {
      path.push(c);
      c = prev[c];
    }
    path.reverse();
    return path;
  }

  /* ── public UI actions ── */

  togglePause() {
    if (this.modal === "pause") {
      this.modal = "none";
    } else if (this.modal === "none") {
      this.modal = "pause";
      this.sfx.click();
    }
    this.pushHud();
  }

  usePotion() {
    const p = this.player;
    if (this.over) return;
    if (p.potions <= 0 || p.hp >= p.maxHp) {
      this.sfx.error();
      return;
    }
    p.potions--;
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.5));
    this.sfx.potion();
    this.burst(p.x, p.y, "#7ed957", 14, 90);
    this.addFloater(p.x, p.y - 16, `+${Math.round(p.maxHp * 0.5)}`, "#7ed957");
    this.pushHud();
  }

  applyAlloc(a: Alloc) {
    const p = this.player;
    const sum = a.str + a.dex + a.int;
    if (sum <= 0 || sum > p.freePoints) {
      this.sfx.error();
      return;
    }
    p.str += a.str; p.dex += a.dex; p.int += a.int;
    p.freePoints -= sum;
    this.sfx.click();
    if (p.freePoints <= 0) {
      this.modal = "none";
      this.sfx.levelup();
    }
    this.pushHud();
  }

  shopCosts() {
    const p = this.player;
    return {
      potionCost: 30,
      whetCost: 75 + 35 * p.weapon,
      armorCost: 90 + 40 * p.armor,
      healCost: 45,
    };
  }

  buyItem(item: "potion" | "whet" | "armor" | "heal") {
    const p = this.player;
    const c = this.shopCosts();
    const cost = item === "potion" ? c.potionCost : item === "whet" ? c.whetCost : item === "armor" ? c.armorCost : c.healCost;
    if (p.gold < cost) {
      this.sfx.error();
      this.showHint("Недостаточно золота");
      return;
    }
    if (item === "potion" && p.potions >= 6) {
      this.sfx.error();
      this.showHint("Фляги полны (макс. 6)");
      return;
    }
    if (item === "heal" && p.hp >= p.maxHp) {
      this.sfx.error();
      return;
    }
    p.gold -= cost;
    if (item === "potion") { p.potions++; this.addFloater(p.x, p.y - 16, "+1 ФЛЯГА", "#7ed957"); }
    if (item === "whet") { p.weapon++; this.addFloater(p.x, p.y - 16, `ОРУЖИЕ +${p.weapon}`, "#ff9d3d"); }
    if (item === "armor") { p.armor++; this.addFloater(p.x, p.y - 16, `БРОНЯ +${p.armor}`, "#7db4ff"); }
    if (item === "heal") { p.hp = p.maxHp; this.burst(p.x, p.y, "#7ed957", 16, 100); }
    this.sfx.buy();
    this.pushHud();
  }

  closeMerchant() {
    if (this.modal === "merchant") {
      this.modal = "none";
      this.sfx.click();
      this.pushHud();
    }
  }

  /* ── hud ── */

  private hudTimer = 0;

  private pushHud() {
    this.cb.onHud();
  }

  getHud(): HudData {
    const p = this.player;
    const boss = this.ents.find((e) => e.def?.boss && !e.dead);
    return {
      hp: Math.max(0, Math.round(p.hp)),
      maxHp: p.maxHp,
      xp: Math.round(p.xp),
      xpNeed: this.xpNeed(),
      level: p.level,
      floor: this.floor,
      maxFloor: FINAL_FLOOR,
      gold: p.gold,
      souls: p.souls,
      potions: p.potions,
      str: p.str,
      dex: p.dex,
      int: p.int,
      weapon: p.weapon,
      armor: p.armor,
      poisonT: p.poisonT,
      pendingPoints: p.freePoints,
      modal: this.modal === "levelup" ? "levelup" : this.modal === "merchant" ? "merchant" : "none",
      paused: this.modal === "pause",
      shop: this.shopCosts(),
      boss: boss && boss.def
        ? { name: boss.def.name, hp: Math.max(0, Math.round(boss.hp)), maxHp: boss.maxHp }
        : null,
      hint: this.hint,
      timeSec: Math.floor(this.time),
    };
  }

  private xpNeed() {
    return 100 + this.player.level * this.player.level * 5;
  }

  private showHint(text: string) {
    if (!text) return;
    this.hint = { text, id: ++this.hintId };
    this.pushHud();
  }

  /* ── update ── */

  private update(dt: number) {
    if (this.modal !== "none" || this.over) {
      this.updateFx(dt);
      if (this.over && this.endTimer > 0) {
        this.endTimer -= dt;
        if (this.endTimer <= 0 && !this.emitted) {
          this.emitted = true;
          this.cb.onEvent({ t: this.victory ? "victory" : "death", summary: this.buildSummary() });
        }
      }
      return;
    }

    this.time += dt;
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateEnts(dt);
    this.updateFx(dt);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.12;
      this.pushHud();
    }
  }

  private updateFx(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flashRed = Math.max(0, this.flashRed - dt * 1.8);
    this.flashTeal = Math.max(0, this.flashTeal - dt * 1.4);
    this.transT = Math.max(0, this.transT - dt * 1.6);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pa = this.particles[i];
      pa.life -= dt;
      if (pa.life <= 0) { this.particles.splice(i, 1); continue; }
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
      if (pa.grav) pa.vy += pa.grav * dt;
      pa.vx *= Math.exp(-2.4 * dt);
      pa.vy *= Math.exp(-2.4 * dt);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= 26 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    for (const [k, v] of this.trapAnim) {
      const nv = v - dt * 2.2;
      if (nv <= 0) this.trapAnim.delete(k);
      else this.trapAnim.set(k, nv);
    }
    // камера
    const p = this.player;
    const k = 1 - Math.exp(-8 * dt);
    this.cam.x += (p.x - this.cam.x) * k;
    this.cam.y += (p.y - this.cam.y) * k;
    const half = { x: this.viewW / 2 / this.scale, y: this.viewH / 2 / this.scale };
    const mw = MAP_W * TILE;
    const mh = MAP_H * TILE;
    if (half.x * 2 < mw) this.cam.x = Math.max(half.x, Math.min(mw - half.x, this.cam.x));
    else this.cam.x = mw / 2;
    if (half.y * 2 < mh) this.cam.y = Math.max(half.y, Math.min(mh - half.y, this.cam.y));
    else this.cam.y = mh / 2;
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    if (p.hp <= 0) return;
    const tree = this.setup.meta.tree;
    const c = classDef(this.setup.cls);

    // яд
    if (p.poisonT > 0) {
      p.poisonT -= dt;
      p.hp -= p.poisonDps * dt;
      if (Math.random() < dt * 6) this.addParticle({ x: p.x + (Math.random() - 0.5) * 14, y: p.y, vx: 0, vy: -26, life: 0.6, max: 0.6, size: 3, color: "#7ed957" });
      if (p.hp <= 0) { this.killPlayer(); return; }
    }
    p.invulnT = Math.max(0, p.invulnT - dt);
    p.atkCd = Math.max(0, p.atkCd - dt);
    p.swingT = Math.max(0, p.swingT - dt);

    // движение по пути
    let speed = 3.1 * TILE * (1 + 0.03 * tree.will);
    if (c.id === "thief") speed *= 1.12;
    p.moving = false;

    if (this.path.length > 0) {
      const node = this.path[0];
      const nx = (node % MAP_W + 0.5) * TILE;
      const ny = (Math.floor(node / MAP_W) + 0.5) * TILE;
      const dx = nx - p.x;
      const dy = ny - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 7) {
        this.path.shift();
      } else {
        p.vx = (dx / d) * speed;
        p.vy = (dy / d) * speed;
        p.moving = true;
      }
    } else if (this.moveTarget) {
      const dx = this.moveTarget.x - p.x;
      const dy = this.moveTarget.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) {
        this.moveTarget = null;
        p.vx = 0; p.vy = 0;
      } else {
        p.vx = (dx / d) * speed;
        p.vy = (dy / d) * speed;
        p.moving = true;
      }
    } else {
      p.vx *= Math.exp(-14 * dt);
      p.vy *= Math.exp(-14 * dt);
    }

    // завершение ожидания у цели (сундук/торговец)
    if (this.pendingInteract && this.path.length === 0) {
      const ent = this.pendingInteract;
      const d = Math.hypot(ent.x - p.x, ent.y - p.y);
      if (d < TILE * 1.7 && !ent.dead) {
        const merchant = (ent as Ent & { merchant?: boolean }).merchant;
        if (merchant) this.openMerchant();
        else if (ent.kind === "chest" && !ent.opened) this.openChest(ent);
      }
      this.pendingInteract = null;
      this.moveTarget = null;
    }

    if (p.moving) {
      p.facing = Math.atan2(p.vy, p.vx);
      p.stepPhase += dt * 11;
    }

    this.moveWithCollision(p, dt, false);

    // ловушки
    const ti = Math.floor(p.y / TILE) * MAP_W + Math.floor(p.x / TILE);
    if (this.dungeon.tiles[ti] === T_TRAP && !this.trapAnim.has(ti)) {
      this.trapAnim.set(ti, 1);
      const dmg = this.mitigate(10 + this.floor * 2);
      p.hp -= dmg;
      this.addFloater(p.x, p.y - 18, `-${dmg}`, "#e8434f");
      this.flashRed = Math.max(this.flashRed, 0.35);
      this.shakeIt(4);
      this.sfx.trap();
      this.burst(p.x, p.y, "#e8434f", 8, 80);
      if (p.hp <= 0) { this.killPlayer(); return; }
    }

    // лестница
    if (this.dungeon.tiles[ti] === T_STAIRS) {
      const bk = this.bossKind();
      const bossAlive = bk && this.ents.some((e) => e.def?.boss && !e.dead);
      if (bossAlive) {
        if (!this.stairsWarned) {
          this.stairsWarned = true;
          this.showHint("Лестница запечатана — уничтожьте босса!");
          this.sfx.error();
        }
      } else {
        this.stairsWarned = false;
        p.souls += 20;
        this.sfx.soul();
        this.addFloater(p.x, p.y - 20, "+20 ОСКОЛКОВ", "#46f0c8");
        if (this.floor >= FINAL_FLOOR) {
          // финал пройден
          this.doVictory();
        } else {
          this.startFloor(this.floor + 1);
        }
        return;
      }
    } else {
      this.stairsWarned = false;
    }

    // авто-атака
    this.tryAutoAttack(dt);

    // подбор предметов
    for (const e of this.ents) {
      if (e.dead || e.kind !== "item" || e.itemType === undefined) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < p.r + e.r + 2) {
        if (e.itemType === "gold") {
          const gold = Math.round((8 + this.rng() * 17) * (1 + 0.08 * this.setup.meta.tree.luck));
          p.gold += gold;
          this.addFloater(e.x, e.y - 12, `+${gold} ЗОЛОТА`, "#ffd166");
          this.sfx.coin();
          this.burst(e.x, e.y, "#ffd166", 8, 70);
          e.dead = true;
        } else if (e.itemType === "potion") {
          if (p.potions < 6) {
            p.potions++;
            this.addFloater(e.x, e.y - 12, "+1 ФЛЯГА", "#7ed957");
            this.sfx.potion();
            e.dead = true;
          }
        }
      }
    }
  }

  private stairsWarned = false;

  private mitigate(raw: number) {
    const armor = this.player.armor * 6 + (this.setup.cls === "knight" ? 8 : 0);
    return Math.max(1, Math.round(raw * (1 - armor / (armor + 60))));
  }

  private tryAutoAttack(_dt: number) {
    const p = this.player;
    if (p.atkCd > 0) return;
    const c = classDef(this.setup.cls);
    const range = c.range * TILE;
    let best: Ent | null = null;
    let bestD = Infinity;
    for (const e of this.ents) {
      if (e.kind !== "enemy" || e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r;
      if (d < range && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    // бочки тоже можно бить
    let barrel: Ent | null = null;
    for (const e of this.ents) {
      if (e.kind !== "barrel" || e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r;
      if (d < range * 0.9 && (!barrel || d < bestD)) barrel = e;
    }

    if (!best && !barrel) return;
    p.facing = best ? Math.atan2(best.y - p.y, best.x - p.x) : Math.atan2(barrel!.y - p.y, barrel!.x - p.x);

    const willSpd = 1 - 0.03 * this.setup.meta.tree.will;
    p.atkCd = Math.max(0.3, c.atkCd * willSpd);
    p.swingT = 0.18;

    if (c.ranged) {
      const dmg = Math.max(2, Math.round(p.int * (1 + 0.25 * p.weapon) * (0.9 + this.rng() * 0.2)));
      const t = best ?? barrel!;
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      this.ents.push(this.makeEnt("proj", p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, {
        r: 5, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330,
        from: "player", dmg, ttl: 1.6, ttlMax: 1.6, magic: true,
      }));
      this.sfx.bolt();
      return;
    }

    this.sfx.swing();
    // дуговая атака
    let hitAny = false;
    for (const e of this.ents) {
      if (e.dead) continue;
      if (e.kind !== "enemy" && e.kind !== "barrel") continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range + e.r + 6) continue;
      const ang = Math.atan2(dy, dx);
      let diff = Math.abs(ang - p.facing);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > 1.75) continue;

      if (e.kind === "barrel") {
        e.hp -= 6;
        e.vx += Math.cos(ang) * 300;
        e.vy += Math.sin(ang) * 300;
        this.sfx.barrel();
        this.burst(e.x, e.y, "#c98a4b", 8, 110);
        if (e.hp <= 0) this.breakBarrel(e);
        continue;
      }

      hitAny = true;
      let dmg = Math.max(1, Math.round(p.str * (1 + 0.25 * p.weapon) * (0.9 + this.rng() * 0.2)));
      const critChance = Math.min(0.5, 0.05 + p.dex / 100 + 0.02 * this.setup.meta.tree.luck);
      let crit = this.rng() < critChance;
      if (crit) dmg = Math.round(dmg * (1.5 + p.dex / 50));

      // щит скелета
      if (e.def?.shieldFront && e.facing !== undefined) {
        const toAttacker = Math.atan2(p.y - e.y, p.x - e.x);
        let fd = Math.abs(toAttacker - e.facing);
        if (fd > Math.PI) fd = Math.PI * 2 - fd;
        if (fd < 1.2) {
          dmg = Math.max(1, Math.round(dmg * 0.45));
          crit = false;
          this.sfx.shield();
          this.addFloater(e.x, e.y - e.r - 14, "ЩИТ", "#9aa3b2");
        }
      }

      this.damageEnemy(e, dmg, crit, ang);
    }
    if (hitAny) this.shakeIt(2);
    // частицы взмаха
    for (let i = 0; i < 6; i++) {
      const a = p.facing + (this.rng() - 0.5) * 1.6;
      const d = range * (0.5 + this.rng() * 0.5);
      this.addParticle({
        x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
        vx: Math.cos(a) * 40, vy: Math.sin(a) * 40,
        life: 0.16, max: 0.16, size: 2.4, color: c.accent,
      });
    }
  }

  private damageEnemy(e: Ent, dmg: number, crit: boolean, fromAng: number) {
    e.hp -= dmg;
    e.flash = 0.12;
    e.state = "chase";
    e.timer = 0;
    e.vx += Math.cos(fromAng) * (e.def?.knockback ? 30 : 120);
    e.vy += Math.sin(fromAng) * (e.def?.knockback ? 30 : 120);
    this.addFloater(e.x, e.y - e.r - 8, `${dmg}`, crit ? "#ffd166" : "#e9e2cf", crit);
    this.burst(e.x, e.y, crit ? "#ffd166" : "#e8434f", crit ? 12 : 7, 100);
    if (crit) this.sfx.crit();
    else this.sfx.hitEnemy();
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Ent) {
    if (e.dead) return;
    e.dead = true;
    const def = e.def!;
    const m = this.floorMult();
    this.kills++;
    const p = this.player;

    // опыт
    p.xp += Math.round(def.exp * m.exp);
    while (p.xp >= this.xpNeed()) {
      p.xp -= this.xpNeed();
      p.level++;
      p.maxHp = Math.round(p.maxHp * 1.05) + 2;
      p.hp = p.maxHp;
      p.freePoints += 3;
      this.modal = "levelup";
      this.sfx.levelup();
      this.burst(p.x, p.y, "#ffd166", 26, 140);
      this.addFloater(p.x, p.y - 24, "УРОВЕНЬ!", "#ffd166", true);
    }

    // осколки душ
    p.souls += def.souls;
    for (let i = 0; i < Math.min(6, 2 + Math.floor(def.souls / 3)); i++) {
      this.addParticle({
        x: e.x + (Math.random() - 0.5) * 12, y: e.y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 40,
        life: 0.9, max: 0.9, size: 3, color: "#46f0c8", glow: true, grav: -30,
      });
    }
    this.sfx.soul();

    // золото
    if (this.rng() < 0.45) {
      const g = this.makeEnt("item", e.x + (this.rng() - 0.5) * 10, e.y + (this.rng() - 0.5) * 10, { r: 8, itemType: "gold" });
      this.ents.push(g);
    }

    // кровь
    this.burst(e.x, e.y, def.color, def.boss ? 34 : 12, def.boss ? 190 : 110);
    if (def.boss) {
      this.shakeIt(14);
      this.flashTeal = 0.8;
      this.sfx.roar();
      this.showHint(`${def.name} ПОВЕРЖЕН`);
      this.bossesDown.push(this.floor);
      if (def.kind === "bossSoul") {
        this.doVictory();
        return;
      }
    }

    // слизь делится
    if (def.splits) {
      this.sfx.split();
      for (let i = 0; i < 2; i++) {
        const s = this.spawnEnemy(ENEMIES.slimeSmall, e.x + (i === 0 ? -12 : 12), e.y, m);
        s.state = "chase";
      }
      this.burst(e.x, e.y, "#7ed957", 10, 90);
    } else if (!def.phasing) {
      // труп для некроманта
      const corpse = this.makeEnt("corpse", e.x, e.y, { r: 9, ttl: 20, ttlMax: 20 });
      this.ents.push(corpse);
    }

    this.pushHud();
  }

  private doVictory() {
    if (this.over) return;
    this.over = true;
    this.victory = true;
    this.endTimer = 1.4;
    this.flashTeal = 1.2;
    this.shakeIt(10);
    this.sfx.victory();
    const p = this.player;
    for (let i = 0; i < 60; i++) {
      this.addParticle({
        x: p.x + (Math.random() - 0.5) * 60, y: p.y + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 160, vy: -60 - Math.random() * 140,
        life: 1.6, max: 1.6, size: 3.4, color: Math.random() < 0.5 ? "#46f0c8" : "#ffd166", glow: true, grav: -14,
      });
    }
  }

  private killPlayer() {
    if (this.over) return;
    this.over = true;
    this.victory = false;
    this.endTimer = 1.3;
    this.flashRed = 1.1;
    this.shakeIt(16);
    this.sfx.death();
    const p = this.player;
    for (let i = 0; i < 40; i++) {
      this.addParticle({
        x: p.x, y: p.y,
        vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220 - 40,
        life: 1.3, max: 1.3, size: 3.4, color: Math.random() < 0.6 ? "#46f0c8" : "#e8434f", glow: true, grav: 30,
      });
    }
  }

  private buildSummary(): RunSummary {
    const p = this.player;
    const banked = this.victory ? p.souls * 2 : p.souls;
    return {
      victory: this.victory,
      floor: this.floor,
      kills: this.kills,
      soulsEarned: p.souls,
      soulsBanked: banked,
      chests: this.chestsRun,
      gold: p.gold,
      timeSec: Math.floor(this.time),
      newUnlocks: [],
      bossFloors: [...this.bossesDown],
      totalSouls: this.setup.meta.souls + banked,
    };
  }

  /* ── enemies AI ── */

  private updateEnemies(dt: number) {
    const p = this.player;
    const m = this.floorMult();
    for (const e of this.ents) {
      if (e.kind !== "enemy" || e.dead || !e.def) continue;
      const def = e.def;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      const spd = def.spd * m.spd * TILE;
      e.flash = Math.max(0, (e.flash ?? 0) - dt);
      e.atkCd = Math.max(0, (e.atkCd ?? 0) - dt);
      e.timer = (e.timer ?? 0) - dt;

      const aggroR = (def.boss ? 9 : 5.4) * TILE;
      const atkR = def.range * TILE;
      const hpFrac = e.hp / e.maxHp;

      // спец-таймеры
      if (def.summoner && e.summonCd !== undefined) {
        e.summonCd -= dt;
        if (e.summonCd <= 0) {
          e.summonCd = def.boss ? 12 : 15;
          this.trySummon(e);
        }
      }
      if (def.phasing && e.teleCd !== undefined) {
        e.teleCd -= dt;
        if (e.teleCd <= 0 && dist > 2.4 * TILE) {
          e.teleCd = 10;
          this.burst(e.x, e.y, def.color, 12, 90);
          const a = this.rng() * Math.PI * 2;
          const d = (2 + this.rng()) * TILE;
          const nx = p.x + Math.cos(a) * d;
          const ny = p.y + Math.sin(a) * d;
          if (this.walkable(Math.floor(nx / TILE), Math.floor(ny / TILE))) {
            e.x = nx; e.y = ny;
            this.sfx.teleport();
            this.burst(e.x, e.y, def.color, 14, 110);
          }
        }
      }

      switch (e.state) {
        case "idle": {
          e.vx *= Math.exp(-8 * dt);
          e.vy *= Math.exp(-8 * dt);
          if ((e.wanderX === undefined || (e.timer ?? 0) <= 0) && dist > atkR) {
            const a = this.rng() * Math.PI * 2;
            e.wanderX = e.x + Math.cos(a) * TILE * (1 + this.rng() * 2);
            e.wanderY = e.y + Math.sin(a) * TILE * (1 + this.rng() * 2);
            e.timer = 1.6 + this.rng() * 2.4;
          }
          if (e.wanderX !== undefined) {
            const wx = (e.wanderX ?? e.x) - e.x;
            const wy = (e.wanderY ?? e.y) - e.y;
            const wd = Math.hypot(wx, wy);
            if (wd > 6) {
              e.vx = (wx / wd) * spd * 0.4;
              e.vy = (wy / wd) * spd * 0.4;
              e.facing = Math.atan2(wy, wx);
            }
          }
          if (dist < aggroR && p.hp > 0) {
            e.state = "chase";
            this.addFloater(e.x, e.y - e.r - 10, "!", "#ff6b2e", true);
          }
          break;
        }
        case "chase": {
          if (p.hp <= 0) { e.state = "idle"; break; }
          if (def.coward && hpFrac < 0.2) { e.state = "flee"; e.timer = 2; break; }

          let desired = spd;
          // крысы в пачке быстрее
          if (def.kind === "rat") {
            let mates = 0;
            for (const o of this.ents)
              if (o !== e && o.kind === "enemy" && !o.dead && o.def?.kind === "rat" && Math.hypot(o.x - e.x, o.y - e.y) < 2.5 * TILE) mates++;
            desired += Math.min(4, mates) * 0.2 * TILE;
          }

          // лучник держит дистанцию
          if (def.ranged && def.coward) {
            if (dist < 2.4 * TILE) {
              e.vx = (-dx / dist) * desired;
              e.vy = (-dy / dist) * desired;
            } else if (dist > 4.8 * TILE) {
              e.vx = (dx / dist) * desired;
              e.vy = (dy / dist) * desired;
            } else {
              e.vx *= Math.exp(-6 * dt);
              e.vy *= Math.exp(-6 * dt);
            }
          } else {
            e.vx = (dx / dist) * desired;
            e.vy = (dy / dist) * desired;
          }
          e.facing = Math.atan2(dy, dx);

          if (dist < atkR + p.r) {
            e.state = "attack";
            e.timer = 0.3;
          } else if (dist > aggroR * 1.9) {
            e.state = "idle";
            e.timer = 1;
          }
          break;
        }
        case "attack": {
          if (p.hp <= 0) { e.state = "idle"; break; }
          if (def.coward && hpFrac < 0.2) { e.state = "flee"; e.timer = 2; break; }
          e.vx *= Math.exp(-10 * dt);
          e.vy *= Math.exp(-10 * dt);
          if (dist > atkR + p.r + 10) {
            e.state = "chase";
            break;
          }
          e.facing = Math.atan2(dy, dx);
          if ((e.timer ?? 0) <= 0 && (e.atkCd ?? 0) <= 0) {
            e.atkCd = def.cd;
            e.timer = def.cd;
            this.enemyAttack(e, def, m, dist);
          }
          break;
        }
        case "flee": {
          if (dist > 0.01) {
            e.vx = (-dx / dist) * spd * 1.2;
            e.vy = (-dy / dist) * spd * 1.2;
            e.facing = Math.atan2(-dy, -dx);
          }
          if (hpFrac > 0.4 || dist > 10 * TILE) e.state = "chase";
          break;
        }
      }

      this.moveWithCollision(e, dt, !!def.phasing);
    }

    // расталкивание врагов
    const list = this.ents.filter((e) => e.kind === "enemy" && !e.dead);
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.r + b.r - 4;
        if (d > 0.001 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
  }

  private enemyAttack(e: Ent, def: EnemyDef, m: ReturnType<Engine["floorMult"]>, dist: number) {
    const p = this.player;
    if (def.ranged) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      const speed = def.kind === "archer" ? 270 : 230;
      this.ents.push(this.makeEnt("proj", e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12, {
        r: 4, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        from: "enemy", dmg: Math.round(def.dmg * m.dmg), ttl: 2, ttlMax: 2, magic: def.kind !== "archer",
      }));
      this.sfx.arrow();
      return;
    }
    // ближний бой — мгновенный удар с выпадом
    e.vx += Math.cos(e.facing ?? 0) * 90;
    e.vy += Math.sin(e.facing ?? 0) * 90;
    if (dist < def.range * TILE + p.r + 8) {
      this.damagePlayer(Math.round(def.dmg * m.dmg), def, e.x, e.y);
    }
  }

  private damagePlayer(raw: number, def?: EnemyDef, ax?: number, ay?: number) {
    const p = this.player;
    if (p.invulnT > 0 || p.hp <= 0) return;
    const dmg = this.mitigate(raw);
    p.hp -= dmg;
    p.invulnT = 0.25;
    this.flashRed = Math.max(this.flashRed, 0.45);
    this.shakeIt(def?.knockback ? 9 : 5);
    this.addFloater(p.x, p.y - 20, `-${dmg}`, "#e8434f");
    this.burst(p.x, p.y, "#e8434f", 10, 110);
    this.sfx.hurt();
    if (def?.knockback && ax !== undefined && ay !== undefined) {
      const a = Math.atan2(p.y - ay, p.x - ax);
      p.vx += Math.cos(a) * 260;
      p.vy += Math.sin(a) * 260;
    }
    if (def?.poison && p.poisonT <= 0) {
      p.poisonT = 5;
      p.poisonDps = 3 * this.floorMult().dmg;
      this.addFloater(p.x, p.y - 34, "ЯД!", "#7ed957");
    }
    if (p.hp <= 0) this.killPlayer();
    this.pushHud();
  }

  private trySummon(e: Ent) {
    const def = e.def!;
    const minions = this.ents.filter((o) => o.kind === "enemy" && !o.dead && o.def?.kind === "skeleton").length;
    if (minions >= (def.boss ? 4 : 2)) return;
    let corpse: Ent | null = null;
    for (const o of this.ents) {
      if (o.kind === "corpse" && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 5 * TILE) {
        corpse = o;
        break;
      }
    }
    if (!corpse) return;
    corpse.dead = true;
    const m = this.floorMult();
    const n = def.boss ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const s = this.spawnEnemy(ENEMIES.skeleton, corpse.x + (i - 0.5) * 18, corpse.y, m);
      s.hp = Math.round(s.maxHp * 0.7);
      s.state = "chase";
    }
    this.sfx.summon();
    this.burst(corpse.x, corpse.y, "#b98cff", 16, 120);
    this.addFloater(e.x, e.y - e.r - 12, "ПРИЗЫВ", "#b98cff");
  }

  /* ── objects ── */

  private updateEnts(dt: number) {
    const p = this.player;
    for (const e of this.ents) {
      if (e.dead) continue;
      switch (e.kind) {
        case "barrel": {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.vx *= Math.exp(-4.5 * dt);
          e.vy *= Math.exp(-4.5 * dt);
          this.collideCircleWalls(e, 0.45);
          const speed = Math.hypot(e.vx, e.vy);
          if (speed > 70) {
            for (const o of this.ents) {
              if (o.kind !== "enemy" || o.dead) continue;
              const d = Math.hypot(o.x - e.x, o.y - e.y);
              if (d < e.r + o.r) {
                const dmg = Math.round(10 + speed * 0.06);
                const a = Math.atan2(o.y - e.y, o.x - e.x);
                this.damageEnemy(o, dmg, false, a);
                e.vx *= -0.4;
                e.vy *= -0.4;
                e.hp -= 8;
                this.sfx.barrel();
                this.shakeIt(3);
                if (e.hp <= 0) this.breakBarrel(e);
                break;
              }
            }
          }
          break;
        }
        case "proj": {
          e.ttl = (e.ttl ?? 1) - dt;
          if (e.ttl <= 0) { e.dead = true; break; }
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          const tx = Math.floor(e.x / TILE);
          const ty = Math.floor(e.y / TILE);
          if (!this.walkable(tx, ty)) {
            e.dead = true;
            this.burst(e.x, e.y, e.magic ? "#b98cff" : "#9aa3b2", 5, 60);
            break;
          }
          if (e.from === "player") {
            for (const o of this.ents) {
              if ((o.kind !== "enemy" && o.kind !== "barrel") || o.dead) continue;
              if (Math.hypot(o.x - e.x, o.y - e.y) < o.r + e.r) {
                e.dead = true;
                if (o.kind === "barrel") {
                  o.hp -= 6;
                  const a = Math.atan2(e.vy, e.vx);
                  o.vx += Math.cos(a) * 260;
                  o.vy += Math.sin(a) * 260;
                  if (o.hp <= 0) this.breakBarrel(o);
                } else {
                  const crit = this.rng() < Math.min(0.5, 0.05 + p.dex / 100);
                  this.damageEnemy(o, e.dmg ?? 5, crit, Math.atan2(e.vy, e.vx));
                }
                this.burst(e.x, e.y, "#46f0c8", 8, 90);
                break;
              }
            }
          } else {
            if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r) {
              e.dead = true;
              this.damagePlayer(e.dmg ?? 5);
              this.burst(e.x, e.y, "#b98cff", 8, 90);
            }
          }
          break;
        }
        case "corpse": {
          e.ttl = (e.ttl ?? 0) - dt;
          if (e.ttl <= 0) e.dead = true;
          break;
        }
        default:
          break;
      }
    }
    this.ents = this.ents.filter((e) => !e.dead);
    if (this.ents.length > 140) this.ents.splice(0, this.ents.length - 140);
  }

  private breakBarrel(e: Ent) {
    if (e.dead) return;
    e.dead = true;
    this.sfx.barrel();
    this.burst(e.x, e.y, "#c98a4b", 16, 150);
    this.shakeIt(4);
    const roll = this.rng();
    if (roll < 0.35) {
      this.ents.push(this.makeEnt("item", e.x, e.y, { r: 8, itemType: "gold" }));
    } else if (roll < 0.55) {
      this.ents.push(this.makeEnt("item", e.x, e.y, { r: 8, itemType: "potion" }));
    }
    // щедрый урон по области
    for (const o of this.ents) {
      if (o.kind !== "enemy" || o.dead) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < TILE * 1.6) {
        this.damageEnemy(o, 14, false, Math.atan2(o.y - e.y, o.x - e.x));
      }
    }
  }

  private openChest(e: Ent) {
    if (e.opened) return;
    e.opened = true;
    this.chestsRun++;
    this.sfx.chest();
    this.burst(e.x, e.y, "#ffd166", 18, 130);
    const roll = this.rng();
    const p = this.player;
    if (roll < 0.42) {
      const gold = Math.round((20 + this.rng() * 40) * (1 + 0.08 * this.setup.meta.tree.luck));
      p.gold += gold;
      this.addFloater(e.x, e.y - 16, `+${gold} ЗОЛОТА`, "#ffd166", true);
    } else if (roll < 0.65) {
      p.potions = Math.min(6, p.potions + 1);
      this.addFloater(e.x, e.y - 16, "+1 ФЛЯГА", "#7ed957", true);
    } else if (roll < 0.85) {
      p.weapon++;
      this.addFloater(e.x, e.y - 16, `КЛИНОК +${p.weapon}`, "#ff9d3d", true);
      this.flashTeal = 0.35;
    } else {
      p.armor++;
      this.addFloater(e.x, e.y - 16, `ЛАТЫ +${p.armor}`, "#7db4ff", true);
      this.flashTeal = 0.35;
    }
    this.pushHud();
  }

  private openMerchant() {
    this.modal = "merchant";
    this.path = [];
    this.moveTarget = null;
    this.sfx.click();
    this.showHint("«Погреемся у огня, странник…»");
  }

  /* ── physics helpers ── */

  private moveWithCollision(ent: { x: number; y: number; vx: number; vy: number; r: number }, dt: number, phasing: boolean) {
    ent.x += ent.vx * dt;
    if (!phasing) this.collideCircleWalls(ent, 0.1);
    ent.y += ent.vy * dt;
    if (!phasing) this.collideCircleWalls(ent, 0.1);
    ent.x = Math.max(ent.r, Math.min(MAP_W * TILE - ent.r, ent.x));
    ent.y = Math.max(ent.r, Math.min(MAP_H * TILE - ent.r, ent.y));
  }

  private collideCircleWalls(ent: { x: number; y: number; vx: number; vy: number; r: number }, rest: number) {
    const minTx = Math.max(0, Math.floor((ent.x - ent.r) / TILE));
    const maxTx = Math.min(MAP_W - 1, Math.floor((ent.x + ent.r) / TILE));
    const minTy = Math.max(0, Math.floor((ent.y - ent.r) / TILE));
    const maxTy = Math.min(MAP_H - 1, Math.floor((ent.y + ent.r) / TILE));
    for (let ty = minTy; ty <= maxTy; ty++)
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (this.dungeon.tiles[ty * MAP_W + tx] !== T_WALL) continue;
        const cx = Math.max(tx * TILE, Math.min(ent.x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(ent.y, ty * TILE + TILE));
        const dx = ent.x - cx;
        const dy = ent.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < ent.r * ent.r && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const push = ent.r - d;
          ent.x += nx * push;
          ent.y += ny * push;
          const vn = ent.vx * nx + ent.vy * ny;
          if (vn < 0) {
            ent.vx -= nx * vn * (1 + rest);
            ent.vy -= ny * vn * (1 + rest);
          }
        } else if (d2 <= 0.0001) {
          ent.x = tx * TILE + (ent.x < tx * TILE + TILE / 2 ? -ent.r : TILE + ent.r);
        }
      }
  }

  /* ── particles / floaters ── */

  private addParticle(pa: Particle) {
    if (this.particles.length > 420) this.particles.shift();
    this.particles.push(pa);
  }

  private burst(x: number, y: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = speed * (0.35 + this.rng() * 0.75);
      this.addParticle({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.4 + this.rng() * 0.4, max: 0.8,
        size: 1.6 + this.rng() * 2.4, color,
        grav: 120,
      });
    }
  }

  private addFloater(x: number, y: number, text: string, color: string, big = false) {
    if (this.floaters.length > 40) this.floaters.shift();
    this.floaters.push({ x: x + (this.rng() - 0.5) * 10, y, text, color, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8, big });
  }

  private shakeIt(m: number) {
    this.shake = Math.min(18, this.shake + m);
  }

  /* ── visibility / fog ── */

  private updateVisibility() {
    const p = this.player;
    const ptx = Math.floor(p.x / TILE);
    const pty = Math.floor(p.y / TILE);
    const key = pty * MAP_W + ptx;
    if (key === this.lastVisTile) return;
    this.lastVisTile = key;

    const R = 6.5;
    const fctx = this.fogCanvas.getContext("2d")!;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = "source-over";
    fctx.fillStyle = "#000";
    fctx.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
    fctx.globalCompositeOperation = "destination-out";

    for (let ty = Math.max(0, pty - 7); ty <= Math.min(MAP_H - 1, pty + 7); ty++)
      for (let tx = Math.max(0, ptx - 7); tx <= Math.min(MAP_W - 1, ptx + 7); tx++) {
        const dx = tx - ptx;
        const dy = ty - pty;
        if (dx * dx + dy * dy > R * R) continue;
        if (!this.los(ptx, pty, tx, ty)) continue;
        const i = ty * MAP_W + tx;
        this.seen[i] = 1;
        fctx.fillStyle = "rgba(0,0,0,1)";
        fctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    // ранее виденные — полумрак
    fctx.fillStyle = "rgba(0,0,0,0.5)";
    for (let i = 0; i < this.seen.length; i++) {
      if (!this.seen[i]) continue;
      const tx = i % MAP_W;
      const ty = Math.floor(i / MAP_W);
      const dx = tx - ptx;
      const dy = ty - pty;
      if (dx * dx + dy * dy <= R * R && this.los(ptx, pty, tx, ty)) continue;
      fctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
    fctx.globalCompositeOperation = "source-over";
  }

  private los(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (;;) {
      if (x === x1 && y === y1) return true;
      if (!(x === x0 && y === y0) && this.dungeon.tiles[y * MAP_W + x] === T_WALL) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  /* ── prerender map ── */

  private prerenderMap() {
    this.mapCanvas = document.createElement("canvas");
    this.mapCanvas.width = MAP_W * TILE;
    this.mapCanvas.height = MAP_H * TILE;
    const g = this.mapCanvas.getContext("2d")!;
    const rng = mulberry32(this.floor * 331 + 7);
    const tiles = this.dungeon.tiles;

    for (let ty = 0; ty < MAP_H; ty++)
      for (let tx = 0; tx < MAP_W; tx++) {
        const i = ty * MAP_W + tx;
        const t = tiles[i];
        const x = tx * TILE;
        const y = ty * TILE;
        if (t === T_WALL) {
          const nearFloor =
            (tx > 0 && tiles[i - 1] !== T_WALL) || (tx < MAP_W - 1 && tiles[i + 1] !== T_WALL) ||
            (ty > 0 && tiles[i - MAP_W] !== T_WALL) || (ty < MAP_H - 1 && tiles[i + MAP_W] !== T_WALL);
          g.fillStyle = nearFloor ? "#1b2330" : "#10151f";
          g.fillRect(x, y, TILE, TILE);
          if (nearFloor) {
            if (ty < MAP_H - 1 && tiles[i + MAP_W] !== T_WALL) {
              g.fillStyle = "#39424f";
              g.fillRect(x, y + TILE - 5, TILE, 5);
              g.fillStyle = "#242e3d";
              g.fillRect(x, y + TILE - 8, TILE, 3);
            }
            if (rng() < 0.3) {
              g.fillStyle = "rgba(255,255,255,0.03)";
              g.fillRect(x + rng() * 20, y + rng() * 20, 6, 3);
            }
          }
        } else {
          const shade = 0.9 + rng() * 0.2;
          const base = t === T_STAIRS ? 30 : 35;
          g.fillStyle = `rgb(${Math.round(base * shade)},${Math.round((base + 8) * shade)},${Math.round((base + 19) * shade)})`;
          g.fillRect(x, y, TILE, TILE);
          g.strokeStyle = "rgba(0,0,0,0.16)";
          g.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          if (rng() < 0.2) {
            g.fillStyle = "rgba(0,0,0,0.18)";
            g.fillRect(x + rng() * 24, y + rng() * 24, 2 + rng() * 5, 1.5);
          }
          if (rng() < 0.06) {
            g.strokeStyle = "rgba(0,0,0,0.25)";
            g.beginPath();
            g.moveTo(x + rng() * TILE, y);
            g.lineTo(x + rng() * TILE, y + TILE);
            g.stroke();
          }
          if (t === T_TRAP) {
            g.fillStyle = "rgba(0,0,0,0.4)";
            g.beginPath();
            g.arc(x + TILE / 2, y + TILE / 2, 9, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "rgba(232,67,79,0.35)";
            for (let s = 0; s < 4; s++) {
              const a = (s / 4) * Math.PI * 2 + 0.4;
              g.fillRect(x + TILE / 2 + Math.cos(a) * 4 - 1, y + TILE / 2 + Math.sin(a) * 4 - 1, 2, 2);
            }
          }
          if (t === T_STAIRS) {
            g.fillStyle = "#10151f";
            g.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
            g.strokeStyle = "#46f0c8";
            g.lineWidth = 2;
            g.beginPath();
            for (let a = 0; a < Math.PI * 5; a += 0.3) {
              const r = 2 + a * 1.6;
              const px = x + TILE / 2 + Math.cos(a) * r * 0.42;
              const py = y + TILE / 2 + Math.sin(a) * r * 0.42;
              if (a === 0) g.moveTo(px, py);
              else g.lineTo(px, py);
            }
            g.stroke();
            g.lineWidth = 1;
          }
        }
      }

    this.fogCanvas = document.createElement("canvas");
    this.fogCanvas.width = MAP_W * TILE;
    this.fogCanvas.height = MAP_H * TILE;
  }

  /* ── render ── */

  private render(time: number) {
    const ctx = this.ctx;
    const { viewW, viewH, scale, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0a0d13";
    ctx.fillRect(0, 0, viewW, viewH);

    const shx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;

    ctx.save();
    ctx.translate(viewW / 2 - this.cam.x * scale + shx, viewH / 2 - this.cam.y * scale + shy);
    ctx.scale(scale, scale);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapCanvas, 0, 0);

    this.drawTrapSpikes(ctx);
    this.drawStairsFx(ctx, time);

    // сортировка по y
    const drawList: { y: number; e: Ent | null }[] = this.ents
      .filter((e) => e.kind !== "proj" && !e.dead)
      .map((e) => ({ y: e.y, e }));
    if (this.player.hp > 0) drawList.push({ y: this.player.y, e: null });
    drawList.sort((a, b) => a.y - b.y);
    for (const item of drawList) {
      if (item.e === null) this.drawPlayer(ctx, time);
      else this.drawEnt(ctx, item.e, time);
    }

    // снаряды и частицы поверх
    for (const e of this.ents) if (e.kind === "proj" && !e.dead) this.drawProj(ctx, e, time);

    for (const pa of this.particles) {
      const a = pa.life / pa.max;
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.fillStyle = pa.color;
      if (pa.glow) {
        ctx.shadowColor = pa.color;
        ctx.shadowBlur = 8;
      }
      ctx.fillRect(pa.x - pa.size / 2, pa.y - pa.size / 2, pa.size, pa.size);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // туман войны
    ctx.drawImage(this.fogCanvas, 0, 0);

    // свет
    ctx.globalCompositeOperation = "lighter";
    this.drawLight(ctx, this.player.x, this.player.y, 5.4 * TILE, "rgba(255,190,120,0.13)");
    for (const t of this.dungeon.torches) {
      if (!this.seen[t.floor]) continue;
      const fx = (tileX(t.wall) + 0.5) * TILE;
      const fy = (tileY(t.wall) + 0.5) * TILE;
      const flick = 0.1 + 0.05 * Math.sin(time * 9 + t.floor) + 0.03 * Math.sin(time * 23 + t.wall);
      this.drawLight(ctx, fx, fy, 2.6 * TILE, `rgba(255,140,50,${Math.max(0.02, flick)})`);
    }
    ctx.globalCompositeOperation = "source-over";

    // факелы — огоньки
    for (const t of this.dungeon.torches) {
      if (!this.seen[t.floor]) continue;
      const fx = (tileX(t.wall) + 0.5) * TILE;
      const fy = (tileY(t.wall) + 0.5) * TILE;
      const f = Math.sin(time * 11 + t.floor * 3) * 1.5;
      ctx.fillStyle = "#5b3a1e";
      ctx.fillRect(fx - 1.5, fy - 2, 3, 8);
      ctx.fillStyle = "#ff9d3d";
      ctx.beginPath();
      ctx.arc(fx, fy - 5 + f * 0.4, 4 + f * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(fx, fy - 5, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // циферки урона
    for (const f of this.floaters) {
      const a = Math.max(0, Math.min(1, f.life / f.max * 1.4));
      ctx.globalAlpha = a;
      ctx.font = f.big ? '10px "Press Start 2P"' : '8px "Press Start 2P"';
      ctx.textAlign = "center";
      ctx.fillStyle = "#000";
      ctx.fillText(f.text, f.x + 1.5, f.y + 1.5);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // экранные эффекты
    if (this.flashRed > 0) {
      ctx.fillStyle = `rgba(232,67,79,${Math.min(0.4, this.flashRed * 0.4)})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
    if (this.flashTeal > 0) {
      ctx.fillStyle = `rgba(70,240,200,${Math.min(0.28, this.flashTeal * 0.25)})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
    if (this.player.poisonT > 0) {
      const a = 0.12 + 0.06 * Math.sin(time * 6);
      const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.3, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.7);
      grad.addColorStop(0, "rgba(126,217,87,0)");
      grad.addColorStop(1, `rgba(126,217,87,${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewW, viewH);
    }
    // виньетка
    const vg = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.36, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.75);
    vg.addColorStop(0, "rgba(4,6,10,0)");
    vg.addColorStop(1, "rgba(4,6,10,0.62)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, viewW, viewH);

    if (this.transT > 0) {
      ctx.fillStyle = `rgba(4,6,10,${this.transT})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    this.renderMinimap();
  }

  private drawLight(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  private drawTrapSpikes(ctx: CanvasRenderingContext2D) {
    for (const [i, v] of this.trapAnim) {
      const x = tileX(i) * TILE + TILE / 2;
      const y = tileY(i) * TILE + TILE / 2;
      const h = 9 * Math.sin(Math.min(1, v) * Math.PI);
      ctx.strokeStyle = "#c9d4e4";
      ctx.lineWidth = 2;
      for (let s = 0; s < 4; s++) {
        const a = (s / 4) * Math.PI * 2 + 0.4;
        const bx = x + Math.cos(a) * 5;
        const by = y + Math.sin(a) * 5;
        ctx.beginPath();
        ctx.moveTo(bx - 2, by + 2);
        ctx.lineTo(bx, by - h);
        ctx.lineTo(bx + 2, by + 2);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    }
  }

  private drawStairsFx(ctx: CanvasRenderingContext2D, time: number) {
    const i = this.dungeon.stairsIdx;
    const x = tileX(i) * TILE + TILE / 2;
    const y = tileY(i) * TILE + TILE / 2;
    const locked = this.bossKind() && this.ents.some((e) => e.def?.boss && !e.dead);
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.strokeStyle = locked ? "rgba(232,67,79,0.7)" : `rgba(70,240,200,${0.35 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 13 + pulse * 3, time * 2, time * 2 + Math.PI * 1.4);
    ctx.stroke();
    ctx.lineWidth = 1;
    if (locked) {
      ctx.strokeStyle = "#e8434f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 8);
      ctx.lineTo(x + 8, y + 8);
      ctx.moveTo(x + 8, y - 8);
      ctx.lineTo(x - 8, y + 8);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  /* ── entity drawing ── */

  private drawEnt(ctx: CanvasRenderingContext2D, e: Ent, time: number) {
    const bob = Math.sin(time * 6 + e.seed) * 1.5;
    switch (e.kind) {
      case "corpse": {
        const a = Math.min(1, (e.ttl ?? 0) / 3);
        ctx.globalAlpha = 0.55 * a;
        ctx.fillStyle = "#3a2f33";
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 2, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#c9c2b0";
        ctx.fillRect(e.x - 5, e.y - 2, 3, 3);
        ctx.fillRect(e.x + 2, e.y, 3, 3);
        ctx.globalAlpha = 1;
        break;
      }
      case "barrel": {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + e.r - 2, e.r * 0.9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8a5a2e";
        ctx.beginPath();
        ctx.arc(e.x, e.y + bob * 0.3, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#5b3a1e";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y + bob * 0.3, e.r - 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#c98a4b";
        ctx.beginPath();
        ctx.moveTo(e.x - e.r + 3, e.y + bob * 0.3);
        ctx.lineTo(e.x + e.r - 3, e.y + bob * 0.3);
        ctx.stroke();
        break;
      }
      case "chest": {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 10, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = e.opened ? "#5a4326" : "#8a5a2e";
        ctx.fillRect(e.x - 11, e.y - 8, 22, 16);
        ctx.fillStyle = e.opened ? "#3d2d19" : "#6b4522";
        ctx.fillRect(e.x - 11, e.y - 8, 22, 6);
        ctx.strokeStyle = "#ffd166";
        ctx.strokeRect(e.x - 11.5, e.y - 8.5, 23, 17);
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(e.x - 2, e.y - 3, 4, 6);
        if (!e.opened) {
          const gl = 0.4 + 0.4 * Math.sin(time * 4 + e.seed);
          ctx.fillStyle = `rgba(255,209,102,${gl * 0.5})`;
          ctx.fillRect(e.x - 1, e.y - 12, 2, 4);
        }
        break;
      }
      case "item": {
        const merchant = (e as Ent & { merchant?: boolean }).merchant;
        if (merchant) {
          this.drawMerchant(ctx, e, time);
          break;
        }
        if (e.itemType === "gold") {
          const gl = 0.6 + 0.4 * Math.sin(time * 5 + e.seed);
          ctx.fillStyle = "#b8860b";
          ctx.beginPath();
          ctx.ellipse(e.x, e.y + 2, 7, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255,209,102,${gl})`;
          ctx.beginPath();
          ctx.arc(e.x - 2, e.y, 3.4, 0, Math.PI * 2);
          ctx.arc(e.x + 3, e.y + 1, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (e.itemType === "potion") {
          ctx.fillStyle = "#2e5a3a";
          ctx.fillRect(e.x - 2, e.y - 9, 4, 4);
          ctx.fillStyle = "#7ed957";
          ctx.beginPath();
          ctx.arc(e.x, e.y - 1 + bob * 0.4, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillRect(e.x - 3, e.y - 4, 2, 3);
        }
        break;
      }
      case "enemy":
        this.drawEnemy(ctx, e, time);
        break;
      default:
        break;
    }
    if (e.flash && e.flash > 0 && e.kind === "enemy") {
      ctx.globalAlpha = e.flash * 5;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private drawMerchant(ctx: CanvasRenderingContext2D, e: Ent, time: number) {
    const bob = Math.sin(time * 3 + e.seed) * 1.2;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 14, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // плащ
    ctx.fillStyle = "#7a4a2e";
    ctx.beginPath();
    ctx.moveTo(e.x - 10, e.y + 13);
    ctx.lineTo(e.x - 7, e.y - 8 + bob);
    ctx.lineTo(e.x + 7, e.y - 8 + bob);
    ctx.lineTo(e.x + 10, e.y + 13);
    ctx.closePath();
    ctx.fill();
    // капюшон
    ctx.fillStyle = "#5b3a1e";
    ctx.beginPath();
    ctx.arc(e.x, e.y - 9 + bob, 7, 0, Math.PI * 2);
    ctx.fill();
    // глаза
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(e.x - 3, e.y - 10 + bob, 2, 2);
    ctx.fillRect(e.x + 1, e.y - 10 + bob, 2, 2);
    // огонёк над головой
    const fl = 0.6 + 0.4 * Math.sin(time * 7);
    ctx.fillStyle = `rgba(255,157,61,${fl})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y - 22 + bob + Math.sin(time * 5) * 1.5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd166";
    ctx.fillText("ТОРГОВЕЦ", e.x, e.y - 28);
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Ent, time: number) {
    const def = e.def!;
    const t = time * 6 + e.seed;
    const moving = Math.hypot(e.vx, e.vy) > 10;
    const step = moving ? Math.sin(time * 13 + e.seed) * 1.6 : 0;
    const y = e.y + step * 0.4;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.r - 2, e.r * 0.85, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const r = e.r;
    switch (def.kind) {
      case "rat": {
        ctx.fillStyle = def.color;
        ctx.save();
        ctx.translate(e.x, y);
        ctx.rotate((e.facing ?? 0));
        ctx.beginPath();
        ctx.ellipse(0, 0, r + 2, r - 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#6a6f7c";
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.quadraticCurveTo(-r - 7, -4 + Math.sin(t) * 3, -r - 12, 2);
        ctx.stroke();
        ctx.fillStyle = "#555a66";
        ctx.beginPath();
        ctx.arc(r * 0.4, -r * 0.6, 3, 0, Math.PI * 2);
        ctx.arc(r * 0.4, r * 0.6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e8434f";
        ctx.fillRect(r * 0.6, -2, 2, 2);
        ctx.restore();
        break;
      }
      case "slime":
      case "slimeSmall": {
        const sq = 1 + Math.sin(t * 1.4) * 0.12;
        ctx.fillStyle = def.color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(e.x, y + r * (1 - sq) * 0.4, r * sq, r / sq, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(e.x - r * 0.3, y - r * 0.35, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1c2b12";
        ctx.fillRect(e.x - 4, y - 3, 2.5, 3.5);
        ctx.fillRect(e.x + 2, y - 3, 2.5, 3.5);
        break;
      }
      case "skeleton": {
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(e.x, y - 3, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(e.x - r * 0.55, y + 2, r * 1.1, r * 0.8);
        ctx.fillStyle = "#131822";
        ctx.fillRect(e.x - 5, y - 6, 3.5, 4);
        ctx.fillRect(e.x + 1.5, y - 6, 3.5, 4);
        ctx.fillRect(e.x - 4, y + 4, 2, 6);
        ctx.fillRect(e.x, y + 4, 2, 6);
        ctx.fillRect(e.x + 4 - 2, y + 4, 2, 6);
        // щит спереди
        if (e.facing !== undefined) {
          ctx.strokeStyle = "#9aa3b2";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(e.x, y, r + 3, e.facing - 0.9, e.facing + 0.9);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        break;
      }
      case "spider":
      case "bossSpider": {
        ctx.strokeStyle = "#4a3b63";
        ctx.lineWidth = def.boss ? 3 : 2;
        for (let i = 0; i < 8; i++) {
          const side = i < 4 ? -1 : 1;
          const k = i % 4;
          const la = side * (0.5 + k * 0.35);
          const wig = Math.sin(t * 2 + k * 1.7) * 3;
          ctx.beginPath();
          ctx.moveTo(e.x, y);
          ctx.lineTo(e.x + Math.cos(la) * r * 1.7 * side, y + Math.sin(la) * r * 1.1 + wig);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(e.x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2c2340";
        ctx.beginPath();
        ctx.arc(e.x, y - r * 0.2, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e8434f";
        const eyes = def.boss ? 4 : 2;
        for (let i = 0; i < eyes; i++) {
          ctx.fillRect(e.x - 5 + i * 3.4, y - r * 0.35, 2, 2);
        }
        break;
      }
      case "archer": {
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(e.x, y - 2, r * 0.9, 0, Math.PI * 2);
        ctx.fill();
        // уши
        ctx.beginPath();
        ctx.moveTo(e.x - r, y - 6);
        ctx.lineTo(e.x - r - 5, y - 12);
        ctx.lineTo(e.x - r * 0.4, y - 9);
        ctx.moveTo(e.x + r, y - 6);
        ctx.lineTo(e.x + r + 5, y - 12);
        ctx.lineTo(e.x + r * 0.4, y - 9);
        ctx.fill();
        ctx.fillStyle = "#ffd23d";
        ctx.fillRect(e.x - 4, y - 5, 3, 3);
        ctx.fillRect(e.x + 1, y - 5, 3, 3);
        // лук
        ctx.strokeStyle = "#c98a4b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x + (e.facing !== undefined && Math.cos(e.facing) < 0 ? -r - 4 : r + 4), y, 7, -1.1, 1.1);
        ctx.stroke();
        ctx.lineWidth = 1;
        break;
      }
      case "necromancer":
      case "bossNecro": {
        const hover = Math.sin(t) * 2.5;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.moveTo(e.x - r, y + r);
        ctx.lineTo(e.x - r * 0.55, y - r + hover);
        ctx.lineTo(e.x + r * 0.55, y - r + hover);
        ctx.lineTo(e.x + r, y + r);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#1a1226";
        ctx.beginPath();
        ctx.arc(e.x, y - r * 0.55 + hover, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#46f0c8";
        ctx.fillRect(e.x - 4, y - r * 0.62 + hover, 2.5, 2.5);
        ctx.fillRect(e.x + 1.5, y - r * 0.62 + hover, 2.5, 2.5);
        // посох
        ctx.strokeStyle = "#6d5a8f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x + r + 3, y + r);
        ctx.lineTo(e.x + r + 3, y - r - 4 + hover);
        ctx.stroke();
        ctx.lineWidth = 1;
        const orb = 0.5 + 0.5 * Math.sin(time * 5);
        ctx.fillStyle = `rgba(70,240,200,${0.5 + orb * 0.5})`;
        ctx.beginPath();
        ctx.arc(e.x + r + 3, y - r - 7 + hover, 3.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "golem":
      case "bossGolem": {
        ctx.fillStyle = def.color;
        ctx.fillRect(e.x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = "#6d7885";
        ctx.fillRect(e.x - r, y - r, r * 2, 5);
        ctx.fillStyle = "#555f6b";
        ctx.fillRect(e.x - r * 0.5, y - r * 0.4, r, r * 0.5);
        ctx.fillStyle = "#ff9d3d";
        ctx.fillRect(e.x - r * 0.45, y - r * 0.25, 4, 4);
        ctx.fillRect(e.x + r * 0.45 - 4, y - r * 0.25, 4, 4);
        ctx.strokeStyle = "#4a525d";
        ctx.beginPath();
        ctx.moveTo(e.x - r * 0.7, y + r * 0.3);
        ctx.lineTo(e.x - r * 0.2, y + r * 0.6);
        ctx.lineTo(e.x + r * 0.3, y + r * 0.4);
        ctx.stroke();
        break;
      }
      case "banshee":
      case "bossSoul": {
        const a = 0.55 + 0.2 * Math.sin(t * 1.3);
        ctx.globalAlpha = a;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(e.x, y - 4, r, Math.PI, 0);
        ctx.lineTo(e.x + r, y + r * 0.8);
        for (let i = 3; i >= -3; i--) {
          ctx.lineTo(e.x + (i / 3) * r * 0.8, y + r * 0.8 + Math.sin(t * 2 + i) * 3 - (i % 2 === 0 ? 4 : 0));
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#0a2a22";
        ctx.fillRect(e.x - r * 0.45, y - r * 0.45, 4.5, 6);
        ctx.fillRect(e.x + r * 0.45 - 4.5, y - r * 0.45, 4.5, 6);
        if (def.kind === "bossSoul") {
          ctx.fillStyle = `rgba(70,240,200,${0.5 + 0.4 * Math.sin(time * 4)})`;
          ctx.beginPath();
          ctx.arc(e.x, y - 2, r * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }

    // полоска HP
    if (e.hp < e.maxHp && !def.boss) {
      const w = Math.max(20, r * 2);
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(e.x - w / 2, y - r - 10, w, 4);
      ctx.fillStyle = "#e8434f";
      ctx.fillRect(e.x - w / 2 + 0.5, y - r - 9.5, (w - 1) * Math.max(0, e.hp / e.maxHp), 3);
    }
    if (def.boss) {
      const pulse = 0.6 + 0.4 * Math.sin(time * 3);
      ctx.strokeStyle = `rgba(185,140,255,${pulse * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, y, r + 7 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, time: number) {
    const p = this.player;
    const c = classDef(this.setup.cls);
    const moving = p.moving;
    const step = moving ? Math.sin(p.stepPhase) * 1.8 : 0;
    const y = p.y + step * 0.4;
    const blink = p.invulnT > 0 && Math.floor(time * 20) % 2 === 0;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!blink) {
      // взмах оружия
      if (p.swingT > 0 && !c.ranged) {
        const prog = 1 - p.swingT / 0.18;
        const a0 = p.facing - 1.5 + prog * 3;
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1 - prog;
        ctx.beginPath();
        ctx.arc(p.x, y, c.range * TILE * 0.8, a0 - 0.5, a0 + 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
      }

      // тело
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(p.x, y - 2, 10, 0, Math.PI * 2);
      ctx.fill();
      // плащ
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(p.x - 8, y - 4);
      ctx.lineTo(p.x, y + 10);
      ctx.lineTo(p.x + 8, y - 4);
      ctx.closePath();
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      // глаза по направлению
      const ex = Math.cos(p.facing) * 3.5;
      const ey = Math.sin(p.facing) * 3.5;
      ctx.fillStyle = "#10151f";
      ctx.fillRect(p.x - 3.5 + ex, y - 5 + ey, 2.5, 3);
      ctx.fillRect(p.x + 1 + ex, y - 5 + ey, 2.5, 3);

      if (c.id === "knight") {
        ctx.strokeStyle = "#9aa3b2";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, y - 2, 12, p.facing + 1.9, p.facing + 4.4);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (c.id === "mage") {
        ctx.strokeStyle = "#6d5a8f";
        ctx.lineWidth = 2;
        const sx = p.x + Math.cos(p.facing + 0.6) * 12;
        const sy = y + Math.sin(p.facing + 0.6) * 12;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.facing + 0.6) * 4, y + Math.sin(p.facing + 0.6) * 4);
        ctx.lineTo(sx, sy - 6);
        ctx.stroke();
        ctx.lineWidth = 1;
        const orb = 0.5 + 0.5 * Math.sin(time * 6);
        ctx.fillStyle = `rgba(185,140,255,${0.6 + orb * 0.4})`;
        ctx.beginPath();
        ctx.arc(sx, sy - 9, 3.5 + orb, 0, Math.PI * 2);
        ctx.fill();
      }
      if (c.id === "thief" && p.swingT > 0) {
        ctx.strokeStyle = "#e9e2cf";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.facing) * 8, y + Math.sin(p.facing) * 8);
        ctx.lineTo(p.x + Math.cos(p.facing) * 20, y + Math.sin(p.facing) * 20);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
  }

  private drawProj(ctx: CanvasRenderingContext2D, e: Ent, time: number) {
    const a = Math.atan2(e.vy, e.vx);
    if (e.magic) {
      const col = e.from === "player" ? "#46f0c8" : "#b98cff";
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4 + Math.sin(time * 20) * 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = e.from === "player" ? "#e9e2cf" : "#c98a4b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x - Math.cos(a) * 8, e.y - Math.sin(a) * 8);
      ctx.lineTo(e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  private renderMinimap() {
    const mm = this.minimap;
    if (!mm) return;
    const g = mm.getContext("2d");
    if (!g) return;
    const S = mm.width;
    const k = S / (MAP_W * TILE);
    g.clearRect(0, 0, S, S);
    g.fillStyle = "rgba(6,8,13,0.92)";
    g.fillRect(0, 0, S, S);
    const tiles = this.dungeon.tiles;
    for (let i = 0; i < this.seen.length; i++) {
      if (!this.seen[i]) continue;
      const t = tiles[i];
      if (t === T_WALL) continue;
      g.fillStyle = t === T_STAIRS ? "#46f0c8" : "#39424f";
      g.fillRect((i % MAP_W) * TILE * k, Math.floor(i / MAP_W) * TILE * k, Math.ceil(TILE * k), Math.ceil(TILE * k));
    }
    if (this.dungeon.merchantIdx !== null && this.seen[this.dungeon.merchantIdx]) {
      g.fillStyle = "#ffd166";
      g.fillRect(tileX(this.dungeon.merchantIdx) * TILE * k - 1, tileY(this.dungeon.merchantIdx) * TILE * k - 1, 3, 3);
    }
    for (const e of this.ents) {
      if (e.kind !== "enemy" || e.dead) continue;
      const tx = Math.floor(e.x / TILE);
      const ty = Math.floor(e.y / TILE);
      if (!this.seen[ty * MAP_W + tx]) continue;
      g.fillStyle = e.def?.boss ? "#b98cff" : "#e8434f";
      const size = e.def?.boss ? 4 : 2;
      g.fillRect(e.x * k - size / 2, e.y * k - size / 2, size, size);
    }
    const blink = Math.floor(performance.now() / 300) % 2 === 0;
    if (blink) {
      g.fillStyle = "#ff9d3d";
      g.fillRect(this.player.x * k - 2, this.player.y * k - 2, 4, 4);
    }
    g.strokeStyle = "#2e3a4f";
    g.strokeRect(0.5, 0.5, S - 1, S - 1);
  }
}
