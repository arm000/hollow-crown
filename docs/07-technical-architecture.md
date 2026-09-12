# Technical Architecture

## Stack

- **Three.js** for rendering, **TypeScript** for everything else,
  **Vite** for dev server/build. Browser target, no backend — state lives
  client-side (`localStorage` for saves, see below).
- No physics engine — collision is grid-based (`DungeonMap.isWall`), not
  simulated.
- No mouse-look/pointer-lock: input is discrete keydown/pointer events
  mapped to grid actions (`InputManager`), fed by both keyboard and
  on-screen touch controls (`TouchControls`) — see
  [Input & responsive UI](#input--responsive-ui).

## Current structure (Phase 0)

```
src/
  main.ts              entry point
  game/
    DungeonMap.ts       ASCII level data + tile queries
    DungeonMesh.ts      builds floor/ceiling/wall geometry for a level
    Player.ts           grid position, facing, and move/turn animation
    InputManager.ts     keyboard/touch -> discrete action queue
    TouchControls.ts    on-screen buttons for touch devices
    Game.ts             wires scene, renderer, input, and player together
```

`Game.tick()` is the heart of the loop today: if the player isn't mid-
animation, pop one queued input action, apply it, then let `Player`
advance its animation tween. This structure is deliberately extended
rather than replaced as phases add systems — see below.

## The world-turn model

As described in
[04-exploration-and-world.md](04-exploration-and-world.md#world-turns),
one resolved player action = one world turn. Concretely, this becomes a
`WorldClock` (or equivalent) introduced in Phase 2 that `Game.tick()`
calls into right after a player action resolves:

```
player action resolves (move / turn / interact / combat action)
  -> WorldClock.advance()
       -> tick every registered entity (monsters, timed hazards) once
       -> resolve any resulting triggers (monster spots party -> combat start)
```

Everything downstream of Phase 1 (monsters, traps, combat) should plug
into this tick rather than acquiring its own `requestAnimationFrame`-based
timer. The render loop keeps running every frame for animation
smoothness (tweening a move/turn, idle monster animation, etc.) — only
*game-state* changes are turn-gated.

## Entities

Phase 0 has no entity system — the dungeon is just static geometry.
Phase 1+ introduces a small entity model:

- `Interactable` — base type for doors, levers, pressure plates,
  pushable blocks, lore items, stairs. Holds a grid position, a
  currently-blocking flag, and an `interact()` handler.
- `Monster` (Phase 2) — grid position, facing, an AI behavior tag
  (per [05-combat.md](05-combat.md#monster-ai-v1-scope)), and combat
  stats.
- `Item` instances (Phase 3) are data (see below), not scene entities,
  except when represented as a pickup on the floor.

These are plain TypeScript classes registered with the level/`WorldClock`
— not a full ECS. Revisit that decision only if entity count/behavior
complexity actually demands it; premature ECS adoption would slow down
every phase between here and there for no proven benefit.

## Level data

Phase 0's `DungeonMap` reads a flat `string[]` (`#`/`.`/`S`). Phase 1
extends this to a structured per-level format so geometry and entity
placement can be authored together, e.g.:

```ts
interface LevelData {
  id: string;
  grid: string[];            // geometry, same alphabet as today
  entities: EntitySpawn[];   // interactables, monsters, lore items
}

interface EntitySpawn {
  type: string;      // "door" | "lever" | "monster:rot-thing" | ...
  x: number;
  z: number;
  params?: Record<string, unknown>; // e.g. { locked: true, keyId: "rusted-key" }
}
```

Levels remain hand-authored TypeScript/JSON data files, not the output of
a level-editor tool or a procedural generator (see
[01-vision.md](01-vision.md#explicit-non-goals-for-now)).

## Character & item data

Class tables, monster stat blocks, and item definitions live as plain
data (TS objects or JSON) rather than being hardcoded into logic classes
— e.g. a `CLASSES: Record<ClassId, ClassDef>` table and an
`ITEMS: Record<ItemId, ItemDef>` table. This is what lets content
(Phase 3 classes, Phase 4 monster roster, Phase 5 items/lore) grow
without touching the systems that consume that data.

## Input & responsive UI

Mobile is first-class from Phase 0 (see
[01-vision.md](01-vision.md#platform--scope)), which drives a few
concrete implementation choices:

- **One input pipeline, two producers.** `InputManager` owns a single
  action queue and exposes `push(action)`; keyboard events and
  `TouchControls`'s on-screen buttons both just call it. No system
  downstream of `InputManager` needs to know or care which one produced
  an action — this is what keeps every future action (interact, combat
  menu choices) automatically touch-compatible as long as it's added to
  this queue instead of a keyboard-only path.
- **Touch controls are shown by input capability, not screen size** —
  `@media (hover: none) and (pointer: coarse)` in `index.html`, not a
  width breakpoint. A touchscreen laptop and a phone both qualify; a
  mouse-driven desktop doesn't render buttons it doesn't need.
- **Viewport handling**: `viewport-fit=cover` and
  `user-scalable=no` in the meta viewport tag, `touch-action: none` on
  the document to kill pinch-zoom/pull-to-refresh/scroll gestures that
  would otherwise fight the game for touch input, and a `resize` +
  `orientationchange` listener pair on the renderer (mobile browsers can
  be slow to fire plain `resize` on rotation).
- **Tap targets**: any future touch-facing UI (combat action buttons,
  inventory slots, minimap toggle) needs ≥44px touch targets and no
  hover-only affordance (no tooltips-on-hover as the only way to see
  something, no drag-to-reorder without a tap-based fallback). Call this
  out explicitly in each phase's design as it's built, don't leave it as
  an afterthought pass.

## UI layer

No UI exists yet beyond the static HUD text and touch control buttons in
`index.html`/`TouchControls.ts`. Planned approach: plain DOM overlays
(HTML/CSS positioned over the WebGL canvas), not an in-3D/WebGL UI —
matches the existing HUD pattern, is far faster to iterate on, and CSS
handles text/layout (and touch hit-targets) better than any WebGL text
solution would for this project's needs. This covers HUD messages
(Phase 1), the combat turn-order/action menu (Phase 2), inventory and
character sheets (Phase 3), and the minimap (Phase 5) — all subject to
the touch-target rule above.

## Save system

`localStorage`-backed JSON serialization, introduced in
[Phase 4](08-roadmap-phases.md#phase-4--multi-level-descent--persistence):
party state (stats, inventory, equipment), current level id, and party
grid position/facing. Single save slot for v1. No cloud sync, no
autosave-scumming prevention — out of scope until there's a reason to
care.

## Testing

Vitest (pairs naturally with Vite, no extra tooling to introduce) should
be added when combat math shows up in
[Phase 2](08-roadmap-phases.md#phase-2--party--turn-based-combat) —
damage formulas, initiative ordering, and turn resolution are exactly the
kind of logic that's cheap to unit test and easy to silently break
later. Not needed before then; Phase 0/1 logic is simple enough that
manual playtesting per the roadmap's playability gates is sufficient.

## Performance

Because mobile is first-class from Phase 0, the render budget has to
target mid-range phone GPUs, not just a development desktop — this is
earlier than it would matter for a desktop-only game. Current
mitigations already in place: pixel ratio capped at 2
(`Math.min(window.devicePixelRatio, 2)` — uncapped device pixel ratio on
a high-density phone screen is a common and easy-to-miss mobile
performance trap), `FogExp2` limiting effective draw distance, and
`InstancedMesh` for wall geometry. Watch for it getting harder starting
Phase 4 (multiple levels, more monsters): the existing instancing
pattern for walls should extend to repeated props/monster geometry
rather than one draw call per object. Any phase that adds meaningfully
more geometry or shader cost should get a quick pass on a real
mid-range phone, not just judged by desktop framerate.
