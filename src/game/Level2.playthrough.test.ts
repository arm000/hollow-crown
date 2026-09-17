import { describe, expect, it } from "vitest";
import { attemptInteract, attemptMove, type WorldState } from "./GameLogic";
import { InteractableManager } from "./interactables/InteractableManager";
import { Inventory } from "./Inventory";
import { LEVEL_2_ENTITIES, LEVEL_2_MAP } from "./levels/level2";
import type { Party } from "./party/Party";
import { createParty, createStartingParty } from "./party/roster";
import { Player } from "./Player";
import { WorldClock } from "./WorldClock";

/**
 * A headless scripted playthrough of level 2 — the same idea as
 * `StartingLevel.playthrough.test.ts`, but for the level that carries
 * this descent's showcase "innovative puzzle" (docs/08-roadmap-phases.md
 * Phase 8): three unmarked floor runes that only unlock their vault when
 * trodden in the order a nearby lore item actually spells out, wrong
 * guesses resetting the whole sequence. Monster-free, same choice
 * `StartingLevel.playthrough.test.ts` makes for level 1 — the fights
 * here are real content (`FullCampaign.playthrough.test.ts` exercises
 * them with actual combat), but this file's job is proving the geometry
 * and puzzle wiring, not re-proving `CombatEngine`.
 */

function newWorld(party: Party = createStartingParty()): WorldState {
  const dungeon = LEVEL_2_MAP;
  const start = dungeon.findStart();
  const player = new Player(start.x, start.z, 1, 2, 1);
  return {
    player,
    dungeon,
    interactables: InteractableManager.fromSpawns(LEVEL_2_ENTITIES),
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

describe("Level 2 playthrough (headless)", () => {
  it("can be solved: dodge both traps, fetch the key, unlock the door, reach the stairs down to level 3", () => {
    const world = newWorld();

    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1): trap 1, disarmed
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1): the Old Buckler
    expect(world.inventory.has("old-buckler")).toBe(true);
    expect(move(world, 0, 1).moved).toBe(true); // (3,1) -> (3,2): the key
    expect(world.inventory.has("iron-key")).toBe(true);
    expect(move(world, 0, -1).moved).toBe(true); // back to (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1): trap 2, disarmed
    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1)
    expect(move(world, 1, 0).moved).toBe(true); // (5,1) -> (6,1)

    expect(move(world, 1, 0).moved).toBe(false); // the locked door still blocks a plain step

    const unlock = attemptInteract(world);
    expect(unlock.message).toBe("You unlock the door.");
    expect(move(world, 1, 0).moved).toBe(true); // (6,1) -> (7,1), now open

    const descendingMove = move(world, 1, 0); // (7,1) -> (8,1): the stairs down
    expect(descendingMove.moved).toBe(true);
    expect(descendingMove.levelTransition).toBe("level-3");
  });

  describe("both traps deal real damage/status without a Rogue along, a step up from level 1's single gentle one", () => {
    it("trap 1 is a plain physical hit", () => {
      const world = newWorld(NO_ROGUE_PARTY());
      const bram = world.party.members[0];

      const trapStep = move(world, 1, 0); // (1,1) -> (2,1)

      expect(trapStep.message).toContain("dart snaps out of the floor seam");
      expect(bram.hp).toBeLessThan(bram.maxHp);
    });

    it("trap 2 also inflicts Poison", () => {
      const world = newWorld(NO_ROGUE_PARTY());
      const bram = world.party.members[0];
      move(world, 1, 0); // (1,1) -> (2,1): trap 1
      move(world, 1, 0); // (2,1) -> (3,1): the buckler

      const trapStep = move(world, 1, 0); // (3,1) -> (4,1): trap 2

      expect(trapStep.message).toContain("grazes past");
      expect(bram.statusEffects.has("poison")).toBe(true);
    });
  });

  it("the rune sequence: wrong order resets it, the lore item's actual order opens the vault", () => {
    const world = newWorld();
    for (const [dx, dz] of [
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
    ]) {
      expect(move(world, dx, dz).moved).toBe(true);
    }
    // Now at (5,1), the rune spur's entrance.

    expect(move(world, 0, 1).moved).toBe(true); // (5,1) -> (5,2): the lore clue
    const readClue = attemptInteract(world);
    expect(readClue.message).toContain("sun first, then the hound, then let the hearth");

    expect(move(world, 0, 1).moved).toBe(true); // (5,2) -> (5,3): rescue
    expect(move(world, 0, 1).moved).toBe(true); // (5,3) -> (5,4): the hub, adjacent to all three runes

    // Wrong order first: west (the hound, order 1) before east (the sun,
    // order 0) -- resets the whole group back to 0.
    const wrongRune = move(world, -1, 0); // (5,4) -> (4,4)
    expect(wrongRune.message).toBe("Wrong rune — every light in the sequence gutters out at once.");
    expect(move(world, 1, 0).moved).toBe(true); // back to (5,4)

    // The actual order: sun (east) -> hound (west) -> hearth (south).
    expect(move(world, 1, 0).message).toBe("The rune glows and holds."); // (5,4) -> (6,4): sun
    expect(move(world, -1, 0).moved).toBe(true); // back to (5,4)
    expect(move(world, -1, 0).message).toBe("The rune glows and holds."); // (5,4) -> (4,4): hound
    expect(move(world, 1, 0).moved).toBe(true); // back to (5,4)
    const finalRune = move(world, 0, 1); // (5,4) -> (5,5): hearth
    expect(finalRune.message).toContain("flares bright");

    expect(move(world, 0, 1).moved).toBe(true); // (5,5) -> (5,6): the vault door, now unlocked
    expect(world.inventory.has("steel-cuirass")).toBe(false);
    expect(move(world, 0, 1).moved).toBe(true); // (5,6) -> (5,7): the Steel Cuirass
    expect(world.inventory.has("steel-cuirass")).toBe(true);
  });

  it("the Cinder Wretch's side spur holds an Ember Charm, two tiles down and off the main corridor", () => {
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
    // Now at (6,1), the Cinder Wretch spur's entrance.
    expect(move(world, 0, 1).moved).toBe(true); // (6,1) -> (6,2)
    expect(move(world, 0, 1).moved).toBe(true); // (6,2) -> (6,3)
    expect(move(world, 1, 0).moved).toBe(true); // (6,3) -> (7,3): the Ember Charm
    expect(world.inventory.has("ember-charm")).toBe(true);
  });
});
