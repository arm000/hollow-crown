import type { EntitySpawn } from "./interactables/types";

/**
 * Entity placements for `STARTING_LEVEL` (see `DungeonMap.ts`), kept
 * separate from the dungeon grid itself — geometry stays pure tile data,
 * entity spawns are layered on top per docs/07-technical-architecture.md
 * "Level data".
 *
 * The puzzle: a key sits in a one-tile side room off the main corridor;
 * a locked door further along the corridor won't open without it. There
 * is exactly one way through, so simply reaching the exit tile is proof
 * the puzzle was solved (see `ExitTile`).
 */
export const STARTING_LEVEL_ENTITIES: EntitySpawn[] = [
  { type: "keyItem", x: 3, z: 2, params: { itemId: "rusted-key", name: "a Rusted Key" } },
  { type: "door", x: 5, z: 1, params: { keyId: "rusted-key", locked: true } },
  { type: "exit", x: 7, z: 1 },
];
