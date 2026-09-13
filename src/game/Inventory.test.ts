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

  it("adding the same item id twice stacks its count instead of duplicating a list entry", () => {
    const inventory = new Inventory();
    inventory.add("rusted-key", "a Rusted Key");
    inventory.add("rusted-key", "a Rusted Key");
    expect(inventory.list()).toEqual(["a Rusted Key x2"]);
  });

  it("a single item shows no count suffix", () => {
    const inventory = new Inventory();
    inventory.add("rusted-key", "a Rusted Key");
    expect(inventory.list()).toEqual(["a Rusted Key"]);
  });

  describe("consume", () => {
    it("removes one and returns true when available", () => {
      const inventory = new Inventory();
      inventory.add("antidote", "an Antidote", 2);
      expect(inventory.consume("antidote")).toBe(true);
      expect(inventory.list()).toEqual(["an Antidote"]); // 1 left, no "x1" suffix
    });

    it("returns false and changes nothing when none are left", () => {
      const inventory = new Inventory();
      inventory.add("antidote", "an Antidote", 1);
      inventory.consume("antidote");
      expect(inventory.consume("antidote")).toBe(false);
      expect(inventory.has("antidote")).toBe(false);
    });

    it("returns false for an item never added at all", () => {
      const inventory = new Inventory();
      expect(inventory.consume("nonexistent")).toBe(false);
    });
  });

  describe("entries", () => {
    it("lists only items with at least one remaining", () => {
      const inventory = new Inventory();
      inventory.add("antidote", "an Antidote", 2);
      inventory.add("bandages", "Bandages", 1);
      inventory.consume("bandages");

      expect(inventory.entries()).toEqual([{ id: "antidote", name: "an Antidote", count: 2 }]);
    });
  });
});
