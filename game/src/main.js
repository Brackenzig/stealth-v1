// Moonlit Vault — game loop, screens, input, sound wiring.
// A top-down stealth game: steal every artifact and reach the green
// exit unseen, past guards with vision cones.
import { HEIGHT, STEP, WIDTH } from './config.js';
import { createAudio, ensureAudio, playAlarm, playCaught, playGuardStep, playPebble, playPickup, playPlayerStep, playWin } from './audio.js';
import { makeRng } from './random.js';
import { drawHUD, drawOverlay, drawWorld } from './render.js';
import { stageShot } from './shots.js';
import { createInput } from './player.js';
import { createWorld, nextLevel, resetLevel, stepWorld } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = WIDTH;
canvas.height = HEIGHT;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '1') || 1;
const rng = makeRng(seed);

const audio = createAudio();
const input = createInput();
let world = createWorld(0, rng);
let time = 0;
let lastFrame = performance.now();
let playerStepTimer = 0;
let guardStepTimer = 0;

function canvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * WIDTH,
    y: ((clientY - rect.top) / rect.height) * HEIGHT,
  };
}

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  ensureAudio(audio);
  input.keys.add(event.code);
  if (event.code === 'Enter') {
    if (world.screen === 'title') world.screen = 'play';
    else if (world.screen === 'clear') world = nextLevel(world);
  }
  if (event.code === 'KeyR') {
    if (world.screen === 'caught') world = resetLevel(world);
    else if (world.screen === 'over' || world.screen === 'win') world = createWorld(0, makeRng(seed));
  }
});

window.addEventListener('keyup', (event) => {
  input.keys.delete(event.code);
});

canvas.addEventListener('mousedown', (event) => {
  ensureAudio(audio);
  const p = canvasPoint(event.clientX, event.clientY);
  input.mouse.x = p.x;
  input.mouse.y = p.y;
  input.mouse.clicked = true;
});

function handleEvents(events) {
  if (events.picked) playPickup(audio);
  if (events.alarmed) playAlarm(audio);
  if (events.pebbleLanded) playPebble(audio);
  if (events.caught) playCaught(audio);
  if (events.won) playWin(audio);
}

function playSteps(dt) {
  const player = world.player;
  if (player.moving) {
    playerStepTimer -= dt;
    if (playerStepTimer <= 0) {
      playPlayerStep(audio, player.sneaking);
      playerStepTimer = player.sneaking ? 0.7 : 0.45;
    }
  }
  guardStepTimer -= dt;
  if (guardStepTimer <= 0) {
    let nearest = Infinity;
    for (const guard of world.guards) {
      const d = Math.hypot(guard.x - player.x, guard.y - player.y);
      if (d < nearest) nearest = d;
    }
    if (nearest < 420) playGuardStep(audio, nearest);
    guardStepTimer = 0.55;
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  time += dt;
  let acc = dt;
  while (acc > 0) {
    const step = Math.min(STEP, acc);
    const events = stepWorld(world, input, step);
    handleEvents(events);
    acc -= step;
  }
  if (world.screen === 'play') playSteps(dt);
  drawWorld(ctx, world, time);
  if (world.screen === 'play') drawHUD(ctx, world);
  else drawOverlay(ctx, world);
  requestAnimationFrame(frame);
}

// Staged screenshot mode: play the real rules forward, then draw one
// frozen frame. No animation loop runs, so the shot is deterministic.
if (shotName) {
  const staged = stageShot(shotName, seed);
  world = staged.world;
  time = 0;
  drawWorld(ctx, world, 0);
  if (staged.screen === 'play') drawHUD(ctx, world);
  else drawOverlay(ctx, world);
  document.title = `Moonlit Vault — ${shotName}`;
} else {
  requestAnimationFrame(frame);
}

// Test handle for the automated play-test (not part of the game UI):
// lets a script read state, place the player, and drive the simulation.
window.__moonlit = {
  get state() { return world; },
  get input() { return input; },
  start() { world.screen = 'play'; },
  setPlayer(x, y) { world.player.x = x; world.player.y = y; },
  restart() { world = createWorld(0, makeRng(seed)); },
};
