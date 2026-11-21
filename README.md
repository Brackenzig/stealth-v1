# Moonlit Vault

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Brackenzig/stealth-v1/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Brackenzig/stealth-v1/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Moonlit Vault — a top-down stealth game.** A thief slips into a moonlit museum at night to steal the artifacts and reach the green exit unseen. Guards patrol fixed routes with yellow vision cones; walls, crates, display cases and bushes block their sight. Lit floor exposes you (detection ×1.5), shadow hides you (×0.3), sneaking slows you but halves detection. Get spotted and the meter fills — at 100 the guard chases; break line of sight and the meter drains, so a near miss is recoverable. A tossed pebble draws guards away to investigate the noise.

## How it plays

- **WASD / arrows** — move. **SHIFT** — sneak (slower, quieter, harder to see).
- **CLICK** — toss a pebble toward the cursor; guards inside 3 tiles walk over to investigate. 3 pebbles per level.
- **SPACE** — pick up (or just walk over an artifact to take it).
- **ENTER** — start / next vault. **R** — retry after being caught.
- 3 levels: The Gallery (2 guards), Vault Hall (3 guards), The Vault (4 guards) — wider cones, faster patrols, tighter timing.
- Score: 1000 per artifact + time bonus + 500 no-alarm bonus per level. 3 lives; caught three times and the museum keeps its treasures.
- Sound is WebAudio-synthesised: guard footsteps get louder as a guard nears, plus an alarm sting, pickup chime and win jingle. No audio files, no network requests.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` (an `index.html` and ES modules, no library). `main.ts` hands it in: it copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library.

---

<sub>Entered on [make.fun](https://make.fun/?ref=atc4awx9&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
