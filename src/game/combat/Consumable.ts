import type { DamageType } from "./DamageType";
import type { StatusEffectType } from "./StatusEffect";

export type ConsumableEffect =
  | { kind: "cure"; status: StatusEffectType }
  | { kind: "damage"; damageType: DamageType; amount: number };

export interface ConsumableItem {
  id: string;
  name: string;
  effect: ConsumableEffect;
}

/**
 * The combat-countering consumables (docs/06-items-and-equipment.md#combat-countering-consumables):
 * a party missing the "right" class for a given monster can still solve
 * the fight by carrying the right item. Cure items target the user —
 * there's no ally-targeting UI yet, so "drink it yourself" is the v1
 * scope. Oil Flask is a deliberate simplification of the doc's "converts
 * your next attack to Fire": a direct Fire-damage throw instead of a
 * buff-then-attack combo, which needs no extra engine state to track and
 * still fully answers "no Mage in the party, Physical-resistant enemy".
 */
export const CONSUMABLE_ITEMS: Record<string, ConsumableItem> = {
  antidote: { id: "antidote", name: "an Antidote", effect: { kind: "cure", status: "poison" } },
  bandages: { id: "bandages", name: "Bandages", effect: { kind: "cure", status: "bleed" } },
  "smelling-salts": { id: "smelling-salts", name: "Smelling Salts", effect: { kind: "cure", status: "fear" } },
  "holy-water": { id: "holy-water", name: "Holy Water", effect: { kind: "damage", damageType: "holy", amount: 8 } },
  "oil-flask": { id: "oil-flask", name: "an Oil Flask", effect: { kind: "damage", damageType: "fire", amount: 6 } },
};
