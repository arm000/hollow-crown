import type { DamageType } from "../combat/DamageType";
import type { Monster } from "./Monster";

const DAMAGE_TYPES: DamageType[] = ["physical", "fire", "blight", "holy"];

export interface BestiaryEntry {
  name: string;
  /** Only the damage types this monster actually resists or is weak to — a neutral (1×, unlisted) multiplier has nothing to show. */
  resistances: Array<{ damageType: DamageType; multiplier: number }>;
  /** The status effect its telegraphed heavy strike inflicts, if any. */
  inflicts?: string;
  /** Set if its telegraphed turn heals itself instead of attacking. */
  healsOnHeavyTurn?: number;
  /** Set if this monster's attacks ignore rank (the Armored Sentinel) — see `Monster.hasReach`. */
  hasReach?: boolean;
}

/**
 * Builds a bestiary/codex entry (docs/05-combat.md#the-bestiary) straight
 * from an encountered `Monster` instance — no separate, hand-maintained
 * data table to keep in sync with `bestiary.ts`'s factories, since every
 * `Monster` of a given type already carries the exact fields (resistances,
 * `heavyStatusEffect`, `healsOnHeavyTurn`) this needs to describe.
 */
export function describeMonster(monster: Monster): BestiaryEntry {
  const resistances = DAMAGE_TYPES.filter((type) => {
    const multiplier = monster.resistances[type];
    return multiplier !== undefined && multiplier !== 1;
  }).map((type) => ({ damageType: type, multiplier: monster.resistances[type]! }));

  return {
    name: monster.name,
    resistances,
    inflicts: monster.heavyStatusEffect?.type,
    healsOnHeavyTurn: monster.healsOnHeavyTurn,
    hasReach: monster.hasReach || undefined, // omit rather than carry an explicit `false` -- BestiaryUI treats presence as the signal
  };
}
