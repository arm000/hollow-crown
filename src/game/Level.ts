import type { EntitySpawn } from "./interactables/types";

/**
 * Entity placements for `STARTING_LEVEL` (see `DungeonMap.ts`), kept
 * separate from the dungeon grid itself — geometry stays pure tile data,
 * entity spawns are layered on top per docs/07-technical-architecture.md
 * "Level data".
 *
 * The main puzzle: a key sits in a one-tile side room off the main
 * corridor; a locked door further along won't open without it. That's
 * the only mandatory path, so simply reaching the exit tile is proof
 * the puzzle was solved (see `ExitTile`).
 *
 * A second, optional branch holds a lever that unlocks a small bonus
 * alcove with a lore item — entirely bypassable, reachable without the
 * key, and not required to win.
 */
export const STARTING_LEVEL_ENTITIES: EntitySpawn[] = [
  { type: "keyItem", x: 3, z: 2, params: { itemId: "rusted-key", name: "a Rusted Key" } },
  { type: "door", x: 6, z: 1, params: { keyId: "rusted-key", locked: true } },
  { type: "exit", x: 7, z: 1 },

  { type: "lever", x: 5, z: 4, params: { doorX: 6, doorZ: 5 } },
  { type: "door", x: 6, z: 5, params: { locked: true } },
  {
    type: "loreItem",
    x: 6,
    z: 6,
    params: {
      text: "A page, half-rotted: '...the wards held until the third winter, when even the walls forgot which king they served.'",
    },
  },
];
