// Moonlit Vault — tuning numbers and fixed level layouts.
// Grid 20 x 15, tile 48 px, canvas 960 x 720. Layouts are hand-designed
// (deterministic, learnable patrols) — nothing here is random.
export const TILE = 48;
export const COLS = 20;
export const ROWS = 15;
export const WIDTH = COLS * TILE; // 960
export const HEIGHT = ROWS * TILE; // 720
export const STEP = 1 / 60;

// Player movement (px/s).
export const PLAYER_RUN_SPEED = 175;
export const PLAYER_SNEAK_SPEED = 85;
export const PLAYER_RADIUS = 14;

// Detection meter 0..100 (see guards.js for the fill rule).
export const DETECT_BASE_RATE = 40; // per second at point-blank range
export const DETECT_DRAIN_RATE = 25; // per second while hidden
export const DETECT_SUSPICIOUS_AT = 30; // meter where a guard gets suspicious
export const DETECT_LIT_MULT = 1.5; // standing in a lit pool
export const DETECT_SNEAK_MULT = 0.5; // sneaking (Shift)
export const DETECT_SHADOW_MULT = 0.3; // standing in a shadow zone
export const DETECT_RUN_MULT = 1.5; // moving at full run speed

// Chase / search timers (seconds).
export const CHASE_MAX_TIME = 5;
export const CHASE_LOSE_SIGHT_TIME = 3;
export const SEARCH_LOOK_TIME = 4;
export const SUSPICIOUS_PAUSE_TIME = 1.2;
export const INVESTIGATE_LOOK_TIME = 2;

// Pebble distraction.
export const PEBBLES_PER_LEVEL = 3;
export const PEBBLE_FLIGHT_TIME = 0.5;
export const PEBBLE_MAX_RANGE = 6 * TILE;
export const PEBBLE_NOISE_RADIUS = 3 * TILE;

// Lives, scoring.
export const LIVES = 3;
export const SCORE_PER_ARTIFACT = 1000;
export const SCORE_NO_ALARM_BONUS = 500;
export const TIME_BONUS_PER_SECOND = 10; // of the par time left, per level

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

// A wall / cover / shadow entry is {x, y, w, h} in tiles unless noted.
export const LEVELS = [
  {
    name: 'The Gallery',
    parTime: 120,
    guards: [
      {
        waypoints: [[4, 2], [10, 2], [10, 6], [4, 6]],
        coneAngle: 60, coneRange: 210, patrolSpeed: 55, chaseSpeed: 190,
      },
      {
        waypoints: [[14, 3], [17, 3], [17, 11], [14, 11]],
        coneAngle: 60, coneRange: 210, patrolSpeed: 55, chaseSpeed: 190,
      },
    ],
    walls: [
      { x: 8, y: 3, w: 1, h: 3 },
      { x: 12, y: 9, w: 3, h: 1 },
    ],
    cover: [
      { kind: 'crate', x: 5, y: 4, w: 2, h: 2 },
      { kind: 'case', x: 11, y: 3, w: 2, h: 1 },
      { kind: 'bush', x: 14, y: 10, w: 1, h: 1 },
      { kind: 'crate', x: 4, y: 10, w: 2, h: 1 },
    ],
    shadows: [
      { x: 3, y: 6, w: 4, h: 2 },
      { x: 12, y: 11, w: 4, h: 2 },
    ],
    litPools: [
      { x: 480, y: 240, rx: 170, ry: 80 },
      { x: 720, y: 540, rx: 150, ry: 70 },
    ],
    artifacts: [[17, 2], [2, 11]],
    playerStart: [1, 13],
    exit: [19, 7],
  },
  {
    name: 'Vault Hall',
    parTime: 150,
    guards: [
      {
        waypoints: [[3, 2], [7, 2], [7, 5], [3, 5]],
        coneAngle: 70, coneRange: 230, patrolSpeed: 70, chaseSpeed: 195,
      },
      {
        waypoints: [[11, 2], [15, 2], [15, 6], [11, 6]],
        coneAngle: 70, coneRange: 230, patrolSpeed: 70, chaseSpeed: 195,
      },
      {
        waypoints: [[5, 9], [7, 9], [7, 12], [5, 12]],
        coneAngle: 70, coneRange: 230, patrolSpeed: 70, chaseSpeed: 195,
      },
    ],
    walls: [
      { x: 9, y: 2, w: 1, h: 4 }, // corridor wall, gap at y 6-7
      { x: 9, y: 8, w: 1, h: 4 },
    ],
    cover: [
      { kind: 'crate', x: 4, y: 3, w: 2, h: 2 },
      { kind: 'case', x: 13, y: 3, w: 2, h: 1 },
      { kind: 'bush', x: 6, y: 11, w: 1, h: 1 },
      { kind: 'crate', x: 15, y: 10, w: 2, h: 2 },
      { kind: 'case', x: 3, y: 8, w: 2, h: 1 },
    ],
    shadows: [
      { x: 2, y: 6, w: 3, h: 2 },
      { x: 13, y: 12, w: 4, h: 2 },
      { x: 16, y: 5, w: 2, h: 2 },
    ],
    litPools: [
      { x: 360, y: 180, rx: 150, ry: 70 },
      { x: 700, y: 300, rx: 170, ry: 80 },
      { x: 480, y: 560, rx: 150, ry: 70 },
    ],
    artifacts: [[18, 5], [2, 12], [11, 13]],
    playerStart: [1, 13],
    exit: [19, 7],
  },
  {
    name: 'The Vault',
    parTime: 180,
    guards: [
      {
        waypoints: [[2, 2], [5, 2], [5, 5], [2, 5]],
        coneAngle: 80, coneRange: 250, patrolSpeed: 85, chaseSpeed: 200,
      },
      {
        waypoints: [[14, 2], [17, 2], [17, 5], [14, 5]],
        coneAngle: 80, coneRange: 250, patrolSpeed: 85, chaseSpeed: 200,
      },
      {
        waypoints: [[2, 9], [5, 9], [5, 12], [2, 12]],
        coneAngle: 80, coneRange: 250, patrolSpeed: 85, chaseSpeed: 200,
      },
      {
        waypoints: [[14, 9], [17, 9], [17, 12], [14, 12]],
        coneAngle: 80, coneRange: 250, patrolSpeed: 85, chaseSpeed: 200,
      },
    ],
    walls: [
      { x: 6, y: 2, w: 1, h: 4 },
      { x: 13, y: 2, w: 1, h: 4 },
      { x: 6, y: 9, w: 1, h: 4 },
      { x: 13, y: 9, w: 1, h: 4 },
    ],
    cover: [
      { kind: 'crate', x: 9, y: 3, w: 2, h: 2 },
      { kind: 'case', x: 9, y: 11, w: 2, h: 1 },
      { kind: 'bush', x: 3, y: 7, w: 1, h: 1 },
      { kind: 'bush', x: 16, y: 7, w: 1, h: 1 },
      { kind: 'crate', x: 16, y: 11, w: 2, h: 1 },
    ],
    shadows: [
      { x: 7, y: 5, w: 3, h: 2 },
      { x: 2, y: 11, w: 3, h: 2 },
      { x: 15, y: 2, w: 3, h: 2 },
    ],
    litPools: [
      { x: 480, y: 360, rx: 200, ry: 90 },
      { x: 240, y: 150, rx: 120, ry: 60 },
      { x: 720, y: 600, rx: 130, ry: 60 },
    ],
    artifacts: [[18, 11], [2, 12], [10, 7]],
    playerStart: [1, 13],
    exit: [19, 7],
  },
];
