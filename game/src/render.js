// Render: every pixel the game draws — floor, lighting (lit pools vs
// shadow), cover, walls, guards with vision cones, player, artifacts,
// exit, HUD and the title / clear / win / caught screens.
import { HEIGHT, TILE, WIDTH } from './config.js';
import { GUARD_ALERT, GUARD_INVESTIGATE, GUARD_SEARCH, GUARD_SUSPICIOUS } from './guards.js';
import { inLitPool, inShadow } from './level.js';
import { pebblePosition } from './player.js';

const FLOOR_A = '#1d2740';
const FLOOR_B = '#1a2238';
const WALL_FILL = '#2e3a58';
const WALL_EDGE = '#4a5c86';

export function drawWorld(ctx, state, time) {
  const level = state.level;
  // Floor: dark blue-grey checker, faint grid.
  for (let ty = 0; ty < 15; ty += 1) {
    for (let tx = 0; tx < 20; tx += 1) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? FLOOR_A : FLOOR_B;
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  // Moonlit glow in the top-left corner (the "moonlit" of the vault).
  const moon = ctx.createRadialGradient(70, 60, 8, 70, 60, 130);
  moon.addColorStop(0, 'rgba(235,240,255,0.30)');
  moon.addColorStop(1, 'rgba(235,240,255,0)');
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, 220, 200);
  ctx.fillStyle = '#e8edff';
  ctx.beginPath();
  ctx.arc(70, 60, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,190,220,0.7)';
  ctx.beginPath();
  ctx.arc(63, 55, 5, 0, Math.PI * 2);
  ctx.arc(78, 66, 4, 0, Math.PI * 2);
  ctx.fill();

  // Lit pools: warm yellow danger light.
  for (const p of level.litPools) {
    const g = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, Math.max(p.rx, p.ry));
    g.addColorStop(0, 'rgba(255,205,90,0.30)');
    g.addColorStop(1, 'rgba(255,205,90,0.02)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,205,90,0.35)';
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Shadow zones: deep blue, clearly edged — safe ground.
  for (const s of level.shadows) {
    ctx.fillStyle = 'rgba(6,10,26,0.62)';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = 'rgba(120,160,255,0.55)';
    ctx.setLineDash([8, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(150,180,255,0.75)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SHADOW · SAFE', s.x + s.w / 2, s.y + 16);
  }

  drawExit(ctx, level, time);
  drawArtifacts(ctx, level, time);

  // Vision cones first (translucent, under the guards themselves).
  for (const guard of state.guards) drawCone(ctx, guard);
  // Cover: crates, display cases, bushes.
  for (const c of level.cover) drawCover(ctx, c);
  // Walls.
  for (const w of level.walls) {
    ctx.fillStyle = WALL_FILL;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = WALL_EDGE;
    ctx.fillRect(w.x, w.y, w.w, 4);
  }
  for (const guard of state.guards) drawGuard(ctx, guard);
  drawPlayer(ctx, state, time);
  const peb = pebblePosition(state.player);
  if (peb) {
    ctx.fillStyle = '#cfd6e4';
    ctx.beginPath();
    ctx.arc(peb.x, peb.y - peb.height, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(207,214,228,0.4)';
    ctx.beginPath();
    ctx.ellipse(peb.x, peb.y, 7, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Detection edge glow: the screen reddens as the meter fills.
  if (state.meter > 55) {
    const a = ((state.meter - 55) / 45) * 0.4;
    const g = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.32, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.72);
    g.addColorStop(0, 'rgba(255,40,40,0)');
    g.addColorStop(1, `rgba(255,40,40,${a.toFixed(2)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

function drawExit(ctx, level, time) {
  const e = level.exit;
  const open = e.open;
  const pulse = 0.55 + 0.35 * Math.sin(time * 3);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = open ? `rgba(60,255,140,${0.25 + pulse * 0.2})` : 'rgba(120,120,120,0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, 30 + (open ? pulse * 6 : 0), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = open ? '#2fbf6f' : '#5a6274';
  ctx.fillRect(-14, -22, 28, 44);
  ctx.strokeStyle = open ? '#7dffb0' : '#8a93a8';
  ctx.lineWidth = 2;
  ctx.strokeRect(-14, -22, 28, 44);
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(0, 22);
  ctx.stroke();
  ctx.fillStyle = 'rgba(8,12,24,0.85)';
  ctx.fillRect(-26, -46, 52, 19);
  ctx.fillStyle = open ? '#a9ffcb' : '#c8cede';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', 0, -32);
  if (!open) {
    ctx.fillStyle = 'rgba(8,12,24,0.85)';
    ctx.fillRect(-26, 28, 52, 17);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('LOCKED', 0, 40);
  }
  ctx.restore();
}

function drawArtifacts(ctx, level, time) {
  for (const a of level.artifacts) {
    if (a.taken) continue;
    const pulse = 0.6 + 0.4 * Math.sin(time * 4 + a.x);
    ctx.save();
    ctx.translate(a.x, a.y);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    g.addColorStop(0, `rgba(255,215,90,${0.5 * pulse})`);
    g.addColorStop(1, 'rgba(255,215,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 13);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawCone(ctx, guard) {
  const half = guard.spec.coneAngle / 2;
  const range = guard.spec.coneRange;
  ctx.save();
  ctx.translate(guard.x, guard.y);
  ctx.rotate(guard.facing);
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, range);
  g.addColorStop(0, 'rgba(255,222,90,0.34)');
  g.addColorStop(1, 'rgba(255,222,90,0.08)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, range, -half, half);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,222,90,0.45)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(-half) * range, Math.sin(-half) * range);
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(half) * range, Math.sin(half) * range);
  ctx.stroke();
  ctx.restore();
}

function drawCover(ctx, c) {
  if (c.kind === 'crate') {
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    ctx.strokeStyle = '#a87a48';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    ctx.beginPath();
    ctx.moveTo(c.x + 2, c.y + 2);
    ctx.lineTo(c.x + c.w - 2, c.y + c.h - 2);
    ctx.moveTo(c.x + c.w - 2, c.y + 2);
    ctx.lineTo(c.x + 2, c.y + c.h - 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  } else if (c.kind === 'case') {
    ctx.fillStyle = '#274b63';
    ctx.fillRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    ctx.fillStyle = 'rgba(160,210,255,0.35)';
    ctx.fillRect(c.x + 6, c.y + 6, c.w - 12, c.h - 12);
    ctx.strokeStyle = '#7fb2d9';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    ctx.lineWidth = 1;
  } else {
    // bush: three overlapping green puffs
    ctx.fillStyle = '#2f6b34';
    for (const [ox, oy, r] of [[0.3, 0.5, 16], [0.6, 0.35, 14], [0.65, 0.65, 15]]) {
      ctx.beginPath();
      ctx.arc(c.x + c.w * ox, c.y + c.h * oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#4c9a52';
    ctx.beginPath();
    ctx.arc(c.x + c.w * 0.45, c.y + c.h * 0.45, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGuard(ctx, guard) {
  ctx.save();
  ctx.translate(guard.x, guard.y);
  // Body: bright red/maroon, always visible against the dark floor.
  ctx.fillStyle = '#d23b2e';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7d1a12';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Facing tick + helmet brim.
  ctx.rotate(guard.facing);
  ctx.fillStyle = '#ffd9d4';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(4, -6);
  ctx.lineTo(4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a3f4a';
  ctx.beginPath();
  ctx.arc(-3, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // State mark: "?" suspicious / investigating, "!" alert, "..." searching.
  let mark = null;
  let color = '#ffd34d';
  if (guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_INVESTIGATE) mark = '?';
  else if (guard.state === GUARD_ALERT) { mark = '!'; color = '#ff4d4d'; }
  else if (guard.state === GUARD_SEARCH) { mark = '...'; color = '#ffd34d'; }
  if (mark) {
    ctx.fillStyle = color;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mark, guard.x, guard.y - 24);
  }
}

function drawPlayer(ctx, state, time) {
  const p = state.player;
  const crouch = p.sneaking ? 0.8 : 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Soft shadow under the thief.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.facing);
  // Cloak: dark hooded figure, lighter rim so it reads on dark floor.
  ctx.fillStyle = '#232a3d';
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-13, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#6b7ba6';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#10141f';
  ctx.beginPath();
  ctx.arc(2, 0, 7 * crouch, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Detection meter arc above the player.
  if (state.meter > 2) {
    const frac = state.meter / 100;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 22, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = frac < 0.5 ? '#ffd34d' : '#ff4d4d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
  }
  if (inShadow(state.level, p.x, p.y)) {
    ctx.fillStyle = 'rgba(150,180,255,0.9)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', p.x, p.y - 30);
  } else if (inLitPool(state.level, p.x, p.y)) {
    ctx.fillStyle = 'rgba(255,205,90,0.95)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXPOSED', p.x, p.y - 30);
  }
}

export function drawHUD(ctx, state) {
  const level = state.level;
  const got = level.artifacts.filter((a) => a.taken).length;
  ctx.fillStyle = 'rgba(8,12,24,0.72)';
  ctx.fillRect(0, 0, WIDTH, 34);
  ctx.fillStyle = '#e8edff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`MOONLIT VAULT — ${state.level.def.name}`, 10, 22);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd75e';
  ctx.fillText(`◆ ${got}/${level.artifacts.length} artifacts`, WIDTH / 2 - 190, 22);
  ctx.fillStyle = '#cfd6e4';
  ctx.fillText(`● pebbles ${state.player.pebbles}`, WIDTH / 2 - 60, 22);
  ctx.fillStyle = '#ff8a80';
  ctx.fillText(`♥`.repeat(Math.max(0, state.lives)) || '—', WIDTH / 2 + 60, 22);
  ctx.fillStyle = '#e8edff';
  ctx.fillText(`score ${state.score}`, WIDTH / 2 + 190, 22);
  ctx.textAlign = 'right';
  ctx.fillText(`⏱ ${Math.max(0, Math.ceil(state.timeLeft))}s`, WIDTH - 10, 22);
  // Detection meter bar, top centre.
  const bw = 220;
  const bx = WIDTH / 2 - bw / 2;
  const by = 40;
  ctx.fillStyle = 'rgba(8,12,24,0.72)';
  ctx.fillRect(bx - 8, by - 4, bw + 16, 18);
  ctx.fillStyle = '#2a3350';
  ctx.fillRect(bx, by, bw, 10);
  ctx.fillStyle = state.meter < 50 ? '#ffd34d' : '#ff4d4d';
  ctx.fillRect(bx, by, bw * (state.meter / 100), 10);
  ctx.fillStyle = '#e8edff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.meter >= 100 ? 'SPOTTED!' : 'DETECTION', WIDTH / 2, by + 24);
  // Locked-exit hint.
  if (!level.exit.open) {
    const left = level.artifacts.filter((a) => !a.taken).length;
    ctx.fillStyle = 'rgba(8,12,24,0.72)';
    ctx.fillRect(WIDTH / 2 - 150, HEIGHT - 30, 300, 22);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`EXIT LOCKED — ${left} artifact${left === 1 ? '' : 's'} left`, WIDTH / 2, HEIGHT - 14);
  }
}

function overlayPanel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(6,9,18,0.66)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 70);
  ctx.fillStyle = '#e8edff';
  ctx.font = '16px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, WIDTH / 2, HEIGHT / 2 - 20 + i * 26));
}

export function drawOverlay(ctx, state) {
  const s = state.screen;
  if (s === 'title') {
    overlayPanel(ctx, 'MOONLIT VAULT', [
      'A thief. A moonlit museum. Three nights, three vaults.',
      '',
      'WASD / arrows — move      SHIFT — sneak (slow, quiet, hard to see)',
      'CLICK — toss a pebble (guards investigate the noise)      SPACE — pick up',
      'Stay out of the yellow cones. Shadows hide you. Lit floor exposes you.',
      'Steal every artifact, then slip out the green EXIT unseen.',
      '',
      'Press ENTER to begin',
    ], '#ffd75e');
  } else if (s === 'clear') {
    overlayPanel(ctx, 'VAULT CLEARED', [
      `${state.level.def.name} — all artifacts stolen, no one saw a thing.`,
      `Level score ${state.levelScore}   ·   Total ${state.score}`,
      '',
      'Press ENTER for the next vault',
    ], '#7dffb0');
  } else if (s === 'win') {
    overlayPanel(ctx, 'THE VAULT IS YOURS', [
      'Every artifact stolen. The moon keeps your secret.',
      `Artifacts ${state.artifactsTaken} × 1000   ·   Time bonus ${state.timeBonus}`,
      state.noAlarm ? 'No-alarm bonus +500' : 'The alarm sounded — no bonus this time',
      `FINAL SCORE ${state.score}`,
      '',
      'Press R to play again',
    ], '#ffd75e');
  } else if (s === 'caught') {
    overlayPanel(ctx, 'SPOTTED!', [
      'A guard caught you in the open.',
      `Lives left: ${state.lives}`,
      '',
      'Press R to try the vault again',
    ], '#ff4d4d');
  } else if (s === 'over') {
    overlayPanel(ctx, 'CAUGHT THREE TIMES', [
      'The museum keeps its treasures tonight.',
      `Final score ${state.score}`,
      '',
      'Press R to start over',
    ], '#ff4d4d');
  }
}
