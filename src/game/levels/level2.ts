import { DungeonMap } from "../DungeonMap";
import type { EntitySpawn } from "../interactables/types";
import type { MonsterSpawn } from "../monster/bestiary";
import type { LevelDef } from "./LevelDef";

/**
 * The second level of the descent (docs/08-roadmap-phases.md Phase 4):
 * deliberately smaller and more linear than level 1 — that level was
 * where the puzzle *variety* (lever, plate, secret wall, class gate)
 * got its showcase; this one and level 3 are where the multi-level
 * descent mechanic itself, and the difficulty curve across levels, are
 * what's actually being tested. Same core shape as level 1's mandatory
 * path, though: a key in a small side room gates a locked door, with a
 * Rot-thing patrolling the one corridor between them so reaching the
 * stairs down means dealing with it, not routing around it.
 */
export const LEVEL_2_MAP = new DungeonMap(["#########", "#S......#", "##..#.###", "#########"]);

export const LEVEL_2_ENTITIES: EntitySpawn[] = [
  { type: "keyItem", x: 3, z: 2, params: { itemId: "iron-key", name: "an Iron Key" } },
  { type: "door", x: 6, z: 1, params: { keyId: "iron-key", locked: true } },
  { type: "stairsDown", x: 7, z: 1, params: { targetLevelId: "level-3" } },
  {
    type: "loreItem",
    x: 5,
    z: 2,
    params: {
      text: "A guttered torch bracket, cold for years. Something about this level feels less lived-in than the last — less a home, more a holding cell.",
    },
  },
];

export const LEVEL_2_MONSTERS: MonsterSpawn[] = [
  {
    type: "rotThing",
    x: 4,
    z: 1,
    patrolPoints: [
      { x: 2, z: 1 },
      { x: 4, z: 1 },
    ],
  },
];

export const LEVEL_2: LevelDef = {
  id: "level-2",
  dungeon: LEVEL_2_MAP,
  entities: LEVEL_2_ENTITIES,
  monsters: LEVEL_2_MONSTERS,
};
