import { describe, expect, it } from "vitest";
import { STARTING_LEVEL } from "./DungeonMap";
import { attemptInteract, attemptMove, type WorldState } from "./GameLogic";
import { InteractableManager } from "./interactables/InteractableManager";
import { Inventory } from "./Inventory";
import { STARTING_LEVEL_ENTITIES } from "./Level";
import { Monster } from "./monster/Monster";
import type { Party } from "./party/Party";
import { createParty, createStartingParty } from "./party/roster";
import { Player } from "./Player";
import { WorldClock } from "./WorldClock";

/**
 * A headless scripted playthrough of the starting level — the automated
 * form of Phase 1's "Playable when" gate
 * (docs/08-roadmap-phases.md#phase-1--world-interaction--objective):
 * drives the exact same `attemptMove`/`attemptInteract` functions
 * `Game` calls, with no rendering involved at all, and checks that the
 * puzzle is actually required to win — not just that some sequence of
 * actions happens to win.
 *
 * Level 1 is exactly 10×10 (docs/08-roadmap-phases.md Phase 8, on a
 * player request that "each dungeon level should be 10x10"); see
 * `DungeonMap.ts`/`Level.ts` for the map/entity data these scripts walk.
 *
 * This predates the monster/combat system, so the monster here is a
 * harmless bystander (zero detection radius, tucked in a dead end)
 * rather than a real part of these scripts — see
 * `RotThingEncounter.playthrough.test.ts` for a real encounter.
 */

function newWorld(party: Party = createStartingParty()): WorldState {
  const dungeon = STARTING_LEVEL;
  const start = dungeon.findStart();
  const player = new Player(start.x, start.z, 1, 2, 1);
  const worldClock = new WorldClock();
  const monster = new Monster(
    { name: "Rot-thing", x: 8, z: 8, patrolPoints: [{ x: 8, z: 8 }], detectionRadius: 0, maxHp: 18, might: 3, initiativeStat: 3 },
    dungeon,
    player,
  );
  worldClock.register(monster);

  return {
    player,
    dungeon,
    interactables: InteractableManager.fromSpawns(STARTING_LEVEL_ENTITIES),
    inventory: new Inventory(),
    party,
    worldClock,
    monsters: [monster],
  };
}

/** Attempts a move and instantly finishes its animation, so the next scripted action isn't refused as "still animating". */
function move(world: WorldState, dx: number, dz: number) {
  const outcome = attemptMove(world, dx, dz);
  world.player.update(10);
  return outcome;
}

/** Turns and instantly finishes the animation, same idea as `move` — needed whenever the faced tile (not the one underfoot) would otherwise intercept an interact meant for something the party is standing on. */
function turn(world: WorldState, direction: 1 | -1) {
  world.player.turn(direction);
  world.player.update(10);
}

const NO_ROGUE_PARTY = () =>
  createParty([
    { name: "Bram", classId: "warrior", portrait: "🔴" },
    { name: "Corvin", classId: "mage", portrait: "🔵" },
    { name: "Maren", classId: "cleric", portrait: "🟢" },
  ]);

