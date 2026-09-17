import { describe, expect, it } from "vitest";
import { Inventory } from "../Inventory";
import { Character } from "../party/Character";
import { EQUIPMENT_ITEMS } from "../party/Equipment";
import { Party } from "../party/Party";
import { Trap } from "./Trap";
import type { InteractionContext } from "./types";

function newCtx(members: Character[]): InteractionContext {
  return { inventory: new Inventory(), party: new Party(members) };
}

function newWarrior(): Character {
  return new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
}

function newMage(): Character {
  return new Character("Corvin", "mage", "back", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 14, 20);
}

function newRogue(): Character {
  return new Character("Ysolde", "rogue", "front", { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 5 }, 22, 0);
}

function newTrap(): Trap {
  return new Trap(1, 1, "physical", 5, "A dart springs from a hidden slot in the wall!");
}

describe("Trap", () => {
  it("never blocks movement -- it's invisible until it fires", () => {
    expect(newTrap().blocksMovement()).toBe(false);
  });

  it("damages the front-rank target on first entry, resistance-adjusted", () => {
    const trap = newTrap();
    const bram = newWarrior();
    const message = trap.onEnter(newCtx([bram]));

    expect(bram.hp).toBe(25); // 30 - 5, no resistance
    expect(message).toContain("A dart springs");
    expect(message).toContain("Bram takes 5 damage — 25/30 HP left.");
  });

  it("prefers the front rank over the back rank", () => {
    const trap = newTrap();
    const bram = newWarrior();
    const corvin = newMage();
    trap.onEnter(newCtx([corvin, bram])); // Corvin listed first, but Bram is front rank

    expect(bram.hp).toBeLessThan(30);
    expect(corvin.hp).toBe(14);
  });

  it("falls back to any living member if the front rank has already fallen", () => {
    const trap = newTrap();
    const bram = newWarrior();
    bram.takeDamage(9999);
    const corvin = newMage();
    trap.onEnter(newCtx([bram, corvin]));

    expect(corvin.hp).toBeLessThan(14);
  });

  it("only fires once -- re-entering an already-sprung trap does nothing", () => {
    const trap = newTrap();
    const bram = newWarrior();
    trap.onEnter(newCtx([bram]));
    const hpAfterFirst = bram.hp;

    expect(trap.onEnter(newCtx([bram]))).toBeUndefined();
    expect(bram.hp).toBe(hpAfterFirst);
  });

  it("applies its resistance/statusEffect through effectiveResistances, so armor found earlier actually matters here too", () => {
    const trap = new Trap(1, 1, "physical", 10, "The floor gives way beneath spikes!");
    const bram = newWarrior();
    bram.equip(EQUIPMENT_ITEMS["hardened-leather"]); // physical resistance ×0.9

    trap.onEnter(newCtx([bram]));

    expect(bram.hp).toBe(21); // 30 - round(10 * 0.9) = 30 - 9
  });

  it("can also apply a status effect alongside damage", () => {
    const trap = new Trap(1, 1, "blight", 3, "A cloud of fine, bitter dust bursts from the tile!", {
      type: "poison",
      turnsRemaining: 3,
      tickDamage: 2,
    });
    const bram = newWarrior();

    const message = trap.onEnter(newCtx([bram]));

    expect(bram.statusEffects.has("poison")).toBe(true);
    expect(message).toContain("Bram is afflicted with poison!");
  });

  it("a living Rogue disarms it automatically -- docs/03-party-and-characters.md's \"handles ... trap disarm out of combat\", deterministically, not a roll", () => {
    const trap = newTrap();
    const bram = newWarrior();
    const ysolde = newRogue();

    const message = trap.onEnter(newCtx([bram, ysolde]));

    expect(message).toBe("Ysolde spots the mechanism a heartbeat before it triggers and disarms it.");
    expect(bram.hp).toBe(30); // untouched
  });

  it("a downed Rogue doesn't count -- can't disarm anything from the floor", () => {
    const trap = newTrap();
    const bram = newWarrior();
    const ysolde = newRogue();
    ysolde.takeDamage(9999);

    trap.onEnter(newCtx([bram, ysolde]));

    expect(bram.hp).toBeLessThan(30);
  });

  it("a Rogue disarms it only once -- the trap is already spent either way after the first entry", () => {
    const trap = newTrap();
    const ysolde = newRogue();
    trap.onEnter(newCtx([ysolde]));

    expect(trap.onEnter(newCtx([ysolde]))).toBeUndefined();
  });
});
