import type { ResistanceMap } from "../combat/DamageType";
import type { CharacterStats } from "./Character";

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
};