describe("Starting level playthrough (headless)", () => {
  it("can be solved: dodge the trap, fetch the key, unlock the door, reach the stairs down to level 2", () => {
    // Since docs/08-roadmap-phases.md Phase 4, level 1's own exit tile
    // moves the party on to the next level rather than ending the run --
    // see levels/index.test.ts for the multi-level descent as a whole,
    // and levels/level3.ts for where the real, run-ending exit now lives.
    const world = newWorld();

    const trapStep = move(world, 1, 0); // (1,1) -> (2,1): the trap -- disarmed outright, the default roster includes Ysolde the Rogue
    expect(trapStep.moved).toBe(true);
    expect(trapStep.message).toContain("Ysolde");
    expect(trapStep.message).toContain("disarms it");

    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1)
    expect(move(world, 0, 1).moved).toBe(true); // (3,1) -> (3,2): the key's side room
    expect(world.inventory.has("rusted-key")).toBe(true);

    expect(move(world, 0, -1).moved).toBe(true); // back to (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1): the Oil Flask
    expect(world.inventory.has("oil-flask")).toBe(true);
    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1)
    expect(move(world, 1, 0).moved).toBe(true); // (5,1) -> (6,1), facing the door at (7,1)

    expect(move(world, 1, 0).moved).toBe(false); // the locked door still blocks a plain step

    const unlock = attemptInteract(world);
    expect(unlock.message).toBe("You unlock the door.");

    expect(move(world, 1, 0).moved).toBe(true); // (6,1) -> (7,1), now open

    const descendingMove = move(world, 1, 0); // (7,1) -> (8,1): the stairs down
    expect(descendingMove.moved).toBe(true);
    expect(descendingMove.won).toBe(false); // level 1 alone doesn't end the run anymore
    expect(descendingMove.levelTransition).toBe("level-2");
  });

  it("cannot win by skipping the key: the locked door is a real gate, not a suggestion", () => {
    const world = newWorld();

    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1): the trap, disarmed
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1) -- skips the side room entirely
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1)
    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1)
    expect(move(world, 1, 0).moved).toBe(true); // (5,1) -> (6,1)
    expect(world.inventory.has("rusted-key")).toBe(false);

    expect(move(world, 1, 0).moved).toBe(false); // door blocks the only path onward

    const interactWithoutKey = attemptInteract(world);
    expect(interactWithoutKey.message).toBe("The door is locked.");
    expect(move(world, 1, 0).moved).toBe(false); // still blocked after a failed interact

    expect(world.player.gridX).toBe(6);
    expect(world.player.gridZ).toBe(1);
  });

  describe("the dart trap (docs/08-roadmap-phases.md Phase 8, player request: \"increasingly difficult monsters and traps\")", () => {
    it("fires and deals damage to a party with no Rogue along", () => {
      const world = newWorld(NO_ROGUE_PARTY());
      const bram = world.party.members[0];
      const hpBefore = bram.hp;

      const trapStep = move(world, 1, 0); // (1,1) -> (2,1)

      expect(trapStep.moved).toBe(true);
      expect(trapStep.message).toContain("A dart springs");
      expect(bram.hp).toBeLessThan(hpBefore);
    });

    it("only fires once -- stepping back over it a second time does nothing more", () => {
      const world = newWorld(NO_ROGUE_PARTY());
      move(world, 1, 0); // (1,1) -> (2,1): fires
      const bram = world.party.members[0];
      const hpAfterFirst = bram.hp;

      expect(move(world, -1, 0).moved).toBe(true); // back to (1,1)
      expect(move(world, 1, 0).message).toBeUndefined(); // re-entering (2,1) -- already sprung
      expect(bram.hp).toBe(hpAfterFirst);
    });

    it("a living Rogue in the party disarms it outright, every time -- docs/03-party-and-characters.md's \"handles ... trap disarm out of combat\"", () => {
      const world = newWorld(); // default roster includes Ysolde the Rogue
      const bram = world.party.members[0];

      const trapStep = move(world, 1, 0); // (1,1) -> (2,1)

      expect(trapStep.message).toBe("Ysolde spots the mechanism a heartbeat before it triggers and disarms it.");
      expect(bram.hp).toBe(bram.maxHp); // untouched
    });
  });

  it("pushing the block reveals its own hidden pocket, and still arms the shared bonus door via the plate", () => {
    const world = newWorld();

    for (const [dx, dz] of [
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
    ]) {
      expect(move(world, dx, dz).moved).toBe(true);
    }
    // Now at (5,1), the block spur's entrance.

    expect(move(world, 0, 1).moved).toBe(true); // (5,1) -> (5,2): rescue
    expect(move(world, 0, 1).moved).toBe(true); // (5,2) -> (5,3): the Rusted Sword
    expect(world.inventory.has("rusted-sword")).toBe(true);

    const push = move(world, 0, 1); // (5,3) -> (5,4): pushes the block ahead of it onto the plate
    expect(push.moved).toBe(true);
    expect(push.pushedBlock).toEqual({ from: { x: 5, z: 4 }, to: { x: 5, z: 5 } });

    // (4, 4) was never reachable before -- the block itself sat on the
    // only tile leading to it. Regression coverage for a player report
    // that an earlier cut of this puzzle gave nothing back for the
    // trouble beyond a door a lever already opened.
    expect(world.inventory.has("tarnished-talisman")).toBe(false);
    const findPocket = move(world, -1, 0); // (5,4) -> (4,4): the hidden pocket, only standable now
    expect(findPocket.moved).toBe(true);
    expect(world.inventory.has("tarnished-talisman")).toBe(true);
    expect(move(world, 1, 0).moved).toBe(true); // (4,4) -> (5,4)

    // Open via the plate alone, straight through -- the lever was never touched in this test.
    expect(move(world, 1, 0).moved).toBe(true); // (5,4) -> (6,4)
    expect(move(world, 0, 1).moved).toBe(true); // (6,4) -> (6,5): the bonus door, already unlocked
  });

  it("the lever unlocks the same bonus door, with a lore alcove and a secret wall beyond it", () => {
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
    // Now at (6,1), the lever spur's entrance.

    expect(move(world, 0, 1).moved).toBe(true); // (6,1) -> (6,2): npc
    expect(move(world, 0, 1).moved).toBe(true); // (6,2) -> (6,3): the Antidote
    expect(world.inventory.has("antidote")).toBe(true);
    expect(move(world, 0, 1).moved).toBe(true); // (6,3) -> (6,4): the lever's tile

    expect(move(world, 0, 1).moved).toBe(false); // the bonus door is still locked

    // The lever sits underfoot, not on an adjacent tile -- face away from
    // the class-gated passage (east, see the next test) so the faced-tile
    // check doesn't intercept the interact before it ever reaches "here".
    turn(world, 1);
    turn(world, 1); // east -> south -> west, toward the pushable block (which has no interact() of its own)
    const pullLever = attemptInteract(world);
    expect(pullLever.message).toBe("You pull the lever. Something unlocks nearby.");

    expect(move(world, 0, 1).moved).toBe(true); // (6,4) -> (6,5): now open
    expect(move(world, 0, 1).moved).toBe(true); // (6,5) -> (6,6): the lore alcove

    const readLore = attemptInteract(world); // still facing west -- (5,6) is blank, falls through to "here"
    expect(readLore.message).toContain("wards held");

    expect(move(world, 0, 1).moved).toBe(false); // the wall further in looks ordinary until it's searched

    turn(world, -1); // west -> south, facing the secret wall directly ahead
    const search = attemptInteract(world);
    expect(search.message).toBe("You find a hidden passage!");

    expect(move(world, 0, 1).moved).toBe(true); // (6,6) -> (6,7): now open
    expect(move(world, 0, 1).moved).toBe(true); // (6,7) -> (6,8): the hidden pocket

    const readSecondLore = attemptInteract(world); // facing south, (6,9) is the border wall -- falls through to "here"
    expect(readSecondLore.message).toContain("never meant to stop looking");
  });

  it("a class-gated passage off the lever room opens for a party with a Rogue along", () => {
    const world = newWorld(); // the default roster includes Ysolde the Rogue

    for (const [dx, dz] of [
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
    ]) {
      expect(move(world, dx, dz).moved).toBe(true);
    }
    expect(move(world, 0, 1).moved).toBe(true); // (6,1) -> (6,2)
    expect(move(world, 0, 1).moved).toBe(true); // (6,2) -> (6,3)
    expect(move(world, 0, 1).moved).toBe(true); // (6,3) -> (6,4): the lever's tile, facing east toward the gate by default

    expect(move(world, 1, 0).moved).toBe(false); // the gate still blocks a plain step

    const unlock = attemptInteract(world);
    expect(unlock.message).toContain("Ysolde"); // credited by name, the Rogue who actually opened it

    expect(move(world, 1, 0).moved).toBe(true); // (6,4) -> (7,4): now open
    expect(move(world, 1, 0).moved).toBe(true); // (7,4) -> (8,4): the vault
    expect(world.inventory.has("shadow-ring")).toBe(true);
  });

  it("the class-gated passage refuses a party with no Rogue", () => {
    const world = newWorld(NO_ROGUE_PARTY());

    for (const [dx, dz] of [
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
      [0, 1],
      [0, 1],
      [0, 1],
    ]) {
      expect(move(world, dx, dz).moved).toBe(true);
    }
    // Now at (6,4), facing the gate at (7,4).

    const attempt = attemptInteract(world);
    expect(attempt.message).toBe("The lock is far too intricate to force open.");
    expect(move(world, 1, 0).moved).toBe(false); // still blocked -- no Rogue, no entry
  });
});
