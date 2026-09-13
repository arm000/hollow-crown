import { describe, expect, it } from "vitest";
import { NpcEncounter } from "./NpcEncounter";

describe("NpcEncounter", () => {
  it("never blocks movement", () => {
    expect(new NpcEncounter(1, 1, "A Steward", "Hello.").blocksMovement()).toBe(false);
  });

  it("interact returns the name and line together", () => {
    const npc = new NpcEncounter(1, 1, "A Steward", "The masters will be down for supper.");
    expect(npc.interact()).toBe('A Steward: "The masters will be down for supper."');
  });

  it("is freely re-readable, unlike a one-time pickup", () => {
    const npc = new NpcEncounter(1, 1, "A Steward", "Still here.");
    expect(npc.interact()).toBe(npc.interact());
  });
});
