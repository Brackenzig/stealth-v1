// Player: keyboard movement, sneak, and the pebble toss.
// Input state lives here so the game loop and the autopilot share it.
import { PEBBLES_PER_LEVEL, PEBBLE_FLIGHT_TIME, PEBBLE_MAX_RANGE, PLAYER_RADIUS, PLAYER_RUN_SPEED, PLAYER_SNEAK_SPEED } from './config.js';
import { moveCircle } from './level.js';

export function createPlayer(start) {
  return {
    x: start.x, y: start.y,
    facing: -Math.PI / 2,
    sneaking: false,
    running: false,
    moving: false,
    stepPhase: 0,
    pebbles: PEBBLES_PER_LEVEL,
    pebble: null, // {x0,y0,x1,y1,t} while a pebble is in the air
  };
}

export function createInput() {
  return {
    keys: new Set(),
    mouse: { x: 0, y: 0, clicked: false },
  };
}

export function updatePlayer(player, input, level, dt) {
  const up = input.keys.has('KeyW') || input.keys.has('ArrowUp');
  const down = input.keys.has('KeyS') || input.keys.has('ArrowDown');
  const left = input.keys.has('KeyA') || input.keys.has('ArrowLeft');
  const right = input.keys.has('KeyD') || input.keys.has('ArrowRight');
  let dx = (right ? 1 : 0) - (left ? 1 : 0);
  let dy = (down ? 1 : 0) - (up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  player.sneaking = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  if (len > 0) {
    dx /= len;
    dy /= len;
    const speed = player.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_RUN_SPEED;
    const moved = moveCircle(level, player.x, player.y, dx * speed * dt, dy * speed * dt, PLAYER_RADIUS);
    player.x = moved.x;
    player.y = moved.y;
    player.facing = Math.atan2(dy, dx);
    player.moving = true;
    player.running = !player.sneaking;
    player.stepPhase += dt;
  } else {
    player.moving = false;
    player.running = false;
  }
  if (input.mouse.clicked) {
    input.mouse.clicked = false;
    tossPebble(player, input.mouse.x, input.mouse.y);
  }
  if (player.pebble) {
    player.pebble.t += dt / PEBBLE_FLIGHT_TIME;
    if (player.pebble.t >= 1) {
      const landed = { x: player.pebble.x1, y: player.pebble.y1 };
      player.pebble = null;
      return { pebbleLanded: landed };
    }
  }
  return null;
}

// Click tosses a pebble toward the cursor (clamped to max range).
// Returns true when a pebble was actually thrown.
export function tossPebble(player, mx, my) {
  if (player.pebbles <= 0 || player.pebble) return false;
  const dx = mx - player.x;
  const dy = my - player.y;
  const dist = Math.hypot(dx, dy);
  const range = Math.min(dist, PEBBLE_MAX_RANGE);
  const nx = dist > 0 ? dx / dist : 1;
  const ny = dist > 0 ? dy / dist : 0;
  player.pebbles -= 1;
  player.pebble = { x0: player.x, y0: player.y, x1: player.x + nx * range, y1: player.y + ny * range, t: 0 };
  return true;
}

export function pebblePosition(player) {
  const p = player.pebble;
  if (!p) return null;
  const t = Math.min(1, p.t);
  return { x: p.x0 + (p.x1 - p.x0) * t, y: p.y0 + (p.y1 - p.y0) * t, height: Math.sin(t * Math.PI) * 26 };
}
