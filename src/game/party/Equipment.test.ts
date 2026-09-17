import { describe, expect, it } from "vitest";
import { Character, type CharacterStats } from "./Character";
import { describeEquipmentEffect, describeRequirement, EQUIPMENT_ITEMS, meetsRequirement, type EquipmentItem } from "./Equipment";

function newCharacter(): Character {
  return new Character("Test", "warrior", "front", { might: 5, grace: 5, vitality: 5, focus: 5, resolve: 5 }, 20, 0);
}

describe("Character equipment", () => {
  it("effectiveStats matches base stats with nothing equipped", () => {
    const character = newCharacter();
    expect(character.effectiveStats).toEqual(character.stats);
  });

  it("equipping a weapon adds its stat bonus to effectiveStats", () => {
    const character = newCharacter();
    character.equip(EQUIPMENT_ITEMS["rusted-sword"]);
    expect(character.effectiveStats.might).toBe(7); // base 5 + 2
    expect(character.stats.might).toBe(5); // base stats never mutate
  });

  it("bonuses from multiple slots stack", () => {
    const character = newCharacter();
    character.equip(EQUIPMENT_ITEMS["rusted-sword"]); // +2 might
    character.equip(EQUIPMENT_ITEMS["old-buckler"]); // +1 grace
    expect(character.effectiveStats.might).toBe(7);
    expect(character.effectiveStats.grace).toBe(6);
  });

  it("equipping into an occupied slot replaces the old item and returns it", () => {
    const character = newCharacter();
    character.equip(EQUIPMENT_ITEMS["rusted-sword"]);
    const replaced = character.equip({ id: "iron-sword", name: "an Iron Sword", slot: "weapon", statBonus: { might: 4 } });
    expect(replaced?.id).toBe("rusted-sword");
    expect(character.effectiveStats.might).toBe(9); // base 5 + 4, not stacked with the old sword
  });

  it("unequip removes the bonus and returns the removed item", () => {
    const character = newCharacter();
    character.equip(EQUIPMENT_ITEMS["rusted-sword"]);
    const removed = character.unequip("weapon");
    expect(removed?.id).toBe("rusted-sword");
    expect(character.effectiveStats.might).toBe(5);
  });

  it("effectiveResistances is empty with nothing equipped", () => {
    expect(newCharacter().effectiveResistances).toEqual({});
  });

  it("an accessory's resistance bonus multiplies the wearer's existing resistance", () => {
    const character = newCharacter();
    character.equip(EQUIPMENT_ITEMS["ember-charm"]); // fire: 0.5
    expect(character.effectiveResistances.fire).toBe(0.5);
  });

  it("resistance bonuses from multiple sources stack multiplicatively", () => {
    const character = newCharacter();
    character.resistances = { physical: 0.8 }; // e.g. from some other future source
    character.equip(EQUIPMENT_ITEMS["hardened-leather"]); // physical: 0.9
    expect(character.effectiveResistances.physical).toBeCloseTo(0.72); // 0.8 * 0.9
  });

  it("equippedIn reports what's currently worn in a slot", () => {
    const character = newCharacter();
    expect(character.equippedIn("weapon")).toBeUndefined();
    character.equip(EQUIPMENT_ITEMS["rusted-sword"]);
    expect(character.equippedIn("weapon")?.id).toBe("rusted-sword");
  });

  it("listEquipment returns everything currently worn", () => {
    const character = newCharacter();
    expect(character.listEquipment()).toEqual([]);
    character.equip(EQUIPMENT_ITEMS["rusted-sword"]);
    character.equip(EQUIPMENT_ITEMS["old-buckler"]);
    expect(character.listEquipment().map((item) => item.id).sort()).toEqual(["old-buckler", "rusted-sword"]);
  });

  it("initiativeStat reflects equipped Grace bonuses", () => {
    const character = newCharacter();
    const before = character.initiativeStat;
    character.equip(EQUIPMENT_ITEMS["old-buckler"]); // +1 grace
    expect(character.initiativeStat).toBe(before + 1);
  });

  describe("equipmentBonusFor (docs/08-roadmap-phases.md Phase 7 -- CombatEngine's attribution of bonus damage to a specific piece of gear)", () => {
    it("is empty for a stat nothing equipped bonuses", () => {
      const character = newCharacter();
      character.equip(EQUIPMENT_ITEMS["rusted-sword"]); // might only
      expect(character.equipmentBonusFor("focus")).toEqual([]);
    });

    it("names the item and amount for a stat something equipped does bonus", () => {
      const character = newCharacter();
      character.equip(EQUIPMENT_ITEMS["rusted-sword"]);
      expect(character.equipmentBonusFor("might")).toEqual([{ item: EQUIPMENT_ITEMS["rusted-sword"], amount: 2 }]);
    });

    it("lists every contributing slot when more than one bonuses the same stat", () => {
      const character = newCharacter();
      character.equip(EQUIPMENT_ITEMS["shadow-ring"]); // +2 grace
      character.equip(EQUIPMENT_ITEMS["old-buckler"]); // +1 grace
      expect(character.equipmentBonusFor("grace").map((c) => c.item.id).sort()).toEqual(["old-buckler", "shadow-ring"]);
    });
  });

  describe("equipmentResistanceFor (same idea as equipmentBonusFor, for the damage-taken side)", () => {
    it("is empty for a damage type nothing equipped resists", () => {
      const character = newCharacter();
      character.equip(EQUIPMENT_ITEMS["hardened-leather"]); // physical only
      expect(character.equipmentResistanceFor("fire")).toEqual([]);
    });

    it("names the item and multiplier for a damage type something equipped resists", () => {
      const character = newCharacter();
      character.equip(EQUIPMENT_ITEMS["hardened-leather"]);
      expect(character.equipmentResistanceFor("physical")).toEqual([
        { item: EQUIPMENT_ITEMS["hardened-leather"], multiplier: 0.9 },
      ]);
    });
  });
});

