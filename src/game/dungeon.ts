import { MAP_W, MAP_H } from "./types";

export const T_WALL = 0;
export const T_FLOOR = 1;
export const T_STAIRS = 2;
export const T_TRAP = 3;

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface Torch {
  wall: number;
  floor: number;
}

export interface DungeonData {
  tiles: Uint8Array;
  rooms: Room[];
  stairsIdx: number;
  spawnIdx: number;
  merchantIdx: number | null;
  traps: number[];
  torches: Torch[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const idx = (x: number, y: number) => y * MAP_W + x;

interface Leaf { x: number; y: number; w: number; h: number; }

export function generateDungeon(seed: number, floor: number): DungeonData {
  for (let attempt = 0; attempt < 8; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);
    const tiles = new Uint8Array(MAP_W * MAP_H).fill(T_WALL);
    const leaves: Leaf[] = [];

    const split = (x: number, y: number, w: number, h: number, depth: number) => {
      if (depth === 0 || (w < 13 && h < 13) || w < 7 || h < 7) {
        if (w >= 5 && h >= 5) leaves.push({ x, y, w, h });
        return;
      }
      const vertical = w > h ? true : h > w ? false : rng() > 0.5;
      if (vertical) {
        const s = Math.floor(w * (0.38 + rng() * 0.24));
        split(x, y, s, h, depth - 1);
        split(x + s, y, w - s, h, depth - 1);
      } else {
        const s = Math.floor(h * (0.38 + rng() * 0.24));
        split(x, y, w, s, depth - 1);
        split(x, y + s, w, h - s, depth - 1);
      }
    };

    split(1, 1, MAP_W - 2, MAP_H - 2, 5);

    const rooms: Room[] = [];
    for (const leaf of leaves) {
      const rw = Math.max(3, Math.min(leaf.w - 2, 3 + Math.floor(rng() * 5)));
      const rh = Math.max(3, Math.min(leaf.h - 2, 3 + Math.floor(rng() * 5)));
      const rx = leaf.x + Math.floor(rng() * Math.max(1, leaf.w - rw - 1));
      const ry = leaf.y + Math.floor(rng() * Math.max(1, leaf.h - rh - 1));
      for (let y = ry; y < ry + rh; y++)
        for (let x = rx; x < rx + rw; x++) tiles[idx(x, y)] = T_FLOOR;
      rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + rw / 2, cy: ry + rh / 2 });
    }

    if (rooms.length < 5) continue;

    // Коридоры: MST (Крускал) + пара лишних петель
    const edges: { a: number; b: number; d: number }[] = [];
    for (let i = 0; i < rooms.length; i++)
      for (let j = i + 1; j < rooms.length; j++) {
        const d = Math.hypot(rooms[i].cx - rooms[j].cx, rooms[i].cy - rooms[j].cy);
        edges.push({ a: i, b: j, d });
      }
    edges.sort((p, q) => p.d - q.d);

    const parent = rooms.map((_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));

    const carve = (x1: number, y1: number, x2: number, y2: number) => {
      let x = Math.floor(x1);
      let y = Math.floor(y1);
      const ex = Math.floor(x2);
      const ey = Math.floor(y2);
      const dig = (dx: number, dy: number) => {
        for (let oy = 0; oy < 2; oy++)
          for (let ox = 0; ox < 2; ox++) {
            const tx = dx + ox;
            const ty = dy + oy;
            if (tx > 0 && ty > 0 && tx < MAP_W - 1 && ty < MAP_H - 1 && tiles[idx(tx, ty)] === T_WALL)
              tiles[idx(tx, ty)] = T_FLOOR;
          }
      };
      while (x !== ex) {
        dig(x, y);
        x += Math.sign(ex - x);
      }
      while (y !== ey) {
        dig(x, y);
        y += Math.sign(ey - y);
      }
      dig(x, y);
    };

