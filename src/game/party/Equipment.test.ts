import { describe, expect, it } from "vitest";
import { Character } from "./Character";
import { describeEquipmentEffect, EQUIPMENT_ITEMS, type EquipmentItem } from "./Equipment";

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
});

describe("describeEquipmentEffect (docs/08-roadmap-phases.md Phase 7, on a player request: \"I want non consumable inventory items to show their effect once identified also\")", () => {
  it("describes a flat stat bonus", () => {
    expect(describeEquipmentEffect(EQUIPMENT_ITEMS["rusted-sword"])).toBe("Might +2.");
  });

  it("describes a resistance bonus", () => {
    expect(describeEquipmentEffect(EQUIPMENT_ITEMS["hardened-leather"])).toBe("Physical damage taken ×0.9.");
  });

  it("lists multiple stat bonuses together", () => {
    const item: EquipmentItem = { id: "test", name: "Test Item", slot: "accessory", statBonus: { might: 1, grace: 2 } };
    expect(describeEquipmentEffect(item)).toBe("Might +1, Grace +2.");
  });

  it("appends a note for cursed gear", () => {
    expect(describeEquipmentEffect(EQUIPMENT_ITEMS["ambition-ring"])).toBe("Might +3. Cannot be removed once worn.");
  });

  it("names an item with no bonus at all, rather than an empty string", () => {
    const item: EquipmentItem = { id: "test", name: "Test Item", slot: "accessory" };
    expect(describeEquipmentEffect(item)).toBe("No mechanical effect.");
  });

  it("every real equipment item produces a non-empty description", () => {
    for (const item of Object.values(EQUIPMENT_ITEMS)) {
      expect(describeEquipmentEffect(item).length, item.id).toBeGreaterThan(0);
    }
  });
});
