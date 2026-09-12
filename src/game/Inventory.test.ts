import { describe, expect, it } from "vitest";
import { Inventory } from "./Inventory";

describe("Inventory", () => {
  it("does not have an item until it's added", () => {
    const inventory = new Inventory();
    expect(inventory.has("rusted-key")).toBe(false);
  });

  it("has an item once added", () => {
    const inventory = new Inventory();
    inventory.add("rusted-key", "a Rusted Key");
    expect(inventory.has("rusted-key")).toBe(true);
  });

  it("lists display names in collection order", () => {
    const inventory = new Inventory();
    inventory.add("rusted-key", "a Rusted Key");
    inventory.add("brass-key", "a Brass Key");
    expect(inventory.list()).toEqual(["a Rusted Key", "a Brass Key"]);
  });

  it("falls back to the item id as its display name", () => {
    const inventory = new Inventory();
    inventory.add("rusted-key");
    expect(inventory.list()).toEqual(["rusted-key"]);
  });

  it("adding the same item id twice does not duplicate it in the list", () => {
    const inventory = new Inventory();
    inventory.add("rusted-key", "a Rusted Key");
    inventory.add("rusted-key", "a Rusted Key");
    expect(inventory.list()).toEqual(["a Rusted Key"]);
  });
});
