import { STARTING_LEVEL } from "../DungeonMap";
import { STARTING_LEVEL_ENTITIES, STARTING_LEVEL_MONSTERS } from "../Level";
import { LEVEL_2 } from "./level2";
import { LEVEL_3 } from "./level3";
import { LEVEL_4 } from "./level4";
import type { LevelDef } from "./LevelDef";

/** Level 1 wrapped as a `LevelDef` — its map/entities/monsters stay exactly where they've always lived (`DungeonMap.ts`/`Level.ts`), so this is purely an assembly step, not a move. */
const LEVEL_1: LevelDef = {
  id: "level-1",
  name: "The Sunken Wards",
  introMessage:
    "Cellar damp and old rope — the wards where Ashveil kept its stores, and, if the stories are true, whatever it stopped needing.",
  dungeon: STARTING_LEVEL,
  entities: STARTING_LEVEL_ENTITIES,
  monsters: STARTING_LEVEL_MONSTERS,
};

/**
 * The full opening descent, in order — `Game` starts at `LEVELS[0]` and
 * follows each level's `StairsDown` onward, per
 * docs/08-roadmap-phases.md Phase 4. All four levels are Act 1, "The
 * Sunken Wards," per docs/02-setting-and-story.md#structure — the
 * upper, "most normal" reaches of the ruin; Acts 2-4 (deeper, stranger,
 * and eventually Harrow III himself) are future-phase content, not a
 * gap in this one.
 */
export const LEVELS: LevelDef[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4];

export function getLevel(id: string): LevelDef {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level id: "${id}"`);
  return level;
}
