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
    },
    dungeon,
    player,
  );
}
