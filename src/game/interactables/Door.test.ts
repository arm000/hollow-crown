import { describe, expect, it } from "vitest";
import { Inventory } from "../Inventory";
import { Door } from "./Door";

describe("Door", () => {
  it("blocks movement while locked", () => {
    const door = new Door(1, 1, "rusted-key");
    expect(door.blocksMovement()).toBe(true);
  });

  it("does not block movement once unlocked", () => {
    const door = new Door(1, 1, "rusted-key", false);
    expect(door.blocksMovement()).toBe(false);
  });

  it("refuses to unlock without the required key", () => {
    const door = new Door(1, 1, "rusted-key");
    const message = door.interact({ inventory: new Inventory() });
    expect(door.locked).toBe(true);
    expect(message).toBe("The door is locked.");
  });

  it("unlocks when the party holds the required key", () => {
    const door = new Door(1, 1, "rusted-key");
    const inventory = new Inventory();
    inventory.add("rusted-key");

    const message = door.interact({ inventory });

    expect(door.locked).toBe(false);
    expect(door.blocksMovement()).toBe(false);
    expect(message).toBe("You unlock the door.");
  });

  it("stays unlocked and gives a neutral message on a second interact", () => {
    const door = new Door(1, 1, "rusted-key");
    const inventory = new Inventory();
    inventory.add("rusted-key");
    door.interact({ inventory });

    const message = door.interact({ inventory });

    expect(message).toBe("The door is already open.");
  });

  it("with no required key stays locked until unlocked some other way (e.g. a lever)", () => {
    const door = new Door(1, 1, undefined);
    const message = door.interact({ inventory: new Inventory() });
    expect(door.locked).toBe(true);
    expect(message).toBe("The door is locked.");
  });
});
