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

/**
 * The Screeching Wraith (docs/05-combat.md#a-teaching-ladder-illustrative-not-final-content):
 * its telegraphed heavy strike inflicts Fear, which forces a character
 * to Defend on their very next turn instead of acting
 * (`CombatEngine.submitAction`) — the lesson here is the Resolve stat
 * (a higher-Resolve target shrugs it off faster once cured) and the
 * Cleric's Cleanse, not raw damage; its might is deliberately low.
 */
export function createScreechingWraith(
  x: number,
  z: number,
  patrolPoints: GridPoint[],
  dungeon: DungeonMap,
  player: Player,
): Monster {
  return new Monster(
    {
      name: "Screeching Wraith",
      x,
      z,
      patrolPoints,
      detectionRadius: 4, // notices from further off than the others -- it's fast and unnatural, not stalking
      maxHp: 16,
      might: 2,
      initiativeStat: 6,
      flavor: {
        light: "lets out a warning shriek, gathering itself for something worse!",
        heavy: "unleashes a soul-splitting scream!",
      },
      heavyStatusEffect: { type: "fear", turnsRemaining: 2 },
      xpReward: 22,
    },
    dungeon,
    player,
  );
}

/**
 * The Court Alchemist (docs/05-combat.md#a-teaching-ladder-illustrative-not-final-content):
 * a support caster that heals rather than attacks on its telegraphed
 * turn — the single-monster analogue to "kill the healer first" that
 * `healsOnHeavyTurn` documents on `MonsterOptions`, since `CombatEngine`
 * doesn't yet support more than one monster in an encounter at once.
 * Burst it down before its heal-turn comes around, or the fight drags
 * on considerably longer than its HP total alone suggests.
 */
export function createCourtAlchemist(
  x: number,
  z: number,
  patrolPoints: GridPoint[],
  dungeon: DungeonMap,
  player: Player,
): Monster {
  return new Monster(
    {
      name: "Court Alchemist",
      x,
      z,
      patrolPoints,
      detectionRadius: 3,
      maxHp: 22,
      might: 3,
      initiativeStat: 4,
      flavor: {
        light: "hurls a caustic vial at you, murmuring under its breath!",
        heavy: "drinks down a restorative draught, mending its wounds!",
      },
      healsOnHeavyTurn: 9,
      xpReward: 25, // as hard as the Cinder Wretch in practice -- the heal prolongs the fight considerably if ignored
    },
    dungeon,
    player,
  );
}

/**
 * Steward Marrow (docs/08-roadmap-phases.md Phase 5): Act 1's boss,
 * guarding the way down out of the Sunken Wards. Per
 * docs/05-combat.md#a-teaching-ladder-illustrative-not-final-content's
 * "the boss should combine mechanics from 2-3 earlier monster types
 * rather than introduce an unrelated new gimmick," this fight is
 * assembled entirely from mechanics the party has already met: the
 * Rot-thing's telegraphed heavy strike (baseline), the Screeching
 * Wraith's Fear on that heavy strike, and a Cinder-Wretch-shaped
 * resistance profile — resistant to Physical, but weak to Holy rather
 * than Fire, so the exact answer isn't just "the same trick again."
 * Higher HP/Might than anything before it, befitting "everything
 * you've learned, at once."
 */
export function createStewardMarrow(
  x: number,
  z: number,
  patrolPoints: GridPoint[],
  dungeon: DungeonMap,
  player: Player,
): Monster {
  return new Monster(
    {
      name: "Steward Marrow",
      x,
      z,
      patrolPoints,
      detectionRadius: 5,
      maxHp: 40,
      might: 5,
      initiativeStat: 5,
      resistances: { physical: 0.6, holy: 1.5 },
      flavor: {
        light: "raises a rusted ceremonial blade, still standing at their post!",
        heavy: "brings the blade down with the full weight of six lost generations!",
      },
      heavyStatusEffect: { type: "fear", turnsRemaining: 2 },
      xpReward: 50,
    },
    dungeon,
    player,
  );
}

/**
 * The Bound Servant (docs/05-combat.md#a-teaching-ladder-illustrative-not-final-content):
 * no resistance, no status effect — its whole identity *is* the
 * telegraph every monster already has, isolated and turned up. Much
 * higher might than the Rot-thing, so ignoring the "raises an arm"
 * warning and eating the heavy strike unguarded actually hurts, where
 * the Rot-thing's own heavy hit rarely feels urgent enough to teach the
 * lesson on its own.
 */
export function createBoundServant(
  x: number,
  z: number,
  patrolPoints: GridPoint[],
  dungeon: DungeonMap,
  player: Player,
): Monster {
  return new Monster(
    {
      name: "Bound Servant",
      x,
      z,
      patrolPoints,
      detectionRadius: 3,
      maxHp: 26,
      might: 6,
      initiativeStat: 3,
      flavor: {
        light: "strains against unseen chains, one arm slowly rising!",
        heavy: "wrenches free and brings its arm down like a falling gate!",
      },
      xpReward: 28,
    },
    dungeon,
    player,
  );
}

/**
 * The Armored Sentinel (docs/05-combat.md#a-teaching-ladder-illustrative-not-final-content):
 * a reach weapon (`hasReach`, see `Monster.ts`/`CombatEngine.pickTarget`)
 * that can strike the back rank even while the front rank still stands —
 * "rank alone doesn't guarantee safety," the one lesson no earlier
 * monster teaches. Physical-resistant (the armor its name promises),
 * but no weakness and no status effect — the reach mechanic alone is
 * the whole point of this fight.
 */
export function createArmoredSentinel(
  x: number,
  z: number,
  patrolPoints: GridPoint[],
  dungeon: DungeonMap,
  player: Player,
): Monster {
  return new Monster(
    {
      name: "Armored Sentinel",
      x,
      z,
      patrolPoints,
      detectionRadius: 3,
      maxHp: 24,
      might: 4,
      initiativeStat: 3,
      resistances: { physical: 0.7 },
      hasReach: true,
      flavor: {
        light: "levels a long, cruel-looking pike, testing the room's reach!",
        heavy: "drives the pike clean past the front line!",
      },
      xpReward: 30,
    },
    dungeon,
    player,
  );
}

/** Every monster type a level's data can spawn — adding a new one here is one line, not a change to `Game.ts`. */
export type MonsterTypeId =
  | "rotThing"
  | "cinderWretch"
  | "screechingWraith"
  | "courtAlchemist"
  | "boundServant"
  | "armoredSentinel"
  | "stewardMarrow";

/** Every `MonsterTypeId`, for anything that needs to iterate all seven rather than hardcode the union — `AssetManifest.test.ts`'s "every monster has a linked sprite" check. */
export const ALL_MONSTER_TYPE_IDS: MonsterTypeId[] = [
  "rotThing",
  "cinderWretch",
  "screechingWraith",
  "courtAlchemist",
  "boundServant",
  "armoredSentinel",
  "stewardMarrow",
];

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
      case "screechingWraith":
        return createScreechingWraith(spawn.x, spawn.z, spawn.patrolPoints, dungeon, player);
      case "courtAlchemist":
        return createCourtAlchemist(spawn.x, spawn.z, spawn.patrolPoints, dungeon, player);
      case "boundServant":
        return createBoundServant(spawn.x, spawn.z, spawn.patrolPoints, dungeon, player);
      case "armoredSentinel":
        return createArmoredSentinel(spawn.x, spawn.z, spawn.patrolPoints, dungeon, player);
      case "stewardMarrow":
        return createStewardMarrow(spawn.x, spawn.z, spawn.patrolPoints, dungeon, player);
    }
  });
}
