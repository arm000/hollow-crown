import { describe, expect, it } from "vitest";
import { CombatEngine } from "./combat/CombatEngine";
import { DungeonMap } from "./DungeonMap";
import { attemptMove, attemptTurn, type WorldState } from "./GameLogic";
import { InteractableManager } from "./interactables/InteractableManager";
import { Inventory } from "./Inventory";
import { Monster } from "./monster/Monster";
import { Character } from "./party/Character";
import { Party } from "./party/Party";
import { Player } from "./Player";
import { SeededRng } from "./Rng";
import { WorldClock } from "./WorldClock";

/**
 * Player report: "smoke bomb doesn't really work well because the
 * monster just re-engages into combat again." True of any successful
 * flee, not just the Rogue's Smoke Bomb skill — `Monster.disengage()`
 * only ever cleared alert state, but a flee never relocates the party,
 * so they're left standing exactly adjacent to a monster that's
 * trivially still within its own detection radius (adjacent is
 * distance 1). The very next world-turn — even just turning in place —
 * let it re-notice and (per `GameLogic.advanceWorldTurn`'s plain
 * adjacency check) re-trigger combat immediately, making a successful
 * flee functionally indistinguishable from continuing the fight. Fixed
 * with `Monster`'s `disengageCooldown` (see its own doc comment) and
 * `advanceWorldTurn` skipping a `isDisengaged` monster regardless of
 * distance. `Monster.test.ts` covers the cooldown mechanism in
 * isolation; this test proves the actual end-to-end symptom is gone,
 * driving the same `attemptMove`/`attemptTurn` functions `Game.ts` does.
 */

const CORRIDOR = new DungeonMap(["######", "#S...#", "######"]);

function newWorld(): { world: WorldState; monster: Monster } {
  const player = new Player(1, 1, 1, 2, 1);
  const monster = new Monster(
    { name: "Rot-thing", x: 3, z: 1, patrolPoints: [{ x: 3, z: 1 }], detectionRadius: 5, maxHp: 9999, might: 1, initiativeStat: 3 },
    CORRIDOR,
    player,
  );
  const worldClock = new WorldClock();
  worldClock.register(monster);

  const world: WorldState = {
    player,
    dungeon: CORRIDOR,
    interactables: InteractableManager.fromSpawns([]),
    inventory: new Inventory(),
    party: new Party([new Character("Ysolde", "rogue", "front", { might: 6, grace: 20, vitality: 7, focus: 2, resolve: 0 }, 22, 0)]),
    worldClock,
    monsters: [monster],
  };
  return { world, monster };
}

/** Mirrors exactly what `Game.checkCombatEnd` does for a "fled" result — the one place `disengage()` is actually called in real play. */
function flee(monster: Monster): void {
  monster.disengage();
}

/** `attemptMove`, plus instantly finishing the move animation it starts — same helper other playthrough tests already need (`Player.tryMove` refuses a second move while the first is still animating, which real play never hits since `Game.tick()` advances the animation every frame in between). */
function move(world: WorldState, dx: number, dz: number) {
  const outcome = attemptMove(world, dx, dz);
  world.player.update(10);
  return outcome;
}

describe("a successful flee doesn't let the monster instantly re-engage", () => {
  it("turning in place right after fleeing (the cheapest possible next action) doesn't re-trigger combat, even while still adjacent", () => {
    const { world, monster } = newWorld();

    // Walk into the monster, exactly as real play would.
    const engaged = move(world, 1, 0);
    expect(engaged.combatTriggeredBy).toBe(monster);

    flee(monster);

    // The party never moved off the adjacent tile -- a flee doesn't
    // relocate anyone -- so this is the exact scenario the bug report
    // described: still right next to it, the very next action.
    const afterFlee = attemptTurn(world, 1);
    expect(afterFlee.combatTriggeredBy).toBeUndefined();
  });

  it("stays disengaged across several turns of standing right next to it, not just the one immediately after", () => {
    const { world, monster } = newWorld();
    move(world, 1, 0);
    flee(monster);

    for (let i = 0; i < 4; i++) {
      expect(attemptTurn(world, 1).combatTriggeredBy).toBeUndefined();
    }
  });

  it("actually walking away works too, not just standing still", () => {
    const { world, monster } = newWorld();
    move(world, 1, 0); // (1,1) -> (2,1): adjacent to the monster at (3,1)
    flee(monster);

    const steppedBack = move(world, -1, 0); // (2,1) -> (1,1): distance now 2
    expect(steppedBack.moved).toBe(true);
    expect(steppedBack.combatTriggeredBy).toBeUndefined();
  });

  it("a real fled CombatEngine result, resolved the same way Game.ts does, produces the same fix", () => {
    const { world, monster } = newWorld();
    move(world, 1, 0);

    // Ysolde's Resolve is 0 -- an ordinary Flee would be a near coin
    // flip at best. Force a real "fled" result through the actual
    // engine rather than assuming it, then resolve it exactly like
    // Game.checkCombatEnd does.
    const engine = new CombatEngine(world.party, monster, new SeededRng(1));
    let guard = 0;
    while (engine.result === "ongoing" && guard < 20) {
      if (engine.isPartyTurn) engine.submitAction("flee");
      guard++;
    }
    expect(engine.result).toBe("fled");
    monster.disengage();

    expect(attemptTurn(world, 1).combatTriggeredBy).toBeUndefined();
  });
});
