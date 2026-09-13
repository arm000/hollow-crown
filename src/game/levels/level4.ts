import { DungeonMap } from "../DungeonMap";
import type { EntitySpawn } from "../interactables/types";
import type { MonsterSpawn } from "../monster/bestiary";
import type { LevelDef } from "./LevelDef";

/**
 * The fourth and final level of the opening descent
 * (docs/08-roadmap-phases.md Phase 5): Act 1's boss arena. Unlike
 * levels 2/3's one-tile corridors, this is a genuinely open room —
 * deliberate, since the story beat here (docs/02-setting-and-story.md's
 * "no full cutscenes... a boss standing where you expected an empty
 * hall") needs somewhere to actually *see* before the fight starts, not
 * another squeeze-through gate. `LEVEL_4.introMessage` delivers that
 * beat and the mid-dungeon reveal in the same line, per that doc's
 * "environmental storytelling first."
 */
export const LEVEL_4_MAP = new DungeonMap([
  "#########",
  "#S......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#########",
]);

export const LEVEL_4_ENTITIES: EntitySpawn[] = [
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
