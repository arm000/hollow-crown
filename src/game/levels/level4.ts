import { DungeonMap } from "../DungeonMap";
import type { EntitySpawn } from "../interactables/types";
import type { MonsterSpawn } from "../monster/bestiary";
import type { LevelDef } from "./LevelDef";

/**
 * The fourth and final level of the opening descent
 * (docs/08-roadmap-phases.md Phase 5, expanded to a full 10×10 in Phase
 * 8 on a player request that "each dungeon level should be 10x10"):
 * Act 1's boss arena. Unlike levels 2/3's one-tile corridors, this is a
 * genuinely open room — deliberate, since the story beat here
 * (docs/02-setting-and-story.md's "no full cutscenes... a boss standing
 * where you expected an empty hall") needs somewhere to actually *see*
 * before the fight starts, not another squeeze-through gate.
 * `LEVEL_4.introMessage` delivers that beat and the mid-dungeon reveal
 * in the same line, per that doc's "environmental storytelling first."
 *
 * The extra floor space the 10×10 resize adds stays part of the same
 * open hall rather than carved into more corridors — a trap right at
 * the threshold (the strongest, and the only one to also inflict Fear,
 * of the whole descent, foreshadowing Marrow's own signature strike),
 * and an Armored Sentinel guarding the strongest defensive item in the
 * game, a Reinforced Kite Shield, in the open far corner — visible and
 * optional the moment the door opens, not gated behind a lock or a
 * puzzle, since a boss arena earns its climax from the fight itself,
 * not one more mechanism to solve first.
 */
export const LEVEL_4_MAP = new DungeonMap([
  "##########",
  "#S.......#",
  "#........#",
  "#........#",
  "#........#",
  "#........#",
  "#........#",
  "##########",
  "##########",
  "##########",
]);

export const LEVEL_4_ENTITIES: EntitySpawn[] = [
  {
    type: "trap",
    x: 2,
    z: 1,
    params: {
      damageType: "physical",
      amount: 7,
      message: "A blade swings down from the rafters, testing whether you're still paying attention this deep in!",
      statusEffect: { type: "fear", turnsRemaining: 2 },
    },
  },

  { type: "exit", x: 7, z: 5 },
  {
    type: "loreItem",
    x: 2,
    z: 4,
    params: {
      text: "Place settings for forty, untouched, the linens gone to dust. At the head of the table, a single chair, empty — Harrow never dined with his own court, even at the end.",
    },
  },
  {
    type: "loreItem",
    x: 6,
    z: 1,
    params: {
      text: "A steward's ledger, the last entry dated to a year no one alive remembers: 'Hold the wards. His Majesty will send word when the guests may finally be seated.'",
    },
  },
  // A tempting reward with a real cost (docs/08-roadmap-phases.md Phase
  // 5's stretch batch: cursed gear) -- won't come off once worn, and
  // nothing here says so ahead of time.
  { type: "equipmentItem", x: 6, z: 4, params: { itemId: "ambition-ring" } },
  // The descent's strongest piece of defensive gear, sitting in plain
  // sight the moment the room opens up -- guarded by a monster, not a
  // lock or a puzzle, a deliberate change of pace from every vault
  // earlier in the descent.
  { type: "equipmentItem", x: 8, z: 6, params: { itemId: "reinforced-kite-shield" } },
];

export const LEVEL_4_MONSTERS: MonsterSpawn[] = [
  {
    type: "stewardMarrow",
    x: 4,
    z: 3,
    patrolPoints: [
      { x: 4, z: 3 },
      { x: 5, z: 3 },
    ],
  },
  {
    type: "armoredSentinel",
    x: 8,
    z: 6,
    patrolPoints: [{ x: 8, z: 6 }],
  },
];

export const LEVEL_4: LevelDef = {
  id: "level-4",
  name: "The Warden's Hall",
  introMessage:
    "The corridor opens onto a hall set for a feast six generations cold — and Steward Marrow has not left their post.",
  dungeon: LEVEL_4_MAP,
  entities: LEVEL_4_ENTITIES,
  monsters: LEVEL_4_MONSTERS,
};
