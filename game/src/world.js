// World: one level's live state and the fixed-step simulation the real
// game loop and the screenshot autopilot both run.
import {
  LEVELS, LIVES, PEBBLE_NOISE_RADIUS, SCORE_NO_ALARM_BONUS,
  SCORE_PER_ARTIFACT, STEP, TIME_BONUS_PER_SECOND, TILE,
} from './config.js';
import { createGuard, pebbleHeard, updateDetection, updateGuard } from './guards.js';
import { buildLevel } from './level.js';
import { createPlayer, updatePlayer } from './player.js';

export function createWorld(levelIndex, rng) {
  const def = LEVELS[levelIndex];
  const level = buildLevel(def);
  return {
    levelIndex,
    level,
    player: createPlayer(level.playerStart),
    guards: level.guards.map((g) => createGuard(g, rng)),
    meter: 0,
    alarmed: false,
    levelAlarmed: false,
    lives: LIVES,
    score: 0,
    levelScore: 0,
    timeBonus: 0,
    artifactsTaken: 0,
    noAlarm: true,
    timeLeft: def.parTime,
    elapsed: 0,
    screen: 'title',
    rng,
  };
}

export function resetLevel(world) {
  const fresh = createWorld(world.levelIndex, world.rng);
  const takenThisLevel = world.level.artifacts.filter((a) => a.taken).length;
  fresh.lives = world.lives;
  fresh.score = world.score;
  fresh.artifactsTaken = world.artifactsTaken - takenThisLevel;
  fresh.noAlarm = world.noAlarm;
  fresh.screen = 'play';
  return fresh;
}

// One fixed step of live play. `input` is {keys:Set, mouse:{...}}.
// Returns events the caller turns into sound / screen changes.
export function stepWorld(world, input, dt) {
  const events = { picked: false, alarmed: false, caught: false, won: false, cleared: false, pebbleLanded: null };
  if (world.screen !== 'play') return events;
  world.elapsed += dt;
  world.timeLeft = Math.max(0, world.timeLeft - dt);

  const pebbleEvent = updatePlayer(world.player, input, world.level, dt);
  if (pebbleEvent && pebbleEvent.pebbleLanded) {
    events.pebbleLanded = pebbleEvent.pebbleLanded;
    for (const guard of world.guards) pebbleHeard(guard, pebbleEvent.pebbleLanded.x, pebbleEvent.pebbleLanded.y, PEBBLE_NOISE_RADIUS);
  }

  const guardEvents = { caught: false };
  for (const guard of world.guards) {
    guard.seesPlayer = updateGuard(guard, world.level, world.player, dt, guardEvents);
  }
  updateDetection(world, world.level, dt);
  if (world.alarmed && !world.levelAlarmed) {
    world.levelAlarmed = true;
    world.noAlarm = false;
    events.alarmed = true;
  }

  // Artifact pickup on touch.
  for (const a of world.level.artifacts) {
    if (!a.taken && Math.hypot(world.player.x - a.x, world.player.y - a.y) < 30) {
      a.taken = true;
      world.artifactsTaken += 1;
      events.picked = true;
    }
  }
  const allTaken = world.level.artifacts.every((a) => a.taken);
  world.level.exit.open = allTaken;

  if (guardEvents.caught) {
    events.caught = true;
    world.lives -= 1;
    world.screen = world.lives > 0 ? 'caught' : 'over';
    return events;
  }

  // Exit: step onto the open green door to clear the vault.
  const exit = world.level.exit;
  if (exit.open && Math.hypot(world.player.x - exit.x, world.player.y - exit.y) < 36) {
    const timeBonus = Math.round(world.timeLeft * TIME_BONUS_PER_SECOND);
    const noAlarmBonus = world.levelAlarmed ? 0 : SCORE_NO_ALARM_BONUS;
    world.levelScore = world.level.artifacts.length * SCORE_PER_ARTIFACT + timeBonus + noAlarmBonus;
    world.score += world.levelScore;
    world.timeBonus = timeBonus;
    if (world.levelIndex >= LEVELS.length - 1) {
      world.screen = 'win';
      events.won = true;
    } else {
      world.screen = 'clear';
      events.cleared = true;
    }
  }
  return events;
}

// Advance to the next level after a clear screen.
export function nextLevel(world) {
  const next = createWorld(world.levelIndex + 1, world.rng);
  next.lives = world.lives;
  next.score = world.score;
  next.artifactsTaken = world.artifactsTaken;
  next.noAlarm = world.noAlarm && !world.levelAlarmed;
  next.screen = 'play';
  return next;
}

export { STEP, TILE };
