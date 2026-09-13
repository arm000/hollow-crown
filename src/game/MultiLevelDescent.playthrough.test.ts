import { describe, expect, it } from "vitest";
import { attemptInteract, attemptMove, type WorldState } from "./GameLogic";
import { InteractableManager } from "./interactables/InteractableManager";
import { Inventory } from "./Inventory";
import { getLevel } from "./levels";
import { createStartingParty } from "./party/roster";
import { Player } from "./Player";
import { WorldClock } from "./WorldClock";

/**
 * The Phase 4 "headless scripted playthrough of the full multi-level
 * descent end to end"
 * (docs/08-roadmap-phases.md#phase-4--multi-level-descent--persistence):
 * proves the chain from level 1 through level 3 to the real win
 * condition, driving the exact same `attemptMove`/`attemptInteract`
 * functions `Game` calls, and swapping `world.dungeon`/`interactables`
 * on a `levelTransition` the same way `Game.transitionToLevel` does
 * (minus the Three.js scene it also has to rebuild, which is outside
 * what a headless test can or should exercise).
 *
 * Deliberately monster-free, same choice `StartingLevel.playthrough.test.ts`
 * already makes for level 1: this test's job is proving the *descent*
 * mechanic (dungeon/interactables/player swap correctly on every
 * transition, the real exit only exists on the final level), not
 * re-proving combat resolution, which `CombatEngine.test.ts` and the
 * per-encounter playthrough tests already cover.
 */

function newWorld(): WorldState {
  const level = getLevel("level-1");
  const start = level.dungeon.findStart();
  const player = new Player(start.x, start.z, 1, 2, 1);

  return {
    player,
    dungeon: level.dungeon,
    interactables: InteractableManager.fromSpawns(level.entities),
    inventory: new Inventory(),
    party: createStartingParty(),
    worldClock: new WorldClock(),
    monsters: [],
  };
}

/** The pure-logic half of `Game.transitionToLevel`: swap in the next level's dungeon/interactables and place the party on its start tile, facing east. */
function enterLevel(world: WorldState, levelId: string): void {
  const level = getLevel(levelId);
  world.dungeon = level.dungeon;
  world.interactables = InteractableManager.fromSpawns(level.entities);
  const start = level.dungeon.findStart();
  world.player.teleportTo(start.x, start.z, 1);
}

/** Attempts a move, finishes its animation, and follows a level transition immediately if this move triggered one -- so the next scripted move always lands on the level the party actually ends up on. */
function move(world: WorldState, dx: number, dz: number) {
  const outcome = attemptMove(world, dx, dz);
  world.player.update(10);
  if (outcome.levelTransition) enterLevel(world, outcome.levelTransition);
  return outcome;
}

describe("Multi-level descent playthrough (headless)", () => {
  it("descends from level 1 through level 3 and reaches the real exit", () => {
    const world = newWorld();

    // Level 1: fetch the key, unlock the door, take the stairs down.
    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1)
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1)
    expect(move(world, 0, 1).moved).toBe(true); // (3,1) -> (3,2): the key
    expect(world.inventory.has("rusted-key")).toBe(true);
    expect(move(world, 0, -1).moved).toBe(true); // back to (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1)
    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1)
    expect(attemptInteract(world).message).toBe("You unlock the door.");
    expect(move(world, 1, 0).moved).toBe(true); // (5,1) -> (6,1), now open

    const toLevel2 = move(world, 1, 0); // (6,1) -> (7,1): stairs down
    expect(toLevel2.won).toBe(false);
    expect(toLevel2.levelTransition).toBe("level-2");

    // Landed on level 2's own start tile, not wherever level 1 left off.
    expect(world.player.gridX).toBe(1);
    expect(world.player.gridZ).toBe(1);
    expect(world.dungeon).toBe(getLevel("level-2").dungeon);

    // Level 2: a different key, a different door, same shape.
    expect(move(world, 1, 0).moved).toBe(true); // (1,1) -> (2,1)
    expect(move(world, 1, 0).moved).toBe(true); // (2,1) -> (3,1)
    expect(move(world, 0, 1).moved).toBe(true); // (3,1) -> (3,2): the key
    expect(world.inventory.has("iron-key")).toBe(true);
    expect(move(world, 0, -1).moved).toBe(true); // back to (3,1)
    expect(move(world, 1, 0).moved).toBe(true); // (3,1) -> (4,1)
    expect(move(world, 1, 0).moved).toBe(true); // (4,1) -> (5,1)
    expect(attemptInteract(world).message).toBe("You unlock the door.");
    expect(move(world, 1, 0).moved).toBe(true); // (5,1) -> (6,1), now open

    const toLevel3 = move(world, 1, 0); // (6,1) -> (7,1): stairs down
    expect(toLevel3.won).toBe(false);
    expect(toLevel3.levelTransition).toBe("level-3");
    expect(world.player.gridX).toBe(1);
    expect(world.player.gridZ).toBe(1);
    expect(world.dungeon).toBe(getLevel("level-3").dungeon);

    // Level 3: a straight corridor to the real, run-ending exit -- no key needed.
    for (let step = 0; step < 7; step++) {
      expect(move(world, 1, 0).moved).toBe(true);
    }
    const winningMove = move(world, 1, 0); // (8,1) -> (9,1): the exit
    expect(winningMove.moved).toBe(true);
    expect(winningMove.won).toBe(true);
    expect(winningMove.levelTransition).toBeUndefined();
  });
});
