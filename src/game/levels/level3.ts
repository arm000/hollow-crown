import { DungeonMap } from "../DungeonMap";
import type { EntitySpawn } from "../interactables/types";
import type { MonsterSpawn } from "../monster/bestiary";
import type { LevelDef } from "./LevelDef";

/**
 * The third and final level of the opening descent
 * (docs/08-roadmap-phases.md Phase 4): a single one-tile-wide corridor
 * with no branch to duck down and no way around either monster
 * patrolling it — unlike level 1's Cinder Wretch, which sat in a room
 * the party could choose to avoid entirely. Both fights are mandatory,
 * back to back: the Court Alchemist first, whose telegraphed heal-turn
 * punishes a party that hasn't learned to focus fire by now, then the
 * Cinder Wretch again (still a fair, earned finale fight for whatever
 * counter the party found on the way down). A third alcove between the
 * two fights (added for docs/08-roadmap-phases.md Phase 4's "difficulty
 * curve, tuned by hand") holds `hardened-leather` — existing since
 * Phase 3 but, like `old-buckler`, never actually placed until now — a
 * breather resource positioned exactly where the run needs it most: a
 * defensive boost heading into the finale's second mandatory fight,
 * already bruised from the first. The real, run-ending `ExitTile`
 * finally shows up here.
 */
export const LEVEL_3_MAP = new DungeonMap(["###########", "#S........#", "##.##.##.##", "###########"]);

export const LEVEL_3_ENTITIES: EntitySpawn[] = [
  { type: "exit", x: 9, z: 1 },
  {
    type: "loreItem",
    x: 2,
    z: 2,
    params: {
      text: "Claw marks score the stone at exactly shoulder height. Whatever made them was patient — this alcove wasn't a hiding spot, it was a blind.",
    },
  },
  { type: "equipmentItem", x: 5, z: 2, params: { itemId: "hardened-leather" } },
  {
    type: "loreItem",
    x: 8,
    z: 2,
    params: {
      text: "A shard of the crown itself, or a forgery convincing enough to leave a Wretch guarding it. Either way, someone wanted this corridor remembered.",
    },
  },
];

export const LEVEL_3_MONSTERS: MonsterSpawn[] = [
  {
    type: "courtAlchemist",
    x: 3,
    z: 1,
    patrolPoints: [
      { x: 3, z: 1 },
      { x: 4, z: 1 },
    ],
  },
  {
    type: "cinderWretch",
    x: 7,
    z: 1,
    patrolPoints: [
      { x: 6, z: 1 },
      { x: 7, z: 1 },
    ],
  },
];

export const LEVEL_3: LevelDef = {
  id: "level-3",
  dungeon: LEVEL_3_MAP,
  entities: LEVEL_3_ENTITIES,
  monsters: LEVEL_3_MONSTERS,
};
