# Moonlit Vault — Build Log

Competition: best-stealth-game-20261121-1759 (opened 2026-11-21 17:59 UTC / 2026-11-22 00:59 WIB, closes 12:59 WIB).
Built in-session after opening. Build + verify only — no push, no bundle, no submit.

## Game
Top-down 2D canvas stealth game. A thief steals artifacts from a moonlit museum and reaches the green exit unseen.
- Player: WASD/arrows, Shift sneak (85 vs 175 px/s), click tosses a pebble (3/level, noise radius 3 tiles, guards investigate), Space/touch picks up.
- Detection: meter 0–100, fills only in a guard's cone + line of sight. Base 40/s at point-blank, scaling down with distance; ×1.5 lit pool, ×0.5 sneaking, ×0.3 shadow, ×1.5 running. Drains 25/s while hidden. At 100 the guard chases (190–200 px/s, 5 s max, 3 s lose-sight → search 4 s → patrol). Glimpse (30–70) → suspicious pause + "?".
- Guards: patrol → suspicious → alert/chase → search → patrol, plus investigate (pebble). States shown with "?" / "!" / "...".
- Levels: L1 The Gallery (2 guards, 2 artifacts, 60° cones, 210 range, 55 px/s), L2 Vault Hall (3 guards, 3 artifacts, 70°, 230, 70 px/s), L3 The Vault (4 guards, 3 artifacts, 80°, 250, 85 px/s). Exit locked until all artifacts taken. Score: 1000/artifact + time bonus + 500 no-alarm. 3 lives.
- Sound: WebAudio-synthesised only — guard footsteps scale with distance, player steps, alarm sting, pickup chime, win jingle. No audio files, no network.
- Screenshots staged via ?shot=<name>&seed=1 playing the real rules forward with a Dijkstra autopilot (cone-avoiding paths, flee-to-shadow, timed grabs, exit-wait).

## Files
- main.ts (fresh, Node 22 stdlib, copies game/ + screenshots/ to /output, writes dossier.json via vendor/makefun-game.ts)
- game/index.html + game/src/: config, random, level, guards, player, audio, render, shots, world, main (one job each)
- vendor/makefun-game.ts (kit copy, unchanged), serve.ts (kit layout), LICENSE MIT, README.md (3 live badges + ref atc4awx9), .makefun/owner.json (wallet 8nMG39HRvJLTaK3LwaKAQSUc76GCkTCv73cZZJEpwByz), shots.json
- screenshots/: 1-cover.jpg (64,177 B), 2-sneak.jpg (55,530 B), 3-nearmiss.jpg (60,390 B), 4-win.jpg (56,355 B) — all 1280×960, ≤256 KiB

## Verification (headless Chrome CDP, ~/workspace/makefun-stealth/verify-stealth.mjs)
- ALL CHECKS PASSED (run twice): 4 shots staged as expected; run/sneak/pebble/investigate/detection-fill/drain/alarm/caught/lives/R-restart all pass with real key+mouse events; autopilot wins all 3 levels (score 13,328, 8/8 artifacts, 3 lives, no alarm); zero console errors; zero failed requests.
- main.ts deterministic: two runs byte-identical (diff -r clean; dossier sha256 774febe5e2e16fa9fbd30def2832cc2cfa579624763303c8a581e016edf0aeac).
- Kit check (`makefun check --worktree`): 4 passed, 1 failed, 15 skipped, 5 at-submission. The 1 failure is transcripts_present (expected — bundle is made at submit time). At-submission items (repo public/owner/created-after-open/commit pushed) are pending the browser push.
- Screenshots read visually: cover (title over level, guards+cones+cover+exit), sneak (HIDDEN in shadow, cone sweeping past), nearmiss (meter 82, "?", EXPOSED, red edge glow), win (THE VAULT IS YOURS, 8×1000 + 1361 time + 500 no-alarm = 13,328, green open exit).

## Autopilot bugs found and fixed during the build
1. Exit approach ping-pong: re-pathing the instant a path emptied dragged the player back to the tile centre. Fix: re-path only on the timer/objective change; steer to the goal point when the path is empty.
2. nearestShadowTile iterated pixel rects as tile coords → tile (96,288), findPath null, pilot frozen. Fix: iterate level.def.shadows (tile rects).
3. Flee-to-shadow stalled: "already in shadow → stand still" while watched (shadow slows detection, doesn't block vision). Fix: always move to a safe shadow while seen.
4. Sneaking while chased (85 px/s vs guard 195). Fix: run at full speed when chased or seen.
5. Safe-shadow picks 20 px from a guard. Fix: require ≥150 px from every guard.
6. L2/L3 artifacts sat on patrol lines; L2 guard B's cone swept the exit corridor. Fix: moved L2 guard B patrol west, removed one wall, moved artifacts to cone-free tiles; added artifact-grab timing and exit-wait (approach + corridor watched → wait in shadow).

## Next steps (parent, with user's go-ahead, before 12:59 WIB close)
Push via browser web UI → bundle transcripts → submit with --keypair.
