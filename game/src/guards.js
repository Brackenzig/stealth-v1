// Guards: patrol waypoints, vision cones, line of sight, the detection
// meter, and the state machine patrol -> suspicious -> alert (chase) ->
// search -> patrol, plus pebble investigation.
import {
  CHASE_LOSE_SIGHT_TIME, CHASE_MAX_TIME, DETECT_BASE_RATE, DETECT_DRAIN_RATE,
  DETECT_LIT_MULT, DETECT_RUN_MULT, DETECT_SHADOW_MULT, DETECT_SNEAK_MULT,
  DETECT_SUSPICIOUS_AT, INVESTIGATE_LOOK_TIME, PLAYER_RADIUS, SEARCH_LOOK_TIME,
  SUSPICIOUS_PAUSE_TIME,
} from './config.js';
import { hasLineOfSight, inLitPool, inShadow, moveCircle, pointBlocked } from './level.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_SEARCH = 'search';
export const GUARD_INVESTIGATE = 'investigate';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function createGuard(spec, rng) {
  const start = spec.waypoints[0];
  return {
    x: start.x, y: start.y,
    facing: 0,
    waypointIndex: 1,
    state: GUARD_PATROL,
    stateTime: 0,
    chaseTime: 0,
    unseenTime: 0,
    lastSeen: null,
    investigateTarget: null,
    stuckTime: 0,
    lastProgressX: start.x, lastProgressY: start.y,
    stepPhase: rng() * 0.5,
    spec,
  };
}

// True when the guard can see the player right now: inside the cone,
// in range, and line of sight clear.
export function guardSeesPlayer(guard, level, px, py) {
  const dx = px - guard.x;
  const dy = py - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > guard.spec.coneRange) return false;
  if (dist > 1 && Math.abs(angleDiff(Math.atan2(dy, dx), guard.facing)) > guard.spec.coneAngle / 2) return false;
  return hasLineOfSight(level, guard.x, guard.y, px, py);
}

// Detection fill for one guard this step. Only a guard that sees the
// player fills the meter; the rate scales down with distance and by
// light / sneak / shadow / run, exactly as the brief's numbers say.
export function detectionRate(guard, level, player) {
  const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
  let rate = DETECT_BASE_RATE * (1 - (0.6 * dist) / guard.spec.coneRange);
  if (inLitPool(level, player.x, player.y)) rate *= DETECT_LIT_MULT;
  if (player.sneaking) rate *= DETECT_SNEAK_MULT;
  if (inShadow(level, player.x, player.y)) rate *= DETECT_SHADOW_MULT;
  if (player.running) rate *= DETECT_RUN_MULT;
  return rate;
}

function moveToward(guard, level, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const moved = moveCircle(level, guard.x, guard.y, (dx / dist) * step, (dy / dist) * step, 13);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.facing = Math.atan2(dy, dx);
  return dist <= speed * dt + 2;
}

// Stuck guard? A patrol leg that cannot be walked (layout safety net)
// is skipped after 1.5 s without progress instead of wedging the guard.
function trackStuck(guard, dt) {
  const moved = Math.hypot(guard.x - guard.lastProgressX, guard.y - guard.lastProgressY);
  if (moved > 4) {
    guard.stuckTime = 0;
    guard.lastProgressX = guard.x;
    guard.lastProgressY = guard.y;
    return false;
  }
  guard.stuckTime += dt;
  return guard.stuckTime > 1.5;
}

