import { describe, expect, it } from "vitest";
import { LoreItem } from "./LoreItem";

describe("LoreItem", () => {
  it("never blocks movement", () => {
    const lore = new LoreItem(1, 1, "An old page.");
    expect(lore.blocksMovement()).toBe(false);
  });

  it("returns its text on interact", () => {
    const lore = new LoreItem(1, 1, "An old page.");
    expect(lore.interact()).toBe("An old page.");
  });

  it("can be read more than once (it's not consumed)", () => {
    const lore = new LoreItem(1, 1, "An old page.");
    lore.interact();
    expect(lore.interact()).toBe("An old page.");
  });
});
