/**
 * The four damage types (docs/05-combat.md#damage-types) — kept small on
 * purpose, not a full elemental wheel. A monster's resistance/weakness
 * to these is the actual mechanism behind "every monster is a lesson":
 * knowing a monster's type should change which character or item you
 * lead with, not just deal more damage at it.
 */
export type DamageType = "physical" | "fire" | "blight" | "holy";

/** A combatant's resistance/weakness multipliers — 1 (unlisted) is neutral, <1 resists, >1 is a weakness. */
export type ResistanceMap = Partial<Record<DamageType, number>>;

export function resistanceMultiplier(resistances: ResistanceMap | undefined, type: DamageType): number {
  return resistances?.[type] ?? 1;
}

/** Applies a resistance multiplier and rounds to a whole number, since damage is always an integer. */
export function applyResistance(rawDamage: number, resistances: ResistanceMap | undefined, type: DamageType): number {
  return Math.max(0, Math.round(rawDamage * resistanceMultiplier(resistances, type)));
}
