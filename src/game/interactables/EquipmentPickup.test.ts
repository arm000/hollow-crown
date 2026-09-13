import { describe, expect, it } from "vitest";
import { Inventory } from "../Inventory";
import { Character } from "../party/Character";
import { EQUIPMENT_ITEMS } from "../party/Equipment";
import { Party } from "../party/Party";
import { EquipmentPickup } from "./EquipmentPickup";

function newBram(): Character {
  return new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
}

describe("EquipmentPickup", () => {
  it("never blocks movement", () => {
    const pickup = new EquipmentPickup(1, 1, EQUIPMENT_ITEMS["rusted-sword"], "Bram");
    expect(pickup.blocksMovement()).toBe(false);
  });

  it("equips the item onto the named party member on enter", () => {
    const bram = newBram();
    const party = new Party([bram]);
    const pickup = new EquipmentPickup(1, 1, EQUIPMENT_ITEMS["rusted-sword"], "Bram");

    const message = pickup.onEnter({ inventory: new Inventory(), party });

    expect(bram.equippedIn("weapon")?.id).toBe("rusted-sword");
    expect(message).toContain("Bram");
    expect(pickup.isConsumed()).toBe(true);
  });

  it("does nothing if the named character isn't in the party", () => {
    const party = new Party([newBram()]);
    const pickup = new EquipmentPickup(1, 1, EQUIPMENT_ITEMS["rusted-sword"], "Nobody");

    const message = pickup.onEnter({ inventory: new Inventory(), party });

    expect(message).toBeUndefined();
  });

  it("does nothing on a second onEnter (already collected)", () => {
    const bram = newBram();
    const party = new Party([bram]);
    const pickup = new EquipmentPickup(1, 1, EQUIPMENT_ITEMS["rusted-sword"], "Bram");
    pickup.onEnter({ inventory: new Inventory(), party });

    const message = pickup.onEnter({ inventory: new Inventory(), party });

    expect(message).toBeUndefined();
  });
});
