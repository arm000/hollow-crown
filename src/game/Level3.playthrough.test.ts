import { describe, expect, it } from "vitest";
import { attemptInteract, attemptMove, type WorldState } from "./GameLogic";
import { InteractableManager } from "./interactables/InteractableManager";
import { Inventory } from "./Inventory";
import { LEVEL_3_ENTITIES, LEVEL_3_MAP } from "./levels/level3";
import type { Party } from "./party/Party";
import { createParty, createStartingParty } from "./party/roster";
import { Player } from "./Player";
import { WorldClock } from "./WorldClock";

/**
 * A headless scripted playthrough of level 3 — same idea as
 * `StartingLevel.playthrough.test.ts`/`Level2.playthrough.test.ts`, for
 * the level carrying the gauntlet corridor's two optional side alcoves
 * (a defensive breather, and a second, shorter rune-sequence puzzle).
 * Monster-free by design, same choice every other geometry-focused
 * playthrough file here makes — `FullCampaign.playthrough.test.ts`
 * exercises the three mandatory fights with real combat.
 */

function newWorld(party: Party = createStartingParty()): WorldState {
  const dungeon = LEVEL_3_MAP;
  const start = dungeon.findStart();
  const player = new Player(start.x, start.z, 1, 2, 1);
  return {
    player,
    dungeon,
    interactables: InteractableManager.fromSpawns(LEVEL_3_ENTITIES),
    inventory: new Inventory(),
    party,
    worldClock: new WorldClock(),
    monsters: [],
  };
}

const NO_ROGUE_PARTY = () =>
  createParty([
    { name: "Bram", classId: "warrior", portrait: "🔴" },
    { name: "Corvin", classId: "mage", portrait: "🔵" },
    { name: "Maren", classId: "cleric", portrait: "🟢" },
  ]);

function move(world: WorldState, dx: number, dz: number) {
  const outcome = attemptMove(world, dx, dz);
  world.player.update(10);
  return outcome;
}

describe("Level 3 playthrough (headless)", () => {
  it("can be solved: the whole gauntlet corridor is walkable start to finish, no key required", () => {
    const world = newWorld();

    for (let step = 0; step < 6; step++) {
      expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (7,1)
    }
    expect(world.inventory.has("holy-water")).toBe(true); // picked up along the way, unmissable

    const descendingMove = move(world, 1, 0); // (7,1) -> (8,1): the stairs down
    expect(descendingMove.moved).toBe(true);
    expect(descendingMove.levelTransition).toBe("level-4");
  });

  describe("both traps deal real damage/status without a Rogue along", () => {
    it("trap 1 is a heavier plain physical hit than anything earlier in the descent", () => {
      const world = newWorld(NO_ROGUE_PARTY());
      const bram = world.party.members[0];

      const trapStep = move(world, 1, 0); // (1,1) -> (2,1)

      expect(trapStep.message).toContain("weighted dart");
      expect(bram.hp).toBeLessThan(bram.maxHp);
    });

    it("trap 2 also inflicts Bleed", () => {
      const world = newWorld(NO_ROGUE_PARTY());
      const bram = world.party.members[0];
      move(world, 1, 0); // (1,1) -> (2,1): trap 1
      move(world, 1, 0); // (2,1) -> (3,1)
      move(world, 1, 0); // (3,1) -> (4,1): Holy Water

      const trapStep = move(world, 1, 0); // (4,1) -> (5,1): trap 2

      expect(trapStep.message).toContain("hooked barb");
      expect(bram.statusEffects.has("bleed")).toBe(true);
    });
  });

  it("the hardened-leather alcove: lore, a rescue, then the armor itself", () => {
    const world = newWorld();

    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1)
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1): the alcove's entrance
    expect(move(world, 0, 1).moved).toBe(true); // (3,1) -> (3,2): lore
    const readLore = attemptInteract(world);
    expect(readLore.message).toContain("Claw marks");
    expect(move(world, 0, 1).moved).toBe(true); // (3,2) -> (3,3): the rescue
    expect(move(world, 0, 1).moved).toBe(true); // (3,3) -> (3,4): Hardened Leather
    expect(world.inventory.has("hardened-leather")).toBe(true);
  });

  it("the crown-shard rune sequence: wrong order resets it, the lore item's actual order opens the vault", () => {
    const world = newWorld();
    for (const [dx, dz] of [
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
    ]) {
      expect(move(world, dx, dz).moved).toBe(true);
    }
    // Now at (6,1), the rune spur's entrance.

    expect(move(world, 0, 1).moved).toBe(true); // (6,1) -> (6,2): the lore clue
    const readClue = attemptInteract(world);
    expect(readClue.message).toContain("the near ward first, then the deeper one");

    expect(move(world, 0, 1).moved).toBe(true); // (6,2) -> (6,3): the hub

    // Wrong order first: south (the deeper ward, order 1) before west
    // (the near ward, order 0) -- resets the group.
    const wrongRune = move(world, 0, 1); // (6,3) -> (6,4)
    expect(wrongRune.message).toBe("Wrong rune — every light in the sequence gutters out at once.");
    expect(move(world, 0, -1).moved).toBe(true); // back to (6,3)

    expect(move(world, -1, 0).message).toBe("The rune glows and holds."); // (6,3) -> (5,3): the near ward
    expect(move(world, 1, 0).moved).toBe(true); // back to (6,3)
    const finalRune = move(world, 0, 1); // (6,3) -> (6,4): the deeper ward
    expect(finalRune.message).toContain("flares bright");

    expect(move(world, 0, 1).moved).toBe(true); // (6,4) -> (6,5): the vault door, now unlocked
    expect(world.inventory.has("crown-shard-pendant")).toBe(false);
    expect(move(world, 0, 1).moved).toBe(true); // (6,5) -> (6,6): the Crown Shard Pendant
    expect(world.inventory.has("crown-shard-pendant")).toBe(true);
  });
});
