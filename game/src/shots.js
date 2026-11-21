// Screenshot scenes: each one plays the real rules forward from a fresh
// world with a scripted autopilot (BFS/Dijkstra over walkable tiles,
// steering the player the same way a keyboard would), so every frame is
// a real render of the game's own code and the same seed always gives
// the same frame. ?shot=cover|sneak|nearmiss|win&seed=1
import { COLS, ROWS, STEP, TILE, tileCenter } from './config.js';
import { createWorld, nextLevel, stepWorld } from './world.js';
import { GUARD_ALERT, guardSeesPlayer } from './guards.js';
import { hasLineOfSight, inShadow, tileWalkable } from './level.js';
import { makeRng } from './random.js';

const SAMPLE = STEP;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function tileOf(x, y) {
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

// Cost of stepping on a tile for the autopilot: cones are expensive
// (wait them out instead), lit floor mildly so, shadows free.
function tileCost(world, tx, ty, avoidCones) {
  const c = tileCenter(tx, ty);
  let cost = 1;
  if (inShadow(world.level, c.x, c.y)) cost -= 0.4;
  const pool = world.level.litPools.find((p) => {
    const dx = (c.x - p.x) / p.rx;
    const dy = (c.y - p.y) / p.ry;
    return dx * dx + dy * dy <= 1;
  });
  if (pool) cost += 2;
  if (avoidCones) {
    for (const guard of world.guards) {
      const dx = c.x - guard.x;
      const dy = c.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist < guard.spec.coneRange
        && Math.abs(angleDiff(Math.atan2(dy, dx), guard.facing)) < guard.spec.coneAngle / 2
        && hasLineOfSight(world.level, guard.x, guard.y, c.x, c.y)) {
        cost += 5;
      }
    }
  }
  return cost;
}

// Dijkstra over the tile grid; returns a list of pixel waypoints.
function findPath(world, fromTx, fromTy, toTx, toTy, avoidCones) {
  const key = (x, y) => y * COLS + x;
  const dist = new Map([[key(fromTx, fromTy), 0]]);
  const prev = new Map();
  const open = [[0, fromTx, fromTy]];
  const seen = new Set();
  while (open.length > 0) {
    open.sort((a, b) => a[0] - b[0]);
    const [d, x, y] = open.shift();
    if (seen.has(key(x, y))) continue;
    seen.add(key(x, y));
    if (x === toTx && y === toTy) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!tileWalkable(world.level, nx, ny)) continue;
      const nd = d + tileCost(world, nx, ny, avoidCones);
      if (nd < (dist.get(key(nx, ny)) ?? Infinity)) {
        dist.set(key(nx, ny), nd);
        prev.set(key(nx, ny), [x, y]);
        open.push([nd, nx, ny]);
      }
    }
  }
  if (!dist.has(key(toTx, toTy))) return null;
  const path = [];
  let cur = [toTx, toTy];
  while (cur) {
    path.unshift(tileCenter(cur[0], cur[1]));
    cur = prev.get(key(cur[0], cur[1])) ?? null;
  }
  return path;
}

export function makePilot(world) {
  return { path: [], repathIn: 0, objective: null };
}

function nearestShadowTile(world) {
  const player = world.player;
  let best = null;
  let bestDist = Infinity;
  let fallback = null;
  let fallbackDist = Infinity;
  // level.def.shadows are TILE rects (level.shadows are the same rects
  // in pixels — do not iterate those as tiles).
  for (const s of world.level.def.shadows) {
    for (let ty = s.y; ty < s.y + s.h; ty += 1) {
      for (let tx = s.x; tx < s.x + s.w; tx += 1) {
        const c = tileCenter(tx, ty);
        const d = Math.hypot(c.x - player.x, c.y - player.y);
        if (d < fallbackDist) { fallbackDist = d; fallback = { tx, ty }; }
        // Prefer a shadow no guard's cone is covering right now, and
        // no guard is standing next to — a tile 20 px from a guard is
        // not a hiding place, whatever the cone says.
        const watched = world.guards.some((g) => guardSeesPlayer(g, world.level, c.x, c.y));
        const tooClose = world.guards.some((g) => Math.hypot(g.x - c.x, g.y - c.y) < 150);
        if (!watched && !tooClose && d < bestDist) { bestDist = d; best = { tx, ty }; }
      }
    }
  }
  return best ?? fallback;
}

