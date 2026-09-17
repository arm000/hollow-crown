import { describe, expect, it } from "vitest";
import { attemptMove, type WorldState } from "./GameLogic";
import { InteractableManager } from "./interactables/InteractableManager";
import { Inventory } from "./Inventory";
import { LEVEL_4_ENTITIES, LEVEL_4_MAP } from "./levels/level4";
import type { Party } from "./party/Party";
import { createParty, createStartingParty } from "./party/roster";
import { Player } from "./Player";
import { WorldClock } from "./WorldClock";

/**
 * A headless scripted playthrough of level 4's geometry — the boss
 * fight itself is `StewardMarrowEncounter.playthrough.test.ts`'s job;
 * this file only proves the arena's layout (docs/08-roadmap-phases.md
 * Phase 8's 10×10 resize): the entrance trap, the optional Reinforced
 * Kite Shield tucked in the open hall's far corner, and the real exit.
 * Monster-free, same choice every other geometry-focused playthrough
 * file here makes.
 */

function newWorld(party: Party = createStartingParty()): WorldState {
  const dungeon = LEVEL_4_MAP;
  const start = dungeon.findStart();
  const player = new Player(start.x, start.z, 1, 2, 1);
  return {
    player,
    dungeon,
    interactables: InteractableManager.fromSpawns(LEVEL_4_ENTITIES),
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

describe("Level 4 playthrough (headless)", () => {
  it("the entrance trap deals real damage and Fear without a Rogue along -- the descent's strongest, and the only one to also inflict Fear", () => {
    const world = newWorld(NO_ROGUE_PARTY());
    const bram = world.party.members[0];

    const trapStep = move(world, 1, 0); // (1,1) -> (2,1)

    expect(trapStep.message).toContain("blade swings down from the rafters");
    expect(bram.hp).toBeLessThan(bram.maxHp);
    expect(bram.statusEffects.has("fear")).toBe(true);
  });

  it("a living Rogue disarms the entrance trap outright, same as every trap in the descent", () => {
    const world = newWorld(); // default roster includes Ysolde the Rogue
    const bram = world.party.members[0];

    const trapStep = move(world, 1, 0); // (1,1) -> (2,1)

    expect(trapStep.message).toContain("Ysolde");
    expect(bram.hp).toBe(bram.maxHp);
  });

  it("the open hall's far corner holds the Reinforced Kite Shield, reachable without a lock or a puzzle in the way", () => {
    const world = newWorld();

    for (let step = 0; step < 6; step++) {
      expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (7,1)
    }
    for (let step = 0; step < 5; step++) {
      expect(move(world, 0, 1).moved).toBe(true); // (7,1) -> (7,6)
    }
    const findShield = move(world, 1, 0); // (7,6) -> (8,6)
    expect(findShield.moved).toBe(true);
    expect(world.inventory.has("reinforced-kite-shield")).toBe(true);
  });

  it("the real exit sits well clear of the shield's corner, reachable on its own", () => {
    const world = newWorld();

    for (let step = 0; step < 6; step++) {
      expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (7,1)
    }
    for (let step = 0; step < 3; step++) {
      expect(move(world, 0, 1).moved).toBe(true); // (7,1) -> (7,4)
    }

    const winningMove = move(world, 0, 1); // (7,4) -> (7,5): the exit
    expect(winningMove.moved).toBe(true);
    expect(winningMove.won).toBe(true);
  });
});
