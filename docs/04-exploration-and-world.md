# Exploration & World

## Movement

Already implemented as of Phase 0 (`src/game/Player.ts`,
`src/game/InputManager.ts`):

- The party occupies one grid cell and one of four facings (N/E/S/W).
- `W`/`S` step forward/backward, `A`/`D` strafe, `Q`/`E` or `←`/`→` turn
  90°. No mouse look, no free movement — every action is one discrete
  grid step or quarter-turn.
- Each action is animated smoothly (~150ms tween) but the underlying game
  state changes instantly and atomically — there is no "in-between" grid
  state. This matters because it's also how the rest of the world stays
  in sync: see **World Turns** below.
- Movement is blocked by walls (`DungeonMap.isWall`) and, from Phase 1
  on, by other blocking interactables (closed doors, pushed blocks).

## Input & touch controls

The game has to be playable with touch alone, no keyboard (see
[01-vision.md](01-vision.md#platform--scope)). Since the whole action set
is already just six discrete commands (forward, backward, strafe left,
strafe right, turn left, turn right), touch controls are a direct,
1:1 mirror of the keyboard scheme rather than a reinterpretation of it:

- An on-screen movement pad (bottom-left): forward/backward/strafe-left/
  strafe-right as four buttons.
- An on-screen turn pad (bottom-right): turn-left/turn-right as two
  buttons.
- No swipe-to-look or drag gestures — turning is a discrete quarter-turn
  button tap, same semantics as `Q`/`E` on keyboard. This isn't a
  compromise for touch; it's the same "every decision is discrete"
  philosophy from pillar 1 ([01-vision.md](01-vision.md#pillars)) applied
  consistently across input methods.
- Both control schemes feed the same `InputManager` action queue
  (`InputManager.push`) — there's exactly one input pipeline, keyboard
  and touch are just two producers into it. Interact/combat/inventory
  input added in later phases must follow the same pattern: one tappable
  on-screen affordance per keyboard-triggerable action, no feature that
  only has a keyboard path.
- Touch controls are shown based on the device's input capability (coarse
  pointer / no hover), not screen size — a touch laptop and a phone both
  get them, a mouse-driven desktop doesn't clutter its screen with them.

## World turns

Because movement is already discrete, we get a unified "world turn"
model almost for free, and we should use it deliberately rather than
bolt on a separate real-time clock later:

> **One player action (a step, a turn, an interact, or a combat action)
> is one world turn.** Every tickable thing in the world (monster AI,
> traps, timed hazards) advances exactly once per world turn, in a fixed
> order, right after the player's action resolves.

This keeps the whole game deterministic and turn-based end to end —
exploration, monster patrols, and combat all share one clock instead of
combat being a bolted-on separate mode with its own timing rules. See
[07-technical-architecture.md](07-technical-architecture.md) for how this
maps to code (`WorldClock`/tick system).

## Interactables

Introduced in [Phase 1](08-roadmap-phases.md#phase-1--world-interaction--objective).
All interactables live on a grid tile and are triggered by facing them
and pressing an interact key.

| Interactable | Behavior |
| --- | --- |
| **Door** | Blocks movement until opened; may be locked, requiring a matching key item or a Rogue lockpick check |
| **Lever / switch** | Toggles a linked door, bridge, or trap elsewhere in the level; state persists |
| **Pressure plate** | Triggers while a party occupies (or a pushed block occupies) the tile; can gate a door open only while held, or fire once |
| **Pushable block** | Moves one tile in the push direction if that tile is free; used to hold pressure plates or fill pits |
| **Secret wall** | Visually identical to a normal wall; revealed by a "search" interaction when facing it, or automatically at low probability per turn adjacent to it (tuned later) |
| **Pit / hazard tile** | Blocks or damages on entry unless bridged/disarmed |
| **Stairs** | Transitions to another level ([Phase 4](08-roadmap-phases.md#phase-4--multi-level-descent--persistence)) |
| **Lore item / readable** | Non-blocking; interacting shows its text in the HUD, no gameplay effect |

Interactables are the primary puzzle vocabulary — puzzles are built by
combining a small interactable set in a level's geometry (per pillar 4:
dense, not padded).

## Level format

Phase 0 levels are literal ASCII grids (`DungeonMap`, `#`/`.`/`S`). This
is fine for pure geometry but doesn't carry interactable placement,
monster spawns, or metadata. Phase 1 extends the format (see
[07-technical-architecture.md](07-technical-architecture.md#level-data))
to a structured per-level file: a geometry grid plus a list of entities
(interactables, monster spawns, lore items) with grid coordinates and
per-type parameters.

Levels stay **hand-authored**, not generated (per the non-goals in
[01-vision.md](01-vision.md)) — the data format needs to be easy for us
to hand-edit directly, not necessarily backed by a level editor UI.

## Visibility & lighting

- Corridors are lit by the party's own light source (currently a point
  light on the camera, standing in for a torch/lantern) plus sparse fixed
  level lighting (wall sconces, etc.) placed per-level.
- Fog (currently `THREE.FogExp2`) limits draw distance for both
  performance and atmosphere — the player should rarely see more than a
  short corridor's length ahead, reinforcing pillar 1 (every step is a
  small, considered decision).
- No line-of-sight/stealth simulation planned for v1 — monster detection
  (Phase 2+) uses simple radius/facing checks, not a vision-cone system.