function nearestGoalPoint(world) {
  let best = null;
  let bestDist = Infinity;
  for (const a of world.level.artifacts) {
    if (a.taken) continue;
    const d = Math.hypot(a.x - world.player.x, a.y - world.player.y);
    if (d < bestDist) { bestDist = d; best = { x: a.x, y: a.y }; }
  }
  if (best) return best;
  return { x: world.level.exit.x, y: world.level.exit.y };
}

// The autopilot's objective: nearest untaken artifact, then the exit
// approach tile (18,7). Returns {x, y, sneak} to steer toward, or null
// to stand still (hiding while the meter drains).
function pilotTarget(world, pilot, avoidCones) {
  const player = world.player;
  const chased = world.guards.some((g) => g.state === GUARD_ALERT);
  const seenNow = world.guards.some((g) => guardSeesPlayer(g, world.level, player.x, player.y));
  // Flee first: a guard is watching the player (or chasing) — break
  // away to the nearest shadow outside every cone, where the meter
  // drains. Exception: already committed at the goal (a grab is
  // faster than a retreat), so finish it and go. Note a shadow only
  // slows detection, it does not block vision — standing still in one
  // while watched still fills the meter, so the player always moves.
  const goalPoint = nearestGoalPoint(world);
  const committed = goalPoint && Math.hypot(goalPoint.x - player.x, goalPoint.y - player.y) < 50;
  if ((seenNow || chased) && !committed) {
    const best = nearestShadowTile(world);
    if (best) return { target: best, sneak: false, hide: true };
    return { target: null, sneak: false, hide: true };
  }
  // Hiding: if a guard is close to spotting the player, go to the
  // nearest shadow tile and wait there until the meter drains. Never
  // hide while a guard is already chasing — then run for the goal.
  if (world.meter > 70 && !chased) {
    const best = nearestShadowTile(world);
    if (best && !inShadow(world.level, player.x, player.y)) {
      return { target: best, sneak: true, hide: true };
    }
    return { target: null, sneak: true, hide: true }; // already hidden: wait
  }
  let target = null;
  let targetTile = null;
  for (const a of world.level.artifacts) {
    if (a.taken) continue;
    const t = tileOf(a.x, a.y);
    const d = Math.hypot(a.x - player.x, a.y - player.y);
    if (!target || d < target.d) { target = { ...a, d }; targetTile = t; }
  }
  if (target) {
    // The grab itself must be timed: if a guard is watching the
    // artifact right now, wait in the nearest shadow instead of
    // walking into the cone (unless already committed at the grab).
    const watched = world.guards.some((g) => guardSeesPlayer(g, world.level, target.x, target.y));
    if (watched && target.d > 40) {
      const best = nearestShadowTile(world);
      if (best && !inShadow(world.level, player.x, player.y)) {
        return { target: best, sneak: true, hide: true };
      }
      return { target: null, sneak: true, hide: true };
    }
  }
  if (!target) {
    // All artifacts taken: the exit. If a guard is watching the exit
    // approach or the corridor leading to it right now, wait in the
    // nearest shadow instead of walking into the cone (unless already
    // committed at the door).
    const approach = tileCenter(18, 7);
    const corridor = tileCenter(17, 7);
    const exit = world.level.exit;
    const nearExit = Math.hypot(player.x - exit.x, player.y - exit.y) < 60;
    const watched = world.guards.some((g) => guardSeesPlayer(g, world.level, approach.x, approach.y)
      || guardSeesPlayer(g, world.level, corridor.x, corridor.y));
    if (watched && !nearExit) {
      const best = nearestShadowTile(world);
      if (best && !inShadow(world.level, player.x, player.y)) {
        return { target: best, sneak: true, hide: true };
      }
      return { target: null, sneak: true, hide: true };
    }
    targetTile = { tx: 18, ty: 7 }; // exit approach
    target = { x: exit.x, y: exit.y };
  }
  return { target: targetTile, sneak: false, hide: false, goal: target };
}

