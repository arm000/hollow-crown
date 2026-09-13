import { describe, expect, it } from "vitest";
import { DungeonMap, STARTING_LEVEL } from "./DungeonMap";
import { equipItem, resolveStartPosition, unequipItem, type WorldState } from "./GameLogic";
import { InteractableManager } from "./interactables/InteractableManager";
import { Inventory } from "./Inventory";
import { LEVELS } from "./levels";
import { Character } from "./party/Character";
import { Party } from "./party/Party";
import { Player } from "./Player";
import { WorldClock } from "./WorldClock";

/**
 * `equipItem`/`unequipItem` back the inventory screen
 * (docs/08-roadmap-phases.md Phase 3 batch 4) — headless coverage here
 * proves the swap logic itself, independent of `InventoryUI`'s DOM.
 */

function newBram(): Character {
  return new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
}

function newWorld(members: Character[] = [newBram()]): WorldState {
  const dungeon = STARTING_LEVEL;
  const player = new Player(1, 1, 1, 2, 1);
  return {
    player,
    dungeon,
    interactables: InteractableManager.fromSpawns([]),
    inventory: new Inventory(),
    party: new Party(members),
    worldClock: new WorldClock(),
    monsters: [],
  };
}

describe("equipItem", () => {
  it("equips a held item onto the named character and consumes it from the inventory", () => {
    const world = newWorld();
    world.inventory.add("rusted-sword", "a Rusted Sword");

    const result = equipItem(world, "Bram", "rusted-sword");

    expect(result.success).toBe(true);
    expect(world.party.members[0].equippedIn("weapon")?.id).toBe("rusted-sword");
    expect(world.inventory.has("rusted-sword")).toBe(false);
  });

  it("returns whatever was already worn in that slot to the inventory", () => {
    const world = newWorld();
    world.inventory.add("rusted-sword", "a Rusted Sword");
    equipItem(world, "Bram", "rusted-sword");
    world.inventory.add("old-buckler", "an Old Buckler"); // a different slot -- no swap yet
    world.inventory.add("rusted-sword", "a Rusted Sword"); // a second sword to swap in

    equipItem(world, "Bram", "rusted-sword");

    expect(world.inventory.has("rusted-sword")).toBe(true); // the first one, handed back
    expect(world.party.members[0].equippedIn("weapon")?.id).toBe("rusted-sword");
  });

  it("fails without consuming anything if the item isn't actually held", () => {
    const world = newWorld();

    const result = equipItem(world, "Bram", "rusted-sword");

    expect(result.success).toBe(false);
    expect(world.party.members[0].equippedIn("weapon")).toBeUndefined();
  });

  it("fails if the named character isn't in the party", () => {
    const world = newWorld();
    world.inventory.add("rusted-sword", "a Rusted Sword");

    const result = equipItem(world, "Nobody", "rusted-sword");

    expect(result.success).toBe(false);
    expect(world.inventory.has("rusted-sword")).toBe(true); // untouched
  });
});

describe("unequipItem", () => {
  it("moves a worn item back into the shared inventory", () => {
    const world = newWorld();
    world.inventory.add("rusted-sword", "a Rusted Sword");
    equipItem(world, "Bram", "rusted-sword");

    const result = unequipItem(world, "Bram", "weapon");

    expect(result.success).toBe(true);
    expect(world.party.members[0].equippedIn("weapon")).toBeUndefined();
    expect(world.inventory.has("rusted-sword")).toBe(true);
  });

  it("fails if the slot is already empty", () => {
    const world = newWorld();

    const result = unequipItem(world, "Bram", "weapon");

    expect(result.success).toBe(false);
  });
});

describe("resolveStartPosition", () => {
  it("without save data, uses the dungeon's own start tile, facing east", () => {
    const dungeon = new DungeonMap(["#####", "#.S.#", "#####"]);
    expect(resolveStartPosition(dungeon)).toEqual({ x: 2, z: 1, facing: 1 });
  });

  it("with save data, uses exactly the saved position/facing instead", () => {
    const dungeon = new DungeonMap(["#####", "#.S.#", "#####"]);
    const result = resolveStartPosition(dungeon, { playerX: 5, playerZ: 6, playerFacing: 3 });
    expect(result).toEqual({ x: 5, z: 6, facing: 3 });
  });

  it("never resolves to a wall tile for any level in the real game, with no save (regression guard)", () => {
    // A real shipped bug: Game's constructor built a level's geometry
    // but never called teleportTo, leaving a fresh game's player on
    // the untouched (0, 0) placeholder -- a wall tile in every level,
    // silently blocking every move while turning (no wall check) kept
    // working. This pins the fix at the one place it can be unit
    // tested, since Game itself has zero rendering-free logic left to
    // get this wrong.
    for (const level of LEVELS) {
      const position = resolveStartPosition(level.dungeon);
      expect(level.dungeon.isWall(position.x, position.z), `${level.id} start tile`).toBe(false);
    }
  });
});
