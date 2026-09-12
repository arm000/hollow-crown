import { describe, expect, it } from "vitest";
import { Inventory } from "../Inventory";
import { InteractableManager } from "./InteractableManager";

describe("InteractableManager", () => {
  it("builds runtime entities from spawn data and finds them by position", () => {
    const manager = InteractableManager.fromSpawns([
      { type: "door", x: 2, z: 3, params: { keyId: "rusted-key" } },
      { type: "exit", x: 5, z: 5 },
    ]);

    expect(manager.at(2, 3)?.kind).toBe("door");
    expect(manager.at(5, 5)?.kind).toBe("exit");
    expect(manager.at(0, 0)).toBeUndefined();
  });

  it("throws on an unknown spawn type rather than silently dropping it", () => {
    expect(() => InteractableManager.fromSpawns([{ type: "not-a-real-type", x: 0, z: 0 }])).toThrow();
  });

  it("canEnter is true for an empty tile and for a non-blocking entity", () => {
    const manager = InteractableManager.fromSpawns([{ type: "exit", x: 1, z: 1 }]);
    expect(manager.canEnter(0, 0)).toBe(true); // nothing here
    expect(manager.canEnter(1, 1)).toBe(true); // exit tile doesn't block
  });

  it("canEnter is false for a locked door, with a blocked message available", () => {
    const manager = InteractableManager.fromSpawns([{ type: "door", x: 1, z: 1, params: { keyId: "k" } }]);
    expect(manager.canEnter(1, 1)).toBe(false);
    expect(manager.blockedMessage(1, 1)).toBe("The door is locked.");
  });

  it("removes a consumed entity after handleEnter", () => {
    const manager = InteractableManager.fromSpawns([
      { type: "keyItem", x: 1, z: 1, params: { itemId: "k", name: "a key" } },
    ]);
    const inventory = new Inventory();

    const result = manager.handleEnter(1, 1, { inventory });

    expect(result.message).toBe("You found a key.");
    expect(result.isExit).toBe(false);
    expect(manager.at(1, 1)).toBeUndefined(); // collected and removed
  });

  it("reports isExit when the exit tile is entered", () => {
    const manager = InteractableManager.fromSpawns([{ type: "exit", x: 1, z: 1 }]);
    const result = manager.handleEnter(1, 1, { inventory: new Inventory() });
    expect(result.isExit).toBe(true);
  });

  it("handleEnter on an empty tile is a no-op", () => {
    const manager = InteractableManager.fromSpawns([]);
    const result = manager.handleEnter(0, 0, { inventory: new Inventory() });
    expect(result).toEqual({ isExit: false });
  });

  it("handleInteract on an empty tile returns undefined rather than a message", () => {
    const manager = InteractableManager.fromSpawns([]);
    const message = manager.handleInteract(0, 0, { inventory: new Inventory() });
    expect(message).toBeUndefined();
  });
});
