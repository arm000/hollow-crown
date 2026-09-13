import { describe, expect, it } from "vitest";
import { CombatEngine } from "./combat/CombatEngine";
import { attemptInteract, attemptMove, equipItem, type WorldState } from "./GameLogic";
import { InteractableManager } from "./interactables/InteractableManager";
import { Inventory } from "./Inventory";
import { getLevel } from "./levels";
import { buildMonsters } from "./monster/bestiary";
import type { Monster } from "./monster/Monster";
import { createStartingParty } from "./party/roster";
import { Player } from "./Player";
import { SeededRng } from "./Rng";
import { WorldClock } from "./WorldClock";

/**
 * Phase 6's "full-campaign headless scripted playthrough... as the
 * release smoke test"
 * (docs/08-roadmap-phases.md#phase-6--full-campaign--release-polish):
 * unlike `MultiLevelDescent.playthrough.test.ts` (deliberately monster-
 * free, proving the descent mechanic in isolation), this drives the
 * *entire* v1 campaign with real monsters, real `CombatEngine` fights,
 * and the party actually picking up and equipping gear along the way —
 * as close to an honest, start-to-finish playthrough as a headless test
 * gets. If any future change breaks the game end to end, this is the
 * one test that notices regardless of which system caused it.
 */

function newWorld(): WorldState {
  const level = getLevel("level-1");
  const start = level.dungeon.findStart();
  const player = new Player(start.x, start.z, 1, 2, 1);
  const worldClock = new WorldClock();
  const monsters = buildMonsters(level.monsters, level.dungeon, player);
  for (const monster of monsters) worldClock.register(monster);

  return {
    player,
    dungeon: level.dungeon,
    interactables: InteractableManager.fromSpawns(level.entities),
    inventory: new Inventory(),
    party: createStartingParty(),
    worldClock,
    monsters,
  };
}

/** The pure-logic half of `Game.transitionToLevel`: swap in the next level's dungeon/interactables/monsters and place the party on its start tile, facing east. */
function enterLevel(world: WorldState, levelId: string): void {
  const level = getLevel(levelId);
  world.dungeon = level.dungeon;
  world.interactables = InteractableManager.fromSpawns(level.entities);
  world.worldClock.clear();
  world.monsters = buildMonsters(level.monsters, level.dungeon, world.player);
  for (const monster of world.monsters) world.worldClock.register(monster);
  const start = level.dungeon.findStart();
  world.player.teleportTo(start.x, start.z, 1);
}

/** A reasonable (not necessarily optimal) combat action: lead with the class-flavored ability against a monster known to be countered by it, since that's what a player paying attention to the bestiary would do; otherwise a plain attack. Holy Water answers Steward Marrow's Holy weakness when there's no other good option and the party is carrying it. */
function pickAction(engine: CombatEngine, monster: Monster, inventory: Inventory): { choice: "attack" | "ability" | "item"; itemId?: string } {
  const actor = engine.currentActor;
  if ("classId" in actor) {
    if (actor.classId === "mage" && monster.resistances.fire !== undefined && monster.resistances.fire > 1 && actor.mana >= 6) {
      return { choice: "ability" };
    }
    if (monster.resistances.holy !== undefined && monster.resistances.holy > 1 && inventory.has("holy-water")) {
      return { choice: "item", itemId: "holy-water" };
    }
  }
  return { choice: "attack" };
}

/** Resolves a triggered encounter to its conclusion, asserting the party actually wins -- a "fled" or "defeat" result fails the whole smoke test, since the point is proving the campaign is genuinely completable. */
function resolveCombat(world: WorldState, monster: Monster, rng: SeededRng): void {
  const engine = new CombatEngine(world.party, monster, rng, world.inventory);
  let guard = 0;
  while (engine.result === "ongoing" && guard < 300) {
    if (engine.isPartyTurn) {
      const action = pickAction(engine, monster, world.inventory);
      engine.submitAction(action.choice, action.itemId);
    }
    guard++;
  }
  expect(engine.result, `fighting ${monster.name}`).toBe("victory");
  if (engine.result === "victory") monster.takeDamage(monster.maxHp); // ensure isDown for any later mesh/state checks, mirroring what Game.checkCombatEnd relies on
}

/** Attempts a move, resolves any fight it triggers, and follows a level transition immediately -- so the next scripted move always lands on the level and combat state the party actually ends up in. */
function move(world: WorldState, dx: number, dz: number, rng: SeededRng) {
  const outcome = attemptMove(world, dx, dz);
  world.player.update(10);
  if (outcome.combatTriggeredBy) resolveCombat(world, outcome.combatTriggeredBy, rng);
  if (outcome.levelTransition) enterLevel(world, outcome.levelTransition);
  return outcome;
}

