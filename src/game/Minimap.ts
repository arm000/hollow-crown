import type { DungeonMap } from "./DungeonMap";
import type { InteractableManager } from "./interactables/InteractableManager";

/**
 * One minimap cell's state — "unknown" for anything the party hasn't
 * revealed yet (docs/08-roadmap-phases.md Phase 5's minimap, sourced
 * from the same `DungeonMap` the 3D geometry reads, not a separately
 * authored asset). "door" is its own cell distinct from "floor" so a
 * door's location, once seen, stays legible on the map — open or
 * closed, unlike a lever/lore item/key, which don't get a minimap
 * symbol of their own yet (small scope, per the roadmap doc's framing).
 *
 * "obstacle" is the same idea applied to anything else that currently
 * blocks movement while sitting on an ordinary floor tile — a pushable
 * block, or an unopened class-gated passage — rather than a wall or a
 * door. Bug report: a player walking a corridor toward an unpushed
 * block saw it rendered as plain "floor" (the raw grid tile under it
 * really is floor), so the map showed an open hallway right up to a
 * dead end the map itself gave no hint of. Once the obstacle is gone
 * (block pushed elsewhere, gate opened), that tile's `blocksMovement()`
 * goes false and it reverts to "floor" on the very next render, same as
 * an opened door already did.
 */
export type MinimapCell = "unknown" | "wall" | "floor" | "door" | "obstacle";

const NEIGHBOR_STEPS: Array<[number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Mirrors `GameLogic.ts`'s `isBlocked` exactly (an interactable's own `blocksMovement()` wins, falling back to the raw grid) — kept as its own small copy here rather than imported, so this module only depends on `DungeonMap`/`InteractableManager`, not the whole `WorldState`. Line of sight is blocked by exactly the same things movement is: a closed door, an unrevealed secret wall, an unopened class gate, a pushable block, or a plain wall. */
function isBlocking(dungeon: DungeonMap, interactables: InteractableManager, x: number, z: number): boolean {
  const entity = interactables.at(x, z);
  if (entity) return entity.blocksMovement();
  return dungeon.isWall(x, z);
}

function cellType(dungeon: DungeonMap, interactables: InteractableManager, x: number, z: number): MinimapCell {
  const entity = interactables.at(x, z);
  if (entity?.kind === "door") return "door";
  if (dungeon.isWall(x, z)) {
    // A revealed secret wall is passable despite its raw grid tile
    // staying `#` forever (see `SecretWall.ts`) -- show the opened gap,
    // not a solid block where the party can actually walk.
    if (entity && !entity.blocksMovement()) return "floor";
    return "wall";
  }
  // A pushable block or an unopened class gate sits on an otherwise
  // plain floor tile but still blocks movement -- see this type's doc
  // comment for the bug this fixes. A door already gets its own case
  // above; this is everything else that can block a floor tile.
  if (entity?.blocksMovement()) return "obstacle";
  return "floor";
}

/**
 * Casts a straight sightline from `(startX, startZ)` in direction
 * `(dx, dz)`, adding every tile up to and including whatever finally
 * blocks it (a wall, a closed door, ...) to `revealed` — the blocker
 * itself is seen (you can see the door you can't see past), nothing
 * beyond it is. At every step, also reveals the two tiles flanking that
 * point of the corridor (perpendicular to travel) — the side walls
 * you'd actually see on screen looking down a hallway, not just its
 * far end. Those flanking tiles don't extend the ray themselves; a
 * floor tile revealed this way (a side passage's entrance) only gets
 * looked further into once it's an actual sightline of its own (i.e.
 * the party has stood there, or another ray reaches it).
 */
function castSight(
  dungeon: DungeonMap,
  interactables: InteractableManager,
  startX: number,
  startZ: number,
  [dx, dz]: [number, number],
  revealed: Set<string>,
): void {
  const [pdx, pdz] = [-dz, dx]; // perpendicular to (dx, dz), rotated 90°
  let x = startX;
  let z = startZ;
  for (;;) {
    x += dx;
    z += dz;
    revealed.add(`${x},${z}`);
    revealed.add(`${x + pdx},${z + pdz}`);
    revealed.add(`${x - pdx},${z - pdz}`);
    if (isBlocking(dungeon, interactables, x, z)) return;
  }
}

/**
 * Every tile revealed so far: each visited floor tile itself, plus
 * whatever's visible in a straight line from it in all four cardinal
 * directions — including the corridor walls flanking that line, not
 * just the tiles directly along it — stopping at the same things that
 * block movement (walls, closed doors, unrevealed secrets, unopened
 * class gates, pushable blocks). "Any wall you've actually seen on
 * screen, not just ones dead ahead," per user feedback on the first
 * pass at this (docs/08-roadmap-phases.md Phase 5's minimap).
 */
function computeRevealed(
  dungeon: DungeonMap,
  interactables: InteractableManager,
  visitedFloors: ReadonlySet<string>,
): Set<string> {
  const revealed = new Set<string>();
  for (const key of visitedFloors) {
    revealed.add(key);
    const [x, z] = key.split(",").map(Number);
    for (const step of NEIGHBOR_STEPS) castSight(dungeon, interactables, x, z, step, revealed);
  }
  return revealed;
}

/**
 * Builds the full grid of minimap cell states for one level. `Game`
 * calls this after every move/turn/level-load with whatever tiles the
 * party has visited so far; `visitedFloors` is level-scoped and reset
 * on every transition (docs/08-roadmap-phases.md Phase 5) — not
 * persisted across save/load, the same simplification `SaveGame.ts`
 * already makes for per-level interactable/monster state.
 */
export function buildMinimapGrid(
  dungeon: DungeonMap,
  interactables: InteractableManager,
  visitedFloors: ReadonlySet<string>,
): MinimapCell[][] {
  const revealed = computeRevealed(dungeon, interactables, visitedFloors);
  const grid: MinimapCell[][] = [];
  for (let z = 0; z < dungeon.height; z++) {
    const row: MinimapCell[] = [];
    for (let x = 0; x < dungeon.width; x++) {
      row.push(revealed.has(`${x},${z}`) ? cellType(dungeon, interactables, x, z) : "unknown");
    }
    grid.push(row);
  }
  return grid;
}
