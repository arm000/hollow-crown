import { describe, expect, it } from "vitest";
import { STARTING_LEVEL } from "./DungeonMap";
import { attemptInteract, attemptMove, type WorldState } from "./GameLogic";
import { InteractableManager } from "./interactables/InteractableManager";
import { Inventory } from "./Inventory";
import { STARTING_LEVEL_ENTITIES } from "./Level";
import { Player } from "./Player";

/**
 * A headless scripted playthrough of the starting level — the automated
 * form of Phase 1's "Playable when" gate
 * (docs/08-roadmap-phases.md#phase-1--world-interaction--objective):
 * drives the exact same `attemptMove`/`attemptInteract` functions
 * `Game` calls, with no rendering involved at all, and checks that the
 * puzzle is actually required to win — not just that some sequence of
 * actions happens to win.
 */

function newWorld(): WorldState {
  const dungeon = STARTING_LEVEL;
  const start = dungeon.findStart();
  return {
    player: new Player(start.x, start.z, 1, 2, 1),
    dungeon,
    interactables: InteractableManager.fromSpawns(STARTING_LEVEL_ENTITIES),
    inventory: new Inventory(),
  };
}

/** Attempts a move and instantly finishes its animation, so the next scripted action isn't refused as "still animating". */
function move(world: WorldState, dx: number, dz: number) {
  const outcome = attemptMove(world, dx, dz);
  world.player.update(10);
  return outcome;
}

describe("Starting level playthrough (headless)", () => {
  it("can be solved: fetch the key, unlock the door, reach the exit", () => {
    const world = newWorld();

    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1)
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1)
    expect(move(world, 0, 1).moved).toBe(true); // (3,1) -> (3,2): the key's side room
    expect(world.inventory.has("rusted-key")).toBe(true);

    expect(move(world, 0, -1).moved).toBe(true); // back to (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1), facing the door at (5,1)

    expect(move(world, 1, 0).moved).toBe(false); // the locked door still blocks a plain step

    const unlock = attemptInteract(world);
    expect(unlock.message).toBe("You unlock the door.");

    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1), now open
    expect(move(world, 1, 0).moved).toBe(true); // (5,1) -> (6,1)

    const winningMove = move(world, 1, 0); // (6,1) -> (7,1): the exit
    expect(winningMove.moved).toBe(true);
    expect(winningMove.won).toBe(true);
  });

  it("cannot win by skipping the key: the locked door is a real gate, not a suggestion", () => {
    const world = newWorld();

    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1)
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1) -- skips the side room entirely
    expect(world.inventory.has("rusted-key")).toBe(false);

    expect(move(world, 1, 0).moved).toBe(false); // door blocks the only path onward

    const interactWithoutKey = attemptInteract(world);
    expect(interactWithoutKey.message).toBe("The door is locked.");
    expect(move(world, 1, 0).moved).toBe(false); // still blocked after a failed interact

    expect(world.player.gridX).toBe(4);
    expect(world.player.gridZ).toBe(1);
  });
});
