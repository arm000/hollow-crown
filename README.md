# The Hollow Crown

A first-person, grid-based dungeon crawler in the tradition of *Legend of
Grimrock*: tile-locked movement, 90-degree turns, no mouse look, and a
first-person view into hand-authored levels.

Built with [Three.js](https://threejs.org/), TypeScript, and
[Vite](https://vitejs.dev/).

**Play the current build:** https://arm000.github.io/hollow-crown/
(auto-deployed from `main` on every push — see
[docs/09-deployment.md](docs/09-deployment.md))

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL in a browser.

## Controls

| Key            | Action        |
| -------------- | ------------- |
| `W` / `S`      | Walk forward / backward |
| `A` / `D`      | Strafe left / right |
| `Q` / `E`      | Turn left / right |
| `←` / `→`      | Turn left / right |
| `Space`        | Interact (doors, levers, items, ...) |

On a touchscreen device, on-screen pads (move, bottom-left; turn,
bottom-right) replace the keyboard automatically — no setup needed, and
no keyboard/mouse required to play. The game targets touch and desktop
as equally first-class from the start; see
[docs/01-vision.md](docs/01-vision.md#platform--scope).

Movement and turning are locked to the dungeon grid, animated smoothly
between tiles.

## Project layout

```
src/
  main.ts               entry point
  game/
    DungeonMap.ts        ASCII level data + tile queries
    DungeonMesh.ts       builds floor/ceiling/wall geometry for a level
    Level.ts             entity spawns (key, door, exit, ...) for the level
    Player.ts            grid position, facing, and move/turn animation
    InputManager.ts      keyboard/touch -> discrete action queue
    TouchControls.ts     on-screen movement/turn/interact buttons
    Inventory.ts         shared party inventory (placeholder: id -> name)
    Hud.ts               DOM message line, inventory list, win screen
    GameLogic.ts         pure move/interact resolution (no rendering) — headlessly testable
    interactables/       Door, KeyItem, ExitTile, InteractableManager, ...
    Game.ts              wires scene, renderer, input, and world state together
```

## Design docs

The full design — vision/pillars, setting, party & combat systems, and
the phased build plan — lives in [`docs/`](docs/README.md). Start there
before picking up any new feature work; every phase in
[`docs/08-roadmap-phases.md`](docs/08-roadmap-phases.md) has to end in a
playable build before the next one starts.

## Status

Phase 0 complete, Phase 1 in progress (see the roadmap doc above).
Playable now: grid movement (keyboard or touch), and a small
hand-authored level with a key-and-locked-door puzzle leading to an exit
— find the key, unlock the door, reach the exit to win. Still to come in
Phase 1: a lever, a pressure plate + pushable block, and a secret wall.
No combat, character stats, or equipment yet — that's Phase 2 onward.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build a production bundle to `dist/`
- `npm run preview` — preview the production build locally
- `npm run typecheck` — run the TypeScript compiler without emitting