export function pilotInput(world, pilot, avoidCones) {
  const player = world.player;
  pilot.repathIn -= SAMPLE;
  const pick = pilotTarget(world, pilot, avoidCones);
  // Hiding in place (already in a shadow): stand still, sneak on.
  if (pick.hide && !pick.target) return { mx: 0, my: 0, sneak: true };
  // Otherwise steer along a path — to an artifact, the exit, or a
  // shadow tile to hide in. Hiding routes through the pathfinder like
  // everything else, so the pilot never stalls against a wall or crate.
  const here = tileOf(player.x, player.y);
  const tgt = pick.target;
  // Re-path on the timer, or when the objective changed — but NOT the
  // moment the path runs out: then the player is already on the target
  // tile and steers straight for the goal point itself (the artifact,
  // or the exit door just past the approach tile). Re-pathing at once
  // would drag it back to the tile centre and ping-pong it forever.
  if (pilot.repathIn <= 0 || (pilot.goalTx !== tgt.tx || pilot.goalTy !== tgt.ty)) {
    pilot.path = findPath(world, here.tx, here.ty, tgt.tx, tgt.ty, avoidCones) ?? [];
    pilot.repathIn = 0.5;
    pilot.goalTx = tgt.tx;
    pilot.goalTy = tgt.ty;
  }
  // Drop waypoints already reached — including the last one, so the
  // pilot then steers straight for the goal point itself (the artifact,
  // or the exit door just past the approach tile) instead of stopping
  // a few pixels short of it.
  while (pilot.path.length && Math.hypot(pilot.path[0].x - player.x, pilot.path[0].y - player.y) < 10) pilot.path.shift();
  // Sneak when hiding, or when a guard is near but not watching the
  // player — the sneak multiplier halves the fill rate if a cone sweeps
  // in. Never sneak while being chased or while a guard is watching
  // the player right now: then speed out of the cone matters more.
  const chased = world.guards.some((g) => g.state === GUARD_ALERT);
  const seenNow = world.guards.some((g) => guardSeesPlayer(g, world.level, player.x, player.y));
  let sneak = pick.sneak || false;
  if (!chased && !seenNow) {
    for (const guard of world.guards) {
      if (guard.state !== GUARD_ALERT && Math.hypot(guard.x - player.x, guard.y - player.y) < 170) sneak = true;
    }
  } else {
    sneak = false;
  }
  if (!pilot.path.length) {
    // Path exhausted: head straight for the goal point itself (the
    // artifact, or the exit door just past the approach tile).
    if (pick.goal) return steerTo(player, pick.goal.x, pick.goal.y, sneak);
    return { mx: 0, my: 0, sneak: false };
  }
  const node = pilot.path[0];
  return steerTo(player, node.x, node.y, sneak);
}

function steerTo(player, x, y, sneak) {
  const dx = x - player.x;
  const dy = y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) return { mx: 0, my: 0, sneak };
  return { mx: dx / dist, my: dy / dist, sneak };
}

// Turn a pilot steering vector into the key set stepWorld reads.
function inputFromPilot(pilotVec) {
  const keys = new Set();
  if (pilotVec.mx > 0.3) keys.add('KeyD');
  if (pilotVec.mx < -0.3) keys.add('KeyA');
  if (pilotVec.my > 0.3) keys.add('KeyS');
  if (pilotVec.my < -0.3) keys.add('KeyW');
  if (pilotVec.sneak) keys.add('ShiftLeft');
  return { keys, mouse: { x: 0, y: 0, clicked: false } };
}

export function stepPilot(world, pilot, avoidCones) {
  const vec = pilotInput(world, pilot, avoidCones);
  return stepWorld(world, inputFromPilot(vec), SAMPLE);
}

/**
 * Stage the named scene on a fresh level-1 world and return the screen
 * to draw over it. Scenes: cover (title overview), sneak (crouched in
 * shadow as a cone sweeps past), nearmiss (meter ~85, guard turning),
 * win (all artifacts, at the open exit).
 */
