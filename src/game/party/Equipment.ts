import type { ResistanceMap } from "../combat/DamageType";
import { STAT_LABELS, type CharacterStats } from "./Character";

/**
 * Four slots, kept small on purpose (docs/06-items-and-equipment.md#equipment-slots).
 * Additional slots (helmet, boots, gloves) are an explicit stretch item
 * for later content phases, not v1.
 */
export type EquipmentSlot = "weapon" | "offhand" | "armor" | "accessory";

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  statBonus?: Partial<CharacterStats>;
  /** Multiplies (not replaces) the wearer's existing multiplier for that type, so bonuses from multiple sources stack. */
  resistanceBonus?: ResistanceMap;
  /** Cursed gear (docs/06-items-and-equipment.md#discovery-not-explanation's stretch tier): `GameLogic.unequipItem` refuses to remove it once worn. Never stated to the player ahead of time — same "discovery, not explanation" principle as every other mechanical effect on this table. */
  cursed?: boolean;
}

/**
 * A first pass at findable gear, per docs/06-items-and-equipment.md
 * "Item categories" — plain data, so adding more later doesn't touch
 * any equipping logic. Not the player-facing name/description text
 * (which never states mechanical effects — see
 * docs/06-items-and-equipment.md#discovery-not-explanation); this table
 * is our own internal vocabulary.
 */
export const EQUIPMENT_ITEMS: Record<string, EquipmentItem> = {
  "rusted-sword": {
    id: "rusted-sword",
    name: "a Rusted Sword",
    slot: "weapon",
    statBonus: { might: 2 },
  },
  "old-buckler": {
    id: "old-buckler",
    name: "an Old Buckler",
    slot: "offhand",
    statBonus: { grace: 1 },
  },
  "hardened-leather": {
    id: "hardened-leather",
    name: "Hardened Leather",
    slot: "armor",
    resistanceBonus: { physical: 0.9 },
  },
  "ember-charm": {
    id: "ember-charm",
    name: "an Ember Charm",
    slot: "accessory",
    resistanceBonus: { fire: 0.5 },
  },
  "shadow-ring": {
    id: "shadow-ring",
    name: "a Shadow Ring",
    slot: "accessory",
    statBonus: { grace: 2 },
  },
  "ambition-ring": {
    id: "ambition-ring",
    name: "a Ring of Old Ambition",
    slot: "accessory",
    statBonus: { might: 3 },
    cursed: true, // a strong bonus with a real cost -- fitting for the one piece of gear found in Steward Marrow's own hall
  },
  "tarnished-talisman": {
    id: "tarnished-talisman",
    name: "a Tarnished Talisman",
    slot: "accessory",
    statBonus: { focus: 2 }, // the level 1 pushable-block pocket's reward -- see Level.ts
  },
};

/**
 * What a piece of gear actually does, in plain terms — computed from
 * its real `statBonus`/`resistanceBonus`/`cursed` data rather than a
 * hand-written string per item, so it can never drift from what
 * equipping it actually does (unlike `ConsumableItem.description`,
 * which is hand-written since a consumable's effect isn't just a flat
 * list of bonuses).
 *
 * Never shown up front (docs/06-items-and-equipment.md#discovery-not-explanation)
 * — only once `Inventory.isIdentified` is true for this item, the same
 * moment a consumable's own description becomes visible. Equipment has
 * no mystery *name* to resolve (only consumables ship unidentified —
 * see `Inventory.ts`'s `UNIDENTIFIED_NAMES`), so "identified" here
 * means something narrower and still true to "learned by using it":
 * `GameLogic.equipItem` marks an item identified the moment it's
 * actually worn for the first time (player request: "I want non
 * consumable inventory items to show their effect once identified
 * also").
 */
export function describeEquipmentEffect(item: EquipmentItem): string {
  const parts: string[] = [];
  if (item.statBonus) {
    for (const [stat, amount] of Object.entries(item.statBonus) as Array<[keyof CharacterStats, number]>) {
      parts.push(`${STAT_LABELS[stat]} ${amount >= 0 ? "+" : ""}${amount}`);
    }
  }
  if (item.resistanceBonus) {
    for (const [damageType, multiplier] of Object.entries(item.resistanceBonus)) {
      parts.push(`${capitalize(damageType)} damage taken ×${multiplier}`);
    }
  }
  const effect = parts.length > 0 ? `${parts.join(", ")}.` : "No mechanical effect.";
  return item.cursed ? `${effect} Cannot be removed once worn.` : effect;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
