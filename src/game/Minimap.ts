import type { DungeonMap } from "./DungeonMap";

/**
 * One minimap cell's state — "unknown" for anything the party hasn't
 * revealed yet (docs/08-roadmap-phases.md Phase 5's minimap, sourced
 * from the same `DungeonMap` the 3D geometry reads, not a separately
 * authored asset). Kept deliberately smaller than the full tile
 * vocabulary (doors, levers, etc. don't get their own minimap symbol
 * yet) — small scope, per the roadmap doc's own framing.
 */
export type MinimapCell = "unknown" | "wall" | "floor";

const NEIGHBOR_STEPS: Array<[number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * A tile is revealed once the party has actually stood on it, or once
 * an adjacent floor tile has been visited (so corridor walls show up
 * around a path you've walked without exposing whatever's on the far
 * side of them) — classic dungeon-crawler fog of war, and a deliberate
 * fit for pillar 3's "the dungeon is the character": the map earns
 * itself, it isn't handed over on arrival.
 */
function isRevealed(dungeon: DungeonMap, visitedFloors: ReadonlySet<string>, x: number, z: number): boolean {
  if (visitedFloors.has(`${x},${z}`)) return true;
  if (!dungeon.isWall(x, z)) return false; // an unvisited floor tile is never revealed just by proximity
  return NEIGHBOR_STEPS.some(([dx, dz]) => visitedFloors.has(`${x + dx},${z + dz}`));
}

/**
 * Builds the full grid of minimap cell states for one level. `Game`
 * calls this after every move/turn/level-load with whatever tiles the
 * party has visited so far; `visitedFloors` is level-scoped and reset
 * on every transition (docs/08-roadmap-phases.md Phase 5) — not
 * persisted across save/load, the same simplification `SaveGame.ts`
 * already makes for per-level interactable/monster state.
 */
export function buildMinimapGrid(dungeon: DungeonMap, visitedFloors: ReadonlySet<string>): MinimapCell[][] {
  const grid: MinimapCell[][] = [];
  for (let z = 0; z < dungeon.height; z++) {
    const row: MinimapCell[] = [];
    for (let x = 0; x < dungeon.width; x++) {
      if (!isRevealed(dungeon, visitedFloors, x, z)) {
        row.push("unknown");
      } else {
        row.push(dungeon.isWall(x, z) ? "wall" : "floor");
      }
    }
    grid.push(row);
  }
  return grid;
}