describe("describeEquipmentEffect (docs/08-roadmap-phases.md Phase 7, on a player request: \"I want non consumable inventory items to show their effect once identified also\")", () => {
  it("describes a flat stat bonus", () => {
    expect(describeEquipmentEffect(EQUIPMENT_ITEMS["rusted-sword"])).toBe("Might +2. Requires 5 Might.");
  });

  it("describes a resistance bonus", () => {
    expect(describeEquipmentEffect(EQUIPMENT_ITEMS["hardened-leather"])).toBe(
      "Physical damage taken ×0.9. Requires 5 Vitality.",
    );
  });

  it("lists multiple stat bonuses together", () => {
    const item: EquipmentItem = { id: "test", name: "Test Item", slot: "accessory", statBonus: { might: 1, grace: 2 } };
    expect(describeEquipmentEffect(item)).toBe("Might +1, Grace +2.");
  });

  it("appends a requirement note, then a cursed note, in that order", () => {
    expect(describeEquipmentEffect(EQUIPMENT_ITEMS["ambition-ring"])).toBe(
      "Might +3. Requires 8 Might. Cannot be removed once worn.",
    );
  });

  it("names an item with no bonus at all, rather than an empty string", () => {
    const item: EquipmentItem = { id: "test", name: "Test Item", slot: "accessory" };
    expect(describeEquipmentEffect(item)).toBe("No mechanical effect.");
  });

  it("describes the first dual-stat item (tier 2 loot) the same way as any hand-built multi-stat item, requirement included", () => {
    expect(describeEquipmentEffect(EQUIPMENT_ITEMS["crown-shard-pendant"])).toBe(
      "Might +2, Focus +2. Requires 6 Might and 6 Focus.",
    );
  });

  it("every real equipment item produces a non-empty description", () => {
    for (const item of Object.values(EQUIPMENT_ITEMS)) {
      expect(describeEquipmentEffect(item).length, item.id).toBeGreaterThan(0);
    }
  });
});

describe("meetsRequirement/describeRequirement (player request: \"Items should have minimum attribute requirements to be equipped that is thematic with the type of item and what is does. More powerful items should have larger requirements\")", () => {
  it("an item with no requirement always passes", () => {
    const item: EquipmentItem = { id: "test", name: "Test Item", slot: "accessory" };
    expect(meetsRequirement({ might: 0, grace: 0, vitality: 0, focus: 0, resolve: 0 }, item)).toBe(true);
  });

  it("passes when every listed stat meets its threshold exactly", () => {
    const item: EquipmentItem = { id: "test", name: "Test Item", slot: "weapon", statRequirement: { might: 5 } };
    expect(meetsRequirement({ might: 5, grace: 0, vitality: 0, focus: 0, resolve: 0 }, item)).toBe(true);
  });

  it("fails when even one stat falls short", () => {
    const item: EquipmentItem = { id: "test", name: "Test Item", slot: "accessory", statRequirement: { might: 6, focus: 6 } };
    expect(meetsRequirement({ might: 6, grace: 0, vitality: 0, focus: 5, resolve: 0 }, item)).toBe(false);
  });

  it("describeRequirement joins multiple stats with \"and\"", () => {
    expect(describeRequirement(EQUIPMENT_ITEMS["crown-shard-pendant"])).toBe("6 Might and 6 Focus");
  });

  it("every real equipment item has a requirement, thematic to its slot/effect", () => {
    // Weapons and the one heavy off-hand shield: Might (the stat that
    // already means "carry capacity"). The one light off-hand shield:
    // Grace. Body armor: Vitality. Accessories: whichever stat(s) they
    // actually boost, or Focus for an elemental-resistance charm.
    const expectedStat: Record<string, (keyof CharacterStats)[]> = {
      "rusted-sword": ["might"],
      "iron-halberd": ["might"],
      "old-buckler": ["grace"],
      "reinforced-kite-shield": ["might"],
      "hardened-leather": ["vitality"],
      "steel-cuirass": ["vitality"],
      "ember-charm": ["focus"],
      "shadow-ring": ["grace"],
      "ambition-ring": ["might"],
      "tarnished-talisman": ["focus"],
      "crown-shard-pendant": ["might", "focus"],
    };

    for (const [id, stats] of Object.entries(expectedStat)) {
      const item = EQUIPMENT_ITEMS[id];
      expect(item.statRequirement, id).toBeDefined();
      expect(Object.keys(item.statRequirement!).sort(), id).toEqual([...stats].sort());
    }
  });

  it("every tier-2 item's requirement is strictly higher than its tier-1 counterpart in the same slot", () => {
    expect(EQUIPMENT_ITEMS["iron-halberd"].statRequirement!.might!).toBeGreaterThan(
      EQUIPMENT_ITEMS["rusted-sword"].statRequirement!.might!,
    );
    expect(EQUIPMENT_ITEMS["steel-cuirass"].statRequirement!.vitality!).toBeGreaterThan(
      EQUIPMENT_ITEMS["hardened-leather"].statRequirement!.vitality!,
    );
  });

  it("the one cursed item carries the single highest requirement in the game -- strong enough to seize it, not disciplined enough to resist what comes with it", () => {
    const highest = Math.max(
      ...Object.values(EQUIPMENT_ITEMS).flatMap((item) => Object.values(item.statRequirement ?? {})),
    );
    expect(EQUIPMENT_ITEMS["ambition-ring"].statRequirement!.might).toBe(highest);
  });
});
