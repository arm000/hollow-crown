import { describe, expect, it } from "vitest";
import { Inventory } from "../Inventory";
import { Party } from "../party/Party";
import { createCharacterFromSpec, createParty } from "../party/roster";
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
    const encounter = new RescueEncounter(1, 1, "Someone's here.");
    const result = encounter.interact(ctx);

    expect(ctx.party.members).toHaveLength(2);
    expect(ctx.party.members[1].name).toBe("Ysolde");
    expect(ctx.party.members[1].classId).toBe("rogue");
    expect(result).toContain("Someone's here.");
    expect(result).toContain("Ysolde joins your party!");
  });

  it("is consumed once someone joins, so its mesh/tile disappear (InteractableManager/Game.refreshEntityVisual)", () => {
    const ctx = ctxFor("warrior");
    const encounter = new RescueEncounter(1, 1, "line");
    expect(encounter.isConsumed()).toBe(false);
    encounter.interact(ctx);
    expect(encounter.isConsumed()).toBe(true);
  });

  it("is consumed once every companion has already been found, even with nobody new to recruit", () => {
    const ctx = ctxFor("warrior");
    new RescueEncounter(1, 1, "a").interact(ctx);
    new RescueEncounter(2, 2, "b").interact(ctx);
    new RescueEncounter(3, 3, "c").interact(ctx);
    expect(ctx.party.members).toHaveLength(4);

    const encounter = new RescueEncounter(4, 4, "d");
    encounter.interact(ctx);
    expect(encounter.isConsumed()).toBe(true);
  });

  it("is NOT consumed while the party is already at 4 but this companion isn't one of them yet -- still there to find, just not able to join", () => {
    // Contrived (shouldn't happen given the one-per-level-1-3 pacing),
    // but a party that reached 4 members some other way shouldn't make
    // a still-unmet companion's rescue tile silently vanish.
    const starter = createCharacterFromSpec({ name: "Solo", classId: "warrior", portrait: "🔴" });
    const stranger = () => createCharacterFromSpec({ name: "Stranger", classId: "warrior", portrait: "🔴" });
    const ctx: InteractionContext = {
      inventory: new Inventory(),
      party: new Party([starter, stranger(), stranger(), stranger()]),
    };

    const encounter = new RescueEncounter(1, 1, "line");
    const result = encounter.interact(ctx);

    expect(result).toContain("no room left");
    expect(encounter.isConsumed()).toBe(false);
    expect(ctx.party.members).toHaveLength(4);
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
