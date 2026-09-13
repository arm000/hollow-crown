import type { DungeonMap } from "../DungeonMap";
import type { EntitySpawn } from "../interactables/types";
import type { MonsterSpawn } from "../monster/bestiary";

/**
 * Everything `Game.loadLevel` needs to build one level of the descent
 * (docs/08-roadmap-phases.md Phase 4) — plain data, same "level data
 * stays pure, entity construction is layered on top" principle as
 * `EntitySpawn` itself (docs/07-technical-architecture.md#level-data).
 */
export interface LevelDef {
  id: string;
  dungeon: DungeonMap;
  entities: EntitySpawn[];
  monsters: MonsterSpawn[];
}