    let linked = 0;
    for (const e of edges) {
      if (linked >= rooms.length - 1) break;
      const ra = find(e.a);
      const rb = find(e.b);
      if (ra !== rb) {
        parent[ra] = rb;
        carve(rooms[e.a].cx, rooms[e.a].cy, rooms[e.b].cx, rooms[e.b].cy);
        linked++;
      }
    }
    // две случайные петли для обходных путей
    for (let k = 0; k < 2 && edges.length > rooms.length; k++) {
      const e = edges[rooms.length - 1 + Math.floor(rng() * Math.min(6, edges.length - rooms.length + 1))];
      if (e && find(e.a) !== find(e.b)) {
        parent[find(e.a)] = find(e.b);
        carve(rooms[e.a].cx, rooms[e.a].cy, rooms[e.b].cx, rooms[e.b].cy);
      }
    }

    // Spawn — первая комната; лестница — самая дальняя
    const spawn = rooms[0];
    const spawnIdx = idx(Math.floor(spawn.cx), Math.floor(spawn.cy));
    let stairsRoom = rooms[1];
    let best = -1;
    for (const r of rooms) {
      const d = Math.hypot(r.cx - spawn.cx, r.cy - spawn.cy);
      if (d > best) { best = d; stairsRoom = r; }
    }
    const stairsIdx = idx(Math.floor(stairsRoom.cx), Math.floor(stairsRoom.cy));
    tiles[stairsIdx] = T_STAIRS;

    // Торговец на этажах, кратных 3
    let merchantIdx: number | null = null;
    if (floor % 3 === 0) {
      const cand = rooms.find((r) => r !== rooms[0] && r !== stairsRoom && r.w >= 4 && r.h >= 4) ?? rooms[1];
      if (cand && cand !== stairsRoom && cand !== rooms[0]) {
        merchantIdx = idx(Math.floor(cand.cx), Math.floor(cand.cy));
      }
    }

    // Ловушки
    const traps: number[] = [];
    const trapCount = Math.min(12, 4 + Math.floor(floor * 0.8));
    let guard = 0;
    while (traps.length < trapCount && guard++ < 400) {
      const r = rooms[1 + Math.floor(rng() * (rooms.length - 1))];
      const tx = r.x + 1 + Math.floor(rng() * Math.max(1, r.w - 2));
      const ty = r.y + 1 + Math.floor(rng() * Math.max(1, r.h - 2));
      const i = idx(Math.min(tx, r.x + r.w - 1), Math.min(ty, r.y + r.h - 1));
      if (tiles[i] === T_FLOOR && i !== spawnIdx && i !== merchantIdx) {
        tiles[i] = T_TRAP;
        traps.push(i);
      }
    }

    // Факелы: напольная клетка у стены
    const torches: Torch[] = [];
    for (const r of rooms) {
      const n = 1 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) {
        for (let tries = 0; tries < 12; tries++) {
          const tx = r.x + Math.floor(rng() * r.w);
          const ty = r.y + Math.floor(rng() * r.h);
          const fi = idx(tx, ty);
          if (tiles[fi] !== T_FLOOR) continue;
          const dirs = [
            [0, -1], [0, 1], [-1, 0], [1, 0],
          ];
          for (const [ox, oy] of dirs) {
            const wi = idx(tx + ox, ty + oy);
            if (tiles[wi] === T_WALL) {
              torches.push({ wall: wi, floor: fi });
              break;
            }
          }
          if (torches.length && torches[torches.length - 1].floor === fi) break;
        }
      }
    }

    return { tiles, rooms, stairsIdx, spawnIdx, merchantIdx, traps, torches };
  }
  // недостижимо при корректных размерах, но страховка
  const tiles = new Uint8Array(MAP_W * MAP_H).fill(T_FLOOR);
  tiles[idx(5, 5)] = T_STAIRS;
  return {
    tiles,
    rooms: [{ x: 1, y: 1, w: 10, h: 10, cx: 6, cy: 6 }],
    stairsIdx: idx(5, 5),
    spawnIdx: idx(2, 2),
    merchantIdx: null,
    traps: [],
    torches: [],
  };
}

export const tileX = (i: number) => i % MAP_W;
export const tileY = (i: number) => Math.floor(i / MAP_W);
export const toIdx = (x: number, y: number) => idx(x, y);
