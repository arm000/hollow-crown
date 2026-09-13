import { describe, expect, it } from "vitest";
import { Inventory } from "../Inventory";
import { Character } from "../party/Character";
import { Party } from "../party/Party";
import { SecretWall } from "./SecretWall";
import type { InteractionContext } from "./types";

function newCtx(members: Character[] = []): InteractionContext {
  return { inventory: new Inventory(), party: new Party(members) };
}

describe("SecretWall", () => {
  it("blocks movement while hidden", () => {
    const wall = new SecretWall(1, 1);
    expect(wall.blocksMovement()).toBe(true);
  });

  it("stops blocking movement once found", () => {
    const wall = new SecretWall(1, 1);
    wall.interact(newCtx());
    expect(wall.blocksMovement()).toBe(false);
  });

  it("returns a discovery message the first time, a neutral one after", () => {
    const wall = new SecretWall(1, 1);
    expect(wall.interact(newCtx())).toBe("You find a hidden passage!");
    expect(wall.interact(newCtx())).not.toBe("You find a hidden passage!");
  });

  it("awards XP to the party on first discovery only", () => {
    const bram = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
    const wall = new SecretWall(1, 1);

    wall.interact(newCtx([bram]));
    expect(bram.xp).toBeGreaterThan(0);

    const xpAfterFirstFind = bram.xp;
    wall.interact(newCtx([bram]));
    expect(bram.xp).toBe(xpAfterFirstFind); // re-searching an already-found wall grants nothing more
  });
});
