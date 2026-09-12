# The Hollow Crown

A first-person, grid-based dungeon crawler in the tradition of *Legend of
Grimrock*: tile-locked movement, 90-degree turns, no mouse look, and a
first-person view into hand-authored levels.

Built with [Three.js](https://threejs.org/), TypeScript, and
[Vite](https://vitejs.dev/).

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
  main.ts              entry point
  game/
    DungeonMap.ts       ASCII level data + tile queries
    DungeonMesh.ts      builds floor/ceiling/wall geometry for a level
    Player.ts           grid position, facing, and move/turn animation
    InputManager.ts     keyboard/touch -> discrete action queue
    TouchControls.ts    on-screen movement/turn buttons for touch devices
    Game.ts             wires scene, renderer, input, and player together
```

## Design docs

The full design — vision/pillars, setting, party & combat systems, and
the phased build plan — lives in [`docs/`](docs/README.md). Start there
before picking up any new feature work; every phase in
[`docs/08-roadmap-phases.md`](docs/08-roadmap-phases.md) has to end in a
playable build before the next one starts.

## Status

Phase 0 complete (see the roadmap doc above): one small walkable level,
first-person grid movement playable by keyboard or touch, and basic
lighting/fog for atmosphere. No interactables, combat, items, or other
UI yet — that's Phase 1 onward.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build a production bundle to `dist/`
- `npm run preview` — preview the production build locally
- `npm run typecheck` — run the TypeScript compiler without emitting
