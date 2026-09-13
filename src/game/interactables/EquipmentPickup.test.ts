import { describe, expect, it } from "vitest";
import { Inventory } from "../Inventory";
import { Party } from "../party/Party";
import { EQUIPMENT_ITEMS } from "../party/Equipment";
import { EquipmentPickup } from "./EquipmentPickup";

describe("EquipmentPickup", () => {
  it("never blocks movement", () => {
    const pickup = new EquipmentPickup(1, 1, EQUIPMENT_ITEMS["rusted-sword"]);
    expect(pickup.blocksMovement()).toBe(false);
  });

  it("adds the item to the shared inventory on enter, unequipped", () => {
    const inventory = new Inventory();
    const pickup = new EquipmentPickup(1, 1, EQUIPMENT_ITEMS["rusted-sword"]);

    const message = pickup.onEnter({ inventory, party: new Party([]) });

    expect(inventory.has("rusted-sword")).toBe(true);
    expect(message).toContain("Rusted Sword");
    expect(pickup.isConsumed()).toBe(true);
  });

  it("does nothing on a second onEnter (already collected)", () => {
    const inventory = new Inventory();
    const pickup = new EquipmentPickup(1, 1, EQUIPMENT_ITEMS["rusted-sword"]);
    pickup.onEnter({ inventory, party: new Party([]) });

    const message = pickup.onEnter({ inventory, party: new Party([]) });

    expect(message).toBeUndefined();
    expect(inventory.entries().find((e) => e.id === "rusted-sword")?.count).toBe(1); // not double-added
  });
});
