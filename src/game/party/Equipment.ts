import type { ResistanceMap } from "../combat/DamageType";
import type { Inventory } from "../Inventory";
import { STAT_LABELS, type Character, type CharacterStats } from "./Character";

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
  /**
   * Minimum `effectiveStats` a character needs to equip this at all
   * (player request: "Items should have minimum attribute requirements
   * to be equipped that is thematic with the type of item and what it
   * does. More powerful items should have larger requirements") —
   * checked by `GameLogic.equipItem` before the swap goes through, not
   * enforced anywhere else (a character who somehow drops below it
   * later, e.g. nothing in this game currently lowers a stat, keeps
   * wearing it). The stat picked per item follows its own slot/effect,
   * not one blanket rule: a weapon or a heavy shield wants Might (the
   * stat that already means "carry capacity"), a light shield wants
   * Grace, body armor wants Vitality (the endurance to fight in it, not
   * just carry it), and an accessory's requirement matches whatever it
   * actually does — the same stat it boosts, or Focus for a charm's
   * elemental resistance. Tier 2 items, and the one cursed item, sit at
   * a strictly higher threshold than their tier-1/uncursed counterparts
   * in the same slot, same "more powerful loot, larger requirements"
   * rule this table already follows for raw bonus size.
   */
  statRequirement?: Partial<CharacterStats>;
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
    statRequirement: { might: 5 },
  },
  "old-buckler": {
    id: "old-buckler",
    name: "an Old Buckler",
    slot: "offhand",
    statBonus: { grace: 1 },
    statRequirement: { grace: 4 }, // light -- a shield you maneuver, not one you brace behind
  },
  "hardened-leather": {
    id: "hardened-leather",
    name: "Hardened Leather",
    slot: "armor",
    resistanceBonus: { physical: 0.9 },
    statRequirement: { vitality: 5 },
  },
  "ember-charm": {
    id: "ember-charm",
    name: "an Ember Charm",
    slot: "accessory",
    resistanceBonus: { fire: 0.5 },
    statRequirement: { focus: 5 }, // channeling an elemental resistance, not raw stat/willpower -- Focus, not Resolve
  },
  "shadow-ring": {
    id: "shadow-ring",
    name: "a Shadow Ring",
    slot: "accessory",
    statBonus: { grace: 2 },
    statRequirement: { grace: 6 }, // a stronger Grace item than the buckler -- a stronger Grace requirement too
  },
  "ambition-ring": {
    id: "ambition-ring",
    name: "a Ring of Old Ambition",
    slot: "accessory",
    statBonus: { might: 3 },
    cursed: true, // a strong bonus with a real cost -- fitting for the one piece of gear found in Steward Marrow's own hall
    statRequirement: { might: 8 }, // the highest requirement in the game -- strong enough to seize the power, not disciplined enough to resist what comes with it
  },
  "tarnished-talisman": {
    id: "tarnished-talisman",
    name: "a Tarnished Talisman",
    slot: "accessory",
    statBonus: { focus: 2 }, // the level 1 pushable-block pocket's reward -- see Level.ts
    statRequirement: { focus: 5 },
  },

  // Tier 2 -- deeper-level finds, strictly stronger than anything above
  // (player request: "increasingly more powerful loot"). Not a new
  // mechanic, just bigger numbers and, starting with the pendant below,
  // the first item to bonus more than one stat at once -- and, per a
  // later player request, a correspondingly higher `statRequirement`
  // than its tier-1 counterpart in the same slot.
  "iron-halberd": {
    id: "iron-halberd",
    name: "an Iron Halberd",
    slot: "weapon",
    statBonus: { might: 3 }, // strictly ahead of the Rusted Sword's +2
    statRequirement: { might: 7 }, // strictly ahead of the Rusted Sword's 5
  },
  "steel-cuirass": {
    id: "steel-cuirass",
    name: "a Steel Cuirass",
    slot: "armor",
    resistanceBonus: { physical: 0.8 }, // strictly ahead of Hardened Leather's ×0.9
    statRequirement: { vitality: 7 }, // strictly ahead of Hardened Leather's 5
  },
  "crown-shard-pendant": {
    id: "crown-shard-pendant",
    name: "a Crown Shard Pendant",
    slot: "accessory",
    statBonus: { might: 2, focus: 2 }, // the first dual-stat item -- the same crown shard levels 3-4's lore items describe
    statRequirement: { might: 6, focus: 6 }, // a dual requirement to match -- both stats it boosts, not just one
  },
  "reinforced-kite-shield": {
    id: "reinforced-kite-shield",
    name: "a Reinforced Kite Shield",
    slot: "offhand",
    resistanceBonus: { physical: 0.85 }, // the first off-hand to trade the Old Buckler's +Grace for real damage mitigation -- the level 4 pre-boss vault's reward
    statRequirement: { might: 6 }, // heavier than the buckler -- braced behind, not maneuvered, so Might rather than Grace
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
 * `CombatEngine` marks an item identified the moment its bonus actually
 * factors into a fight — a might/focus bonus landing a hit, a
 * resistance bonus blocking part of one, or a grace bonus changing
 * initiative order — not merely once worn (player report: "The items
 * are showing their effects as soon as they are equipped. I only want
 * to show the effect of the item once it has been triggered in
 * combat.").
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
  let effect = parts.length > 0 ? `${parts.join(", ")}.` : "No mechanical effect.";
  if (item.statRequirement) effect += ` Requires ${describeRequirement(item)}.`;
  if (item.cursed) effect += " Cannot be removed once worn.";
  return effect;
}

/** Plain-English rendering of `item.statRequirement` ("5 Might", "6 Might and 6 Focus") — shared by `describeEquipmentEffect`'s always-visible-once-identified line and `GameLogic.equipItem`'s refusal message, so the two can never disagree about what an item actually demands. */
export function describeRequirement(item: EquipmentItem): string {
  const parts = Object.entries(item.statRequirement ?? {}).map(
    ([stat, amount]) => `${amount} ${STAT_LABELS[stat as keyof CharacterStats]}`,
  );
  return parts.join(" and ");
}

/** True if `stats` (a character's current `effectiveStats` — whatever they'd have *without* this item, since it isn't worn yet) clears every one of `item.statRequirement`'s thresholds. An item with no requirement always passes. */
export function meetsRequirement(stats: CharacterStats, item: EquipmentItem): boolean {
  if (!item.statRequirement) return true;
  return Object.entries(item.statRequirement).every(
    ([stat, amount]) => stats[stat as keyof CharacterStats] >= amount!,
  );
}

/**
 * How much of `character`'s current `stat` comes from *identified*
 * equipment specifically — the number `InventoryUI`'s stat rows
 * actually display, and the one it colors differently to call out
 * (player request: "when I've identified an item, the impact on
 * attributes should be visible when I equip/unequip the item, the
 * attribute value should change and change color to show it was
 * modified by an item"). Deliberately narrower than
 * `Character.equipmentBonusFor`, which doesn't know or care about
 * identification (the bonus already applies in combat regardless of
 * it) — this is the one place that intersects it with
 * `Inventory.isIdentified` before anything gets shown, the same
 * discovery gate every other mechanical effect on this page answers to
 * (docs/06-items-and-equipment.md#discovery-not-explanation): an
 * unidentified item's bonus is mechanically live but never counted
 * here, so equipping something new never reveals its effect through
 * this number either, only through actually triggering it in combat.
 */
export function identifiedStatBonus(character: Character, stat: keyof CharacterStats, inventory: Inventory): number {
  return character
    .equipmentBonusFor(stat)
    .filter(({ item }) => inventory.isIdentified(item.id))
    .reduce((sum, { amount }) => sum + amount, 0);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
