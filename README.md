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
    InputManager.ts      keyboard -> discrete action queue
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
first-person grid movement, and basic lighting/fog for atmosphere. No
interactables, combat, items, or UI yet — that's Phase 1 onward.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build a production bundle to `dist/`
- `npm run preview` — preview the production build locally
- `npm run typecheck` — run the TypeScript compiler without emitting
