import { describe, expect, it } from "vitest";
import { Inventory } from "../Inventory";
import { Party } from "../party/Party";
import { KeyItem } from "./KeyItem";

describe("KeyItem", () => {
  it("never blocks movement", () => {
    const key = new KeyItem(1, 1, "rusted-key", "a Rusted Key");
    expect(key.blocksMovement()).toBe(false);
  });

  it("adds itself to the inventory and reports itself consumed once entered", () => {
    const key = new KeyItem(1, 1, "rusted-key", "a Rusted Key");
    const inventory = new Inventory();

    const message = key.onEnter({ inventory, party: new Party([]) });

    expect(inventory.has("rusted-key")).toBe(true);
    expect(message).toBe("You found a Rusted Key.");
    expect(key.isConsumed()).toBe(true);
  });

  it("is not consumed before it's been entered", () => {
    const key = new KeyItem(1, 1, "rusted-key", "a Rusted Key");
    expect(key.isConsumed()).toBe(false);
  });

  it("does nothing on a second onEnter (already collected)", () => {
    const key = new KeyItem(1, 1, "rusted-key", "a Rusted Key");
    const inventory = new Inventory();
    key.onEnter({ inventory, party: new Party([]) });

    const message = key.onEnter({ inventory, party: new Party([]) });

    expect(message).toBeUndefined();
  });
});
