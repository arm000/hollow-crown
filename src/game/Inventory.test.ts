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
      inventory.add("healing-tonic", "a Healing Tonic", 2);
      expect(inventory.consume("healing-tonic")).toBe(true);
      expect(inventory.list()).toEqual(["a Healing Tonic"]); // 1 left, no "x1" suffix
    });

    it("returns false and changes nothing when none are left", () => {
      const inventory = new Inventory();
      inventory.add("healing-tonic", "a Healing Tonic", 1);
      inventory.consume("healing-tonic");
      expect(inventory.consume("healing-tonic")).toBe(false);
      expect(inventory.has("healing-tonic")).toBe(false);
    });

    it("returns false for an item never added at all", () => {
      const inventory = new Inventory();
      expect(inventory.consume("nonexistent")).toBe(false);
    });
  });

  describe("entries", () => {
    it("lists only items with at least one remaining", () => {
      const inventory = new Inventory();
      inventory.add("healing-tonic", "a Healing Tonic", 2);
      inventory.add("smoke-bomb", "a Smoke Bomb", 1);
      inventory.consume("smoke-bomb");

      expect(inventory.entries()).toEqual([{ id: "healing-tonic", name: "a Healing Tonic", count: 2 }]);
    });
  });

  describe("unidentified items (docs/06-items-and-equipment.md#discovery-not-explanation's stretch tier)", () => {
    it("shows a mystery name instead of the true one for an unidentified consumable", () => {
      const inventory = new Inventory();
      inventory.add("antidote", "an Antidote");
      expect(inventory.list()).toEqual(["a cloudy green vial"]);
      expect(inventory.entries()).toEqual([{ id: "antidote", name: "a cloudy green vial", count: 1 }]);
    });

    it("reveals the true name from then on once identified", () => {
      const inventory = new Inventory();
      inventory.add("antidote", "an Antidote", 2);
      inventory.identify("antidote");
      expect(inventory.list()).toEqual(["an Antidote x2"]);
    });

    it("identifying one item id doesn't reveal any other unidentified item", () => {
      const inventory = new Inventory();
      inventory.add("antidote", "an Antidote");
      inventory.add("oil-flask", "an Oil Flask");
      inventory.identify("antidote");
      expect(inventory.list().sort()).toEqual(["a bubbling amber vial", "an Antidote"].sort());
    });

    it("leaves an ordinary item (never shipped unidentified) showing its real name from the start", () => {
      const inventory = new Inventory();
      inventory.add("rusted-key", "a Rusted Key");
      expect(inventory.list()).toEqual(["a Rusted Key"]);
    });
  });
});