export function stageShot(name, seed) {
  const rng = makeRng(seed || 1);
  let world = createWorld(0, rng);
  let pilot = makePilot(world);

  if (name === 'cover') {
    world.screen = 'play';
    for (let i = 0; i < 5 / SAMPLE; i += 1) {
      stepWorld(world, { keys: new Set(), mouse: { x: 0, y: 0, clicked: false } }, SAMPLE);
    }
    world.screen = 'title';
    return { world, screen: 'title' };
  }

  if (name === 'sneak') {
    world.screen = 'play';
    // Walk (sneaking) to the shadow lane behind the crate cluster at
    // (3,6)-(6,7); stop once hidden with a guard sweeping nearby.
    const target = { tx: 4, ty: 7 };
    let path = [];
    let repathIn = 0;
    for (let i = 0; i < 40 / SAMPLE; i += 1) {
      repathIn -= SAMPLE;
      if (!path.length || repathIn <= 0) {
        const here = tileOf(world.player.x, world.player.y);
        path = findPath(world, here.tx, here.ty, target.tx, target.ty, true) ?? [];
        repathIn = 0.5;
      }
      while (path.length > 1 && Math.hypot(path[0].x - world.player.x, path[0].y - world.player.y) < 10) path.shift();
      const node = path[0];
      const vec = node ? steerTo(world.player, node.x, node.y, true) : { mx: 0, my: 0, sneak: true };
      stepWorld(world, inputFromPilot(vec), SAMPLE);
      const near = world.guards.some((g) => Math.hypot(g.x - world.player.x, g.y - world.player.y) < 280);
      if (inShadow(world.level, world.player.x, world.player.y) && near && world.meter < 40) break;
    }
    return { world, screen: 'play' };
  }

  if (name === 'nearmiss') {
    world.screen = 'play';
    // Chase guard 0's cone: keep re-targeting the tile just ahead of
    // the guard as it patrols, step into the light, and freeze the
    // moment the meter is nearly full — a real near miss, played forward.
    let path = [];
    let repathIn = 0;
    for (let i = 0; i < 40 / SAMPLE; i += 1) {
      repathIn -= SAMPLE;
      if (!path.length || repathIn <= 0) {
        const guard = world.guards[0];
        const aheadX = guard.x + Math.cos(guard.facing) * 110;
        const aheadY = guard.y + Math.sin(guard.facing) * 110;
        let tx = Math.floor(aheadX / TILE);
        let ty = Math.floor(aheadY / TILE);
        if (!tileWalkable(world.level, tx, ty)) { tx = Math.floor(guard.x / TILE); ty = Math.floor(guard.y / TILE); }
        const here = tileOf(world.player.x, world.player.y);
        path = findPath(world, here.tx, here.ty, tx, ty, false) ?? [];
        repathIn = 0.5;
      }
      while (path.length > 1 && Math.hypot(path[0].x - world.player.x, path[0].y - world.player.y) < 10) path.shift();
      const node = path[0];
      const vec = node ? steerTo(world.player, node.x, node.y, false) : { mx: 0, my: 0, sneak: false };
      stepWorld(world, inputFromPilot(vec), SAMPLE);
      if (world.meter >= 82) break;
    }
    // Hold still in the cone until the meter reads ~85.
    for (let i = 0; i < 20 / SAMPLE && world.meter < 82; i += 1) {
      stepWorld(world, { keys: new Set(), mouse: { x: 0, y: 0, clicked: false } }, SAMPLE);
    }
    return { world, screen: 'play' };
  }

  // win: full autopilot playthrough of all three vaults, cones avoided,
  // until the player reaches the open exit of the last one.
  world.screen = 'play';
  let won = false;
  for (let i = 0; i < 900 / SAMPLE; i += 1) {
    stepPilot(world, pilot, true);
    if (world.screen === 'win') { won = true; break; }
    if (world.screen === 'clear') {
      world = nextLevel(world);
      pilot = makePilot(world);
      continue;
    }
    if (world.screen === 'caught' || world.screen === 'over') break;
  }
  return { world, screen: won ? 'win' : world.screen };
}
