import { describe, expect, it } from "vitest";
import { Inventory } from "../Inventory";
import { createParty } from "../party/roster";
import type { InteractionContext } from "./types";
import { RescueEncounter } from "./RescueEncounter";

function ctxFor(startingClass: "warrior" | "rogue" | "mage" | "cleric"): InteractionContext {
  return {
    inventory: new Inventory(),
    party: createParty([{ name: "Solo", classId: startingClass, portrait: "🔴" }]),
  };
}

describe("RescueEncounter", () => {
  it("never blocks movement", () => {
    expect(new RescueEncounter(1, 1, "A figure waits.").blocksMovement()).toBe(false);
  });

  it("recruits the first companion the starting class doesn't already cover", () => {
    const ctx = ctxFor("warrior");
    const result = new RescueEncounter(1, 1, "Someone's here.").interact(ctx);

    expect(ctx.party.members).toHaveLength(2);
    expect(ctx.party.members[1].name).toBe("Ysolde");
    expect(ctx.party.members[1].classId).toBe("rogue");
    expect(result).toContain("Someone's here.");
    expect(result).toContain("Ysolde joins your party!");
  });

  it("offers a different companion depending on the starting class", () => {
    const ctx = ctxFor("cleric");
    new RescueEncounter(1, 1, "line").interact(ctx);
    expect(ctx.party.members[1].name).toBe("Bram");
  });

  it("skips a companion already recruited by an earlier RescueEncounter", () => {
    const ctx = ctxFor("warrior");
    new RescueEncounter(1, 1, "first").interact(ctx); // recruits Ysolde
    new RescueEncounter(2, 2, "second").interact(ctx);
    expect(ctx.party.members.map((m) => m.name)).toEqual(["Solo", "Ysolde", "Corvin"]);
  });

  it("is idempotent -- interacting again with the same encounter doesn't recruit twice", () => {
    const ctx = ctxFor("warrior");
    const encounter = new RescueEncounter(1, 1, "line");
    encounter.interact(ctx);
    const again = encounter.interact(ctx);

    expect(ctx.party.members).toHaveLength(2);
    expect(again).toBe("Ysolde is already at your side.");
  });

  it("says so, instead of crashing, once every companion has already been found", () => {
    const ctx = ctxFor("warrior");
    new RescueEncounter(1, 1, "a").interact(ctx);
    new RescueEncounter(2, 2, "b").interact(ctx);
    new RescueEncounter(3, 3, "c").interact(ctx);
    expect(ctx.party.members).toHaveLength(4);

    const result = new RescueEncounter(4, 4, "d").interact(ctx);
    expect(result).toContain("no one left down here to find");
    expect(ctx.party.members).toHaveLength(4);
  });
});
