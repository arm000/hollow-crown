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
 * Everything else is optional, bypassable content reachable without the
 * key:
 * - A lever, and separately a pushable-block-and-plate puzzle, both
 *   unlock the *same* bonus door (a deliberate simplification for this
 *   placeholder level — either mechanism alone is enough; using both
 *   can leave them fighting over one door's lock state, which is a
 *   known, accepted wrinkle here, not a bug to chase down).
 * - Beyond that bonus alcove's lore item, a secret wall hides one more
 *   hidden pocket with a second lore item.
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

  { type: "pushableBlock", x: 2, z: 4 },
  { type: "pressurePlate", x: 2, z: 5, params: { doorX: 6, doorZ: 5 } },

  { type: "secretWall", x: 6, z: 7 },
  {
    type: "loreItem",
    x: 6,
    z: 8,
    params: {
      text: "Scratched into the stone, barely legible: 'if you have found this, you were never meant to stop looking.'",
    },
  },
];
