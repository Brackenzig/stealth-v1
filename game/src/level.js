// Level world: walls, cover, shadows, lit pools, artifacts, exit.
// Everything is built from the fixed layouts in config.js; the border
// walls ring the arena except for the exit door on the right edge.
import { COLS, ROWS, TILE, tileCenter } from './config.js';

function rectPx(r) {
  return { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE };
}

export function buildLevel(def) {
  const walls = [];
  // Border walls (thickness 1 tile), leaving the exit tile open.
  for (let x = 0; x < COLS; x += 1) {
    walls.push({ x: x * TILE, y: 0, w: TILE, h: TILE });
    walls.push({ x: x * TILE, y: (ROWS - 1) * TILE, w: TILE, h: TILE });
  }
  for (let y = 1; y < ROWS - 1; y += 1) {
    walls.push({ x: 0, y: y * TILE, w: TILE, h: TILE });
    if (!(y === def.exit[1])) walls.push({ x: (COLS - 1) * TILE, y: y * TILE, w: TILE, h: TILE });
  }
  for (const w of def.walls) walls.push(rectPx(w));

  const cover = def.cover.map((c) => ({ kind: c.kind, ...rectPx(c) }));
  const shadows = def.shadows.map(rectPx);
  const litPools = def.litPools.map((p) => ({ ...p }));
  const artifacts = def.artifacts.map(([tx, ty]) => ({ ...tileCenter(tx, ty), taken: false }));
  const exit = { ...tileCenter(def.exit[0], def.exit[1]), open: false };
  const playerStart = tileCenter(def.playerStart[0], def.playerStart[1]);
  const guards = def.guards.map((g) => ({
    waypoints: g.waypoints.map(([tx, ty]) => tileCenter(tx, ty)),
    coneAngle: (g.coneAngle * Math.PI) / 180,
    coneRange: g.coneRange,
    patrolSpeed: g.patrolSpeed,
    chaseSpeed: g.chaseSpeed,
  }));
  return { def, walls, cover, shadows, litPools, artifacts, exit, playerStart, guards };
}

export function pointInRect(px, py, r) {
  return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
}

export function pointInEllipse(px, py, e) {
  const dx = (px - e.x) / e.rx;
  const dy = (py - e.y) / e.ry;
  return dx * dx + dy * dy <= 1;
}

// True when the point is inside any wall or cover rect (both block
// movement and line of sight).
export function pointBlocked(level, px, py) {
  for (const w of level.walls) if (pointInRect(px, py, w)) return true;
  for (const c of level.cover) if (pointInRect(px, py, c)) return true;
  return false;
}

// Circle (x, y, radius) vs every solid rect: returns the corrected
// position after sliding along the rects, axis by axis.
export function moveCircle(level, x, y, dx, dy, radius) {
  let nx = x + dx;
  for (const r of level.walls.concat(level.cover)) {
    if (nx + radius > r.x && nx - radius < r.x + r.w && y + radius > r.y && y - radius < r.y + r.h) {
      nx = dx > 0 ? r.x - radius : r.x + r.w + radius;
    }
  }
  let ny = y + dy;
  for (const r of level.walls.concat(level.cover)) {
    if (nx + radius > r.x && nx - radius < r.x + r.w && ny + radius > r.y && ny - radius < r.y + r.h) {
      ny = dy > 0 ? r.y - radius : r.y + r.h + radius;
    }
  }
  return { x: nx, y: ny };
}

export function inShadow(level, px, py) {
  for (const s of level.shadows) if (pointInRect(px, py, s)) return true;
  return false;
}

export function inLitPool(level, px, py) {
  for (const p of level.litPools) if (pointInEllipse(px, py, p)) return true;
  return false;
}

// Line of sight: sample the segment; a wall or cover rect in the way
// blocks vision. Short steps keep thin walls from being skipped.
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointBlocked(level, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

// Walkable tile for the autopilot's pathfinder (no wall, no cover,
// not the exit door tile itself).
export function tileWalkable(level, tx, ty) {
  if (tx < 1 || ty < 1 || tx > COLS - 2 || ty > ROWS - 2) return false;
  const cx = tx * TILE + TILE / 2;
  const cy = ty * TILE + TILE / 2;
  return !pointBlocked(level, cx, cy);
}
