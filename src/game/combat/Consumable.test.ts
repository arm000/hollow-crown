import { describe, expect, it } from "vitest";
import { CONSUMABLE_ITEMS } from "./Consumable";

describe("CONSUMABLE_ITEMS data integrity", () => {
  it("every entry's own id matches the key it's filed under", () => {
    for (const [key, item] of Object.entries(CONSUMABLE_ITEMS)) {
      expect(item.id, key).toBe(key);
    }
  });

  it("every entry has a non-empty description -- InventoryUI's tooltip once identified (docs/08-roadmap-phases.md Phase 7, on a player request that an item's properties become learnable after use)", () => {
    for (const item of Object.values(CONSUMABLE_ITEMS)) {
      expect(item.description.length, item.id).toBeGreaterThan(0);
    }
  });

  it("a cure item's description mentions the status it cures", () => {
    for (const item of Object.values(CONSUMABLE_ITEMS)) {
      if (item.effect.kind !== "cure") continue;
      expect(item.description.toLowerCase(), item.id).toContain(item.effect.status);
    }
  });

  it("a damage item's description mentions its damage amount and type", () => {
    for (const item of Object.values(CONSUMABLE_ITEMS)) {
      if (item.effect.kind !== "damage") continue;
      expect(item.description, item.id).toContain(String(item.effect.amount));
      expect(item.description.toLowerCase(), item.id).toContain(item.effect.damageType);
    }
  });
});
