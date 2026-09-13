import { DungeonMap } from "../DungeonMap";
import type { EntitySpawn } from "../interactables/types";
import type { MonsterSpawn } from "../monster/bestiary";
import type { LevelDef } from "./LevelDef";

/**
 * The third level of the descent: a single one-tile-wide corridor with
 * no branch to duck down and no way around either monster patrolling
 * it — unlike level 1's Cinder Wretch, which sat in a room the party
 * could choose to avoid entirely. Both fights are mandatory, back to
 * back: the Court Alchemist first, whose telegraphed heal-turn punishes
 * a party that hasn't learned to focus fire by now, then the Cinder
 * Wretch again (still a fair, earned finale fight for whatever counter
 * the party found on the way down). A third alcove between the two
 * fights (added for docs/08-roadmap-phases.md Phase 4's "difficulty
 * curve, tuned by hand") holds `hardened-leather` — existing since
 * Phase 3 but, like `old-buckler`, never actually placed until now — a
 * breather resource positioned exactly where the run needs it most: a
 * defensive boost heading into this level's second mandatory fight,
 * already bruised from the first. A stairway down to level 4 (Phase 5's
 * boss arena) replaces what used to be this level's run-ending exit.
 *
 * Also carries a Holy Water pickup, right in the main corridor between
 * the two fights (found via Phase 6's automated full-campaign
 * playthrough: `CONSUMABLE_ITEMS`/Steward Marrow's whole design says
 * "weak to Holy, Holy Water is the answer," but nothing in any level
 * ever actually handed the player one — the intended counter to the
 * boss's weakness was unreachable in real play).
 */
export const LEVEL_3_MAP = new DungeonMap(["###########", "#S........#", "##.##.##.##", "###########"]);

export const LEVEL_3_ENTITIES: EntitySpawn[] = [
  { type: "stairsDown", x: 9, z: 1, params: { targetLevelId: "level-4" } },
  {
    type: "npc",
    x: 2,
    z: 1,
    params: {
      name: "An Old Sentry",
      line: "Marrow still walks the far hall. Tell them supper's ready, if you get the chance. Tell them it's been ready a long while.",
    },
  },
  {
    type: "loreItem",
    x: 2,
    z: 2,
    params: {
      text: "Claw marks score the stone at exactly shoulder height. Whatever made them was patient — this alcove wasn't a hiding spot, it was a blind.",
    },
  },
  { type: "equipmentItem", x: 5, z: 2, params: { itemId: "hardened-leather" } },
  { type: "keyItem", x: 5, z: 1, params: { itemId: "holy-water", name: "Holy Water" } },
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
  name: "The Sunken Wards — Old Foundations",
  introMessage: "The foundations groan under six generations of sinking stone. Something down here has been guarding it a long time.",
  dungeon: LEVEL_3_MAP,
  entities: LEVEL_3_ENTITIES,
  monsters: LEVEL_3_MONSTERS,
};