export function updateGuard(guard, level, player, dt, events) {
  guard.stateTime += dt;
  guard.stepPhase += dt;
  const sees = guardSeesPlayer(guard, level, player.x, player.y);
  const prevState = guard.state;

  if (guard.state === GUARD_PATROL) {
    const target = guard.spec.waypoints[guard.waypointIndex];
    const arrived = moveToward(guard, level, target.x, target.y, guard.spec.patrolSpeed, dt);
    if (arrived || trackStuck(guard, dt)) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.spec.waypoints.length;
      guard.stuckTime = 0;
    }
    if (sees) {
      guard.lastSeen = { x: player.x, y: player.y };
      guard.facing = Math.atan2(player.y - guard.y, player.x - guard.x);
    }
  } else if (guard.state === GUARD_SUSPICIOUS) {
    if (sees) guard.facing = Math.atan2(player.y - guard.y, player.x - guard.x);
    if (guard.stateTime >= SUSPICIOUS_PAUSE_TIME) {
      guard.state = GUARD_PATROL;
      guard.stateTime = 0;
    }
  } else if (guard.state === GUARD_ALERT) {
    guard.chaseTime += dt;
    if (sees) {
      guard.unseenTime = 0;
      guard.lastSeen = { x: player.x, y: player.y };
      guard.facing = Math.atan2(player.y - guard.y, player.x - guard.x);
    } else {
      guard.unseenTime += dt;
    }
    const target = guard.lastSeen ?? { x: player.x, y: player.y };
    moveToward(guard, level, target.x, target.y, guard.spec.chaseSpeed, dt);
    const caught = Math.hypot(player.x - guard.x, player.y - guard.y) < PLAYER_RADIUS + 13;
    if (caught) events.caught = true;
    if (guard.chaseTime >= CHASE_MAX_TIME || guard.unseenTime >= CHASE_LOSE_SIGHT_TIME) {
      guard.state = GUARD_SEARCH;
      guard.stateTime = 0;
    }
  } else if (guard.state === GUARD_SEARCH) {
    if (guard.lastSeen) {
      const arrived = moveToward(guard, level, guard.lastSeen.x, guard.lastSeen.y, guard.spec.patrolSpeed * 1.2, dt);
      if (arrived) guard.facing += dt * 1.5; // look around
    }
    if (guard.stateTime >= SEARCH_LOOK_TIME) {
      guard.state = GUARD_PATROL;
      guard.stateTime = 0;
    }
  } else if (guard.state === GUARD_INVESTIGATE) {
    const target = guard.investigateTarget;
    if (target) {
      const arrived = moveToward(guard, level, target.x, target.y, guard.spec.patrolSpeed * 1.3, dt);
      if (arrived) {
        guard.facing += dt * 1.2;
        if (guard.stateTime >= INVESTIGATE_LOOK_TIME) {
          guard.state = GUARD_PATROL;
          guard.stateTime = 0;
        }
      }
    }
  }

  if (prevState !== guard.state) {
    guard.stateTime = 0;
    if (guard.state === GUARD_ALERT) guard.chaseTime = 0;
    if (guard.state === GUARD_ALERT) guard.unseenTime = 0;
  }
  return sees;
}

// A pebble landing: every guard inside the noise radius walks over to
// look at the landing point.
export function pebbleHeard(guard, px, py, radius) {
  if (guard.state === GUARD_ALERT) return;
  if (Math.hypot(px - guard.x, py - guard.y) > radius) return;
  guard.state = GUARD_INVESTIGATE;
  guard.stateTime = 0;
  guard.investigateTarget = { x: px, y: py };
}

// Shared detection meter update: any guard that sees the player fills
// it; when none does, it drains. Returns the new meter value.
export function updateDetection(state, level, dt) {
  let anySees = false;
  for (const guard of state.guards) {
    if (guard.seesPlayer) {
      anySees = true;
      state.meter = Math.min(100, state.meter + detectionRate(guard, level, state.player) * dt);
    }
  }
  if (!anySees) state.meter = Math.max(0, state.meter - DETECT_DRAIN_RATE * dt);
  if (state.meter >= 100 && !state.alarmed) {
    state.alarmed = true;
    for (const guard of state.guards) {
      if (guard.seesPlayer) {
        guard.state = GUARD_ALERT;
        guard.stateTime = 0;
        guard.chaseTime = 0;
        guard.unseenTime = 0;
        guard.lastSeen = { x: state.player.x, y: state.player.y };
      }
    }
  }
  if (state.meter < DETECT_SUSPICIOUS_AT) state.alarmed = false;
  // A glimpse makes a patrolling guard pause and look ("?").
  for (const guard of state.guards) {
    if (guard.state === GUARD_PATROL && guard.seesPlayer && state.meter >= DETECT_SUSPICIOUS_AT && state.meter < 100) {
      guard.state = GUARD_SUSPICIOUS;
      guard.stateTime = 0;
    }
  }
  return state.meter;
}

export { pointBlocked };
