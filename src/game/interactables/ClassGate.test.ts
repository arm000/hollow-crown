import { describe, expect, it } from "vitest";
import { Inventory } from "../Inventory";
import { Character } from "../party/Character";
import { Party } from "../party/Party";
import { ClassGate } from "./ClassGate";
import type { InteractionContext } from "./types";

function newCtx(members: Character[]): InteractionContext {
  return { inventory: new Inventory(), party: new Party(members) };
}

function newRogue(): Character {
  return new Character("Ysolde", "rogue", "front", { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 5 }, 22, 0);
}

function newWarrior(): Character {
  return new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
}

function newGate(): ClassGate {
  return new ClassGate(1, 1, "rogue", "The lock resists.", "{name} picks the lock open.");
}

describe("ClassGate", () => {
  it("blocks movement until opened", () => {
    expect(newGate().blocksMovement()).toBe(true);
  });

  it("refuses to open without the required class present", () => {
    const gate = newGate();
    const message = gate.interact(newCtx([newWarrior()]));
    expect(message).toBe("The lock resists.");
    expect(gate.blocksMovement()).toBe(true);
  });

  it("opens once a living member of the required class interacts, crediting them by name", () => {
    const gate = newGate();
    const message = gate.interact(newCtx([newWarrior(), newRogue()]));
    expect(message).toBe("Ysolde picks the lock open.");
    expect(gate.blocksMovement()).toBe(false);
  });

  it("ignores a downed member of the required class", () => {
    const gate = newGate();
    const rogue = newRogue();
    rogue.takeDamage(9999);
    const message = gate.interact(newCtx([rogue]));
    expect(message).toBe("The lock resists.");
    expect(gate.blocksMovement()).toBe(true);
  });

  it("stays open and returns a neutral message on a second interact", () => {
    const gate = newGate();
    gate.interact(newCtx([newRogue()]));
    expect(gate.interact(newCtx([newRogue()]))).toBe("The way is already open.");
  });
});
