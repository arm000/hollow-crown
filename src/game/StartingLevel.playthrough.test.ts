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

describe("Starting level playthrough (headless)", () => {
  it("can be solved: fetch the key, unlock the door, reach the stairs down to level 2", () => {
    // Since docs/08-roadmap-phases.md Phase 4, level 1's own exit tile
    // moves the party on to the next level rather than ending the run --
    // see levels/index.test.ts for the multi-level descent as a whole,
    // and levels/level3.ts for where the real, run-ending exit now lives.
    const world = newWorld();

    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1)
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1)
    expect(move(world, 0, 1).moved).toBe(true); // (3,1) -> (3,2): the key's side room
    expect(world.inventory.has("rusted-key")).toBe(true);

    expect(move(world, 0, -1).moved).toBe(true); // back to (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1)
    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1), facing the door at (6,1)

    expect(move(world, 1, 0).moved).toBe(false); // the locked door still blocks a plain step

    const unlock = attemptInteract(world);
    expect(unlock.message).toBe("You unlock the door.");

    expect(move(world, 1, 0).moved).toBe(true); // (5,1) -> (6,1), now open

    const descendingMove = move(world, 1, 0); // (6,1) -> (7,1): the stairs down
    expect(descendingMove.moved).toBe(true);
    expect(descendingMove.won).toBe(false); // level 1 alone doesn't end the run anymore
    expect(descendingMove.levelTransition).toBe("level-2");
  });

  it("cannot win by skipping the key: the locked door is a real gate, not a suggestion", () => {
    const world = newWorld();

    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1)
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1) -- skips the side room entirely
    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1)
    expect(world.inventory.has("rusted-key")).toBe(false);

    expect(move(world, 1, 0).moved).toBe(false); // door blocks the only path onward

    const interactWithoutKey = attemptInteract(world);
    expect(interactWithoutKey.message).toBe("The door is locked.");
    expect(move(world, 1, 0).moved).toBe(false); // still blocked after a failed interact

    expect(world.player.gridX).toBe(5);
    expect(world.player.gridZ).toBe(1);
  });

  it("the lever unlocks an optional bonus alcove with a lore item, entirely bypassable", () => {
    const world = newWorld();

    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1)
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1)
    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1): the lever branch's entrance
    expect(move(world, 0, 1).moved).toBe(true); // (5,1) -> (5,2)
    expect(move(world, 0, 1).moved).toBe(true); // (5,2) -> (5,3)
    expect(move(world, 0, 1).moved).toBe(true); // (5,3) -> (5,4): the small room, and the lever's tile
    expect(move(world, 1, 0).moved).toBe(true); // (5,4) -> (6,4)

    expect(move(world, 0, 1).moved).toBe(false); // the bonus alcove's door is still locked

    expect(move(world, -1, 0).moved).toBe(true); // back to (5,4), onto the lever
    const pullLever = attemptInteract(world);
    expect(pullLever.message).toBe("You pull the lever. Something unlocks nearby.");

    expect(move(world, 1, 0).moved).toBe(true); // (5,4) -> (6,4)
    expect(move(world, 0, 1).moved).toBe(true); // (6,4) -> (6,5): now open
    expect(move(world, 0, 1).moved).toBe(true); // (6,5) -> (6,6): the lore alcove

    const readLore = attemptInteract(world);
    expect(readLore.message).toContain("wards held");
  });

  it("pushing the block reveals its own hidden pocket, and still arms the shared bonus door via the plate", () => {
    const world = newWorld();

    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1)
    expect(move(world, 0, 1).moved).toBe(true); // (2,1) -> (2,2): the plate branch's entrance
    expect(move(world, 0, 1).moved).toBe(true); // (2,2) -> (2,3)

    const push = move(world, 0, 1); // (2,3) -> (2,4): pushes the block ahead of it onto the plate
    expect(push.moved).toBe(true);
    expect(push.pushedBlock).toEqual({ from: { x: 2, z: 4 }, to: { x: 2, z: 5 } });

    // (1, 4) was never reachable before -- the block itself sat on the
    // only tile leading to it. Regression coverage for a player report
    // that the original version of this puzzle gave nothing back for
    // the trouble beyond a door the lever already opened.
    expect(world.inventory.has("tarnished-talisman")).toBe(false);
    const findPocket = move(world, -1, 0); // (2,4) -> (1,4): the hidden pocket, only standable now
    expect(findPocket.moved).toBe(true);
    expect(world.inventory.has("tarnished-talisman")).toBe(true);
    expect(move(world, 1, 0).moved).toBe(true); // (1,4) -> (2,4)

    // The spur is a dead end now that the block sits on the plate at its far tile — back out
    // and around via the lever branch's room to reach the bonus door from the other side.
    expect(move(world, 0, -1).moved).toBe(true); // (2,4) -> (2,3)
    expect(move(world, 0, -1).moved).toBe(true); // (2,3) -> (2,2)
    expect(move(world, 0, -1).moved).toBe(true); // (2,2) -> (2,1)
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1)
    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1)
    expect(move(world, 0, 1).moved).toBe(true); // (5,1) -> (5,2)
    expect(move(world, 0, 1).moved).toBe(true); // (5,2) -> (5,3)
    expect(move(world, 0, 1).moved).toBe(true); // (5,3) -> (5,4)
    expect(move(world, 1, 0).moved).toBe(true); // (5,4) -> (6,4)

    // Open via the plate alone -- the lever was never touched in this test.
    expect(move(world, 0, 1).moved).toBe(true); // (6,4) -> (6,5)
  });

  it("a secret wall behind the bonus alcove hides one more pocket", () => {
    const world = newWorld();

    // Reach the lore alcove via the lever (the quicker of the two ways in).
    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1)
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1)
    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1)
    expect(move(world, 0, 1).moved).toBe(true); // (5,1) -> (5,2)
    expect(move(world, 0, 1).moved).toBe(true); // (5,2) -> (5,3)
    expect(move(world, 0, 1).moved).toBe(true); // (5,3) -> (5,4): the lever
    attemptInteract(world); // pull it
    expect(move(world, 1, 0).moved).toBe(true); // (5,4) -> (6,4)
    expect(move(world, 0, 1).moved).toBe(true); // (6,4) -> (6,5): open now
    expect(move(world, 0, 1).moved).toBe(true); // (6,5) -> (6,6): the lore alcove

    // The wall further in looks ordinary until it's searched.
    expect(move(world, 0, 1).moved).toBe(false);

    world.player.turn(1); // face south (was east) to search the wall, not re-read the lore item underfoot
    world.player.update(10);
    const search = attemptInteract(world);
    expect(search.message).toBe("You find a hidden passage!");

    expect(move(world, 0, 1).moved).toBe(true); // (6,6) -> (6,7): now open
    expect(move(world, 0, 1).moved).toBe(true); // (6,7) -> (6,8): the hidden pocket

    const readSecondLore = attemptInteract(world);
    expect(readSecondLore.message).toContain("never meant to stop looking");
  });

  it("a class-gated passage off the lever room opens for a party with a Rogue along", () => {
    const world = newWorld(); // the default roster includes Ysolde the Rogue

    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1)
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1)
    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1)
    expect(move(world, 0, 1).moved).toBe(true); // (5,1) -> (5,2)
    expect(move(world, 0, 1).moved).toBe(true); // (5,2) -> (5,3)
    expect(move(world, 0, 1).moved).toBe(true); // (5,3) -> (5,4): the lever
    expect(move(world, 1, 0).moved).toBe(true); // (5,4) -> (6,4)
    expect(move(world, 1, 0).moved).toBe(true); // (6,4) -> (7,4): the gate's threshold

    expect(move(world, 1, 0).moved).toBe(false); // the gate still blocks a plain step

    const unlock = attemptInteract(world);
    expect(unlock.message).toContain("Ysolde"); // credited by name, the Rogue who actually opened it

    expect(move(world, 1, 0).moved).toBe(true); // (7,4) -> (8,4): now open
    expect(move(world, 1, 0).moved).toBe(true); // (8,4) -> (9,4): the vault
    expect(world.inventory.has("shadow-ring")).toBe(true);
  });

  it("the class-gated passage refuses a party with no Rogue", () => {
    const noRogueParty = createParty([
      { name: "Bram", classId: "warrior", portrait: "🔴" },
      { name: "Corvin", classId: "mage", portrait: "🔵" },
      { name: "Maren", classId: "cleric", portrait: "🟢" },
    ]);
    const world = newWorld(noRogueParty);

    for (const [dx, dz] of [
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
      [0, 1],
      [0, 1],
      [0, 1],
      [1, 0],
      [1, 0],
    ]) {
      expect(move(world, dx, dz).moved).toBe(true);
    }
    // Now at (7,4), facing the gate at (8,4).

    const attempt = attemptInteract(world);
    expect(attempt.message).toBe("The lock is far too intricate to force open.");
    expect(move(world, 1, 0).moved).toBe(false); // still blocked -- no Rogue, no entry
  });
});
