import type { DungeonMap } from "../DungeonMap";
import type { Player } from "../Player";
import { Monster, type GridPoint } from "./Monster";

/**
 * Factories for each monster type placed in the starting level — kept
 * as plain data + a constructor call, per the "Character & item data"
 * architecture principle in docs/07-technical-architecture.md, so
 * adding a new type later is a new function here, not a change to
 * `Monster` itself.
 */

export function createRotThing(x: number, z: number, patrolPoints: GridPoint[], dungeon: DungeonMap, player: Player): Monster {
  return new Monster(
    {
      name: "Rot-thing",
      x,
      z,
      patrolPoints,
      detectionRadius: 3,
      maxHp: 18,
      might: 3,
      initiativeStat: 3,
      // No resistances -- Phase 2's baseline monster, teaching front/back
      // rank and Attack/Defend fundamentals per docs/05-combat.md's
      // teaching ladder.
      xpReward: 15,
    },
    dungeon,
    player,
  );
}

/**
 * The Cinder Wretch (docs/05-combat.md#a-teaching-ladder-illustrative-not-final-content):
 * resistant to Physical, weak to Fire — the fight is wrong without the
 * Mage's Firebolt, the Rogue's resistance-ignoring Precision Strike, or
 * (once consumables ship) an Oil Flask.
 */
export function createCinderWretch(
  x: number,
  z: number,
  patrolPoints: GridPoint[],
  dungeon: DungeonMap,
  player: Player,
): Monster {
  return new Monster(
    {
      name: "Cinder Wretch",
      x,
      z,
      patrolPoints,
      detectionRadius: 3,
      maxHp: 20,
      might: 4,
      initiativeStat: 4,
      resistances: { physical: 0.5, fire: 2 },
      xpReward: 25, // worth more than the Rot-thing -- the resistance/weakness makes it a harder, more instructive fight
    },
    dungeon,
    player,
  );
}

/** Every monster type a level's data can spawn — adding a new one here is one line, not a change to `Game.ts`. */
export type MonsterTypeId = "rotThing" | "cinderWretch";

/** A level-data description of one monster placement, mirroring `EntitySpawn` for interactables (see `interactables/types.ts`) — plain data, not a constructed `Monster`, so level files stay pure data too. */
export interface MonsterSpawn {
  type: MonsterTypeId;
  x: number;
  z: number;
  patrolPoints: GridPoint[];
}

/** Builds every monster a level's spawn list describes, per docs/08-roadmap-phases.md Phase 4's multi-level descent — `Game.ts` calls this once per level load instead of hardcoding a fixed monster list itself. */
export function buildMonsters(spawns: MonsterSpawn[], dungeon: DungeonMap, player: Player): Monster[] {
  return spawns.map((spawn) => {
    switch (spawn.type) {
      case "rotThing":
        return createRotThing(spawn.x, spawn.z, spawn.patrolPoints, dungeon, player);
      case "cinderWretch":
        return createCinderWretch(spawn.x, spawn.z, spawn.patrolPoints, dungeon, player);
    }
  });
}
