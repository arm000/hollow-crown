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
  /** Shown in the HUD party line while on this level (docs/08-roadmap-phases.md Phase 5's narrative pass) — environmental/atmospheric, per docs/02-setting-and-story.md#how-story-is-delivered, not required reading. */
  name: string;
  /** Shown once, the moment the party arrives (initial load or via `StairsDown`) — the "no full cutscenes, big beats happen in the first-person view itself" delivery docs/02-setting-and-story.md calls for. For a level with a boss, this line *is* the reveal ("a boss standing where you expected an empty hall"), not a separate system. */
  introMessage: string;
  dungeon: DungeonMap;
  entities: EntitySpawn[];
  monsters: MonsterSpawn[];
}
