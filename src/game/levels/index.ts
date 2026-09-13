import { STARTING_LEVEL } from "../DungeonMap";
import { STARTING_LEVEL_ENTITIES, STARTING_LEVEL_MONSTERS } from "../Level";
import { LEVEL_2 } from "./level2";
import { LEVEL_3 } from "./level3";
import type { LevelDef } from "./LevelDef";

/** Level 1 wrapped as a `LevelDef` — its map/entities/monsters stay exactly where they've always lived (`DungeonMap.ts`/`Level.ts`), so this is purely an assembly step, not a move. */
const LEVEL_1: LevelDef = {
  id: "level-1",
  dungeon: STARTING_LEVEL,
  entities: STARTING_LEVEL_ENTITIES,
  monsters: STARTING_LEVEL_MONSTERS,
};

/** The full opening descent, in order — `Game` starts at `LEVELS[0]` and follows each level's `StairsDown` onward, per docs/08-roadmap-phases.md Phase 4. */
export const LEVELS: LevelDef[] = [LEVEL_1, LEVEL_2, LEVEL_3];

export function getLevel(id: string): LevelDef {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level id: "${id}"`);
  return level;
}