describe("Full campaign playthrough (headless release smoke test)", () => {
  it("descends from level 1 through the boss arena, winning every fight along the way, and reaches the real exit", () => {
    const world = newWorld();
    const rng = new SeededRng(7);

    // Level 1: fetch the key, grab the sword and charm, unlock the
    // door, take the stairs down. Skips the optional lever/plate/
    // secret-wall/class-gate content -- this is the mandatory path,
    // not a completionist run.
    move(world, 1, 0, rng); // (1,1) -> (2,1): the Gaunt Steward's tile
    move(world, 1, 0, rng); // (2,1) -> (3,1)
    move(world, 0, 1, rng); // (3,1) -> (3,2): the key
    expect(world.inventory.has("rusted-key")).toBe(true);
    move(world, 0, -1, rng); // back to (3,1)
    move(world, 1, 0, rng); // (3,1) -> (4,1) -- the Rot-thing patrols right here
    move(world, 1, 0, rng); // (4,1) -> (5,1)
    expect(attemptInteract(world).message).toBe("You unlock the door.");
    move(world, 1, 0, rng); // (5,1) -> (6,1), now open

    const toLevel2 = move(world, 1, 0, rng); // (6,1) -> (7,1): stairs down
    expect(toLevel2.levelTransition).toBe("level-2");
    expect(world.party.isDefeated).toBe(false);

    // Level 2: a different key, a different door, the Screeching Wraith
    // patrolling the one corridor between them.
    move(world, 1, 0, rng); // (1,1) -> (2,1): the old-buckler, right at the entrance
    equipItem(world, "Bram", "old-buckler");
    move(world, 1, 0, rng); // (2,1) -> (3,1)
    move(world, 0, 1, rng); // (3,1) -> (3,2): the key
    expect(world.inventory.has("iron-key")).toBe(true);
    move(world, 0, -1, rng); // back to (3,1)
    move(world, 1, 0, rng); // (3,1) -> (4,1) -- the Wraith patrols right here
    move(world, 1, 0, rng); // (4,1) -> (5,1)
    expect(attemptInteract(world).message).toBe("You unlock the door.");
    move(world, 1, 0, rng); // (5,1) -> (6,1), now open

    const toLevel3 = move(world, 1, 0, rng); // (6,1) -> (7,1): stairs down
    expect(toLevel3.levelTransition).toBe("level-3");
    expect(world.party.isDefeated).toBe(false);

    // Level 3: a straight corridor, no key needed -- the Court Alchemist
    // then the Cinder Wretch, back to back, plus a defensive breather
    // pickup between the two fights.
    move(world, 1, 0, rng); // (1,1) -> (2,1): the sentry's tile
    move(world, 1, 0, rng); // (2,1) -> (3,1) -- the Court Alchemist patrols here
    move(world, 1, 0, rng); // (3,1) -> (4,1)
    move(world, 1, 0, rng); // (4,1) -> (5,1)
    move(world, 1, 0, rng); // (5,1) -> (6,1) -- the Cinder Wretch patrols here
    move(world, 1, 0, rng); // (6,1) -> (7,1)
    move(world, 1, 0, rng); // (7,1) -> (8,1)

    const toLevel4 = move(world, 1, 0, rng); // (8,1) -> (9,1): stairs down
    expect(toLevel4.levelTransition).toBe("level-4");
    expect(world.party.isDefeated).toBe(false);

    // Level 4: the boss arena. Cross to Steward Marrow's patrol, fight
    // it (Holy Water answers its weakness), then continue to the exit.
    move(world, 1, 0, rng); // (1,1) -> (2,1)
    move(world, 1, 0, rng); // (2,1) -> (3,1) -- Marrow patrols (4,3)-(5,3), detection radius 5 finds the party well before this
    move(world, 1, 0, rng); // (3,1) -> (4,1)
    move(world, 1, 0, rng); // (4,1) -> (5,1)
    move(world, 1, 0, rng); // (5,1) -> (6,1)
    move(world, 1, 0, rng); // (6,1) -> (7,1)
    move(world, 0, 1, rng); // (7,1) -> (7,2)
    move(world, 0, 1, rng); // (7,2) -> (7,3)
    move(world, 0, 1, rng); // (7,3) -> (7,4)

    expect(world.party.isDefeated).toBe(false); // the boss fight, whenever it triggered, was won

    const winningMove = move(world, 0, 1, rng); // (7,4) -> (7,5): the exit
    expect(winningMove.moved).toBe(true);
    expect(winningMove.won).toBe(true);
  });
});
