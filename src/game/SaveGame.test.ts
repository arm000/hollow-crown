import { describe, expect, it } from "vitest";
import {
  deserializeInventory,
  deserializeParty,
  hasSave,
  loadFromStorage,
  saveToStorage,
  serialize,
  type SaveData,
} from "./SaveGame";
import { InteractableManager } from "./interactables/InteractableManager";
import { Inventory } from "./Inventory";
import { getLevel } from "./levels";
import { Character } from "./party/Character";
import { EQUIPMENT_ITEMS } from "./party/Equipment";
import { Party } from "./party/Party";
import { Player } from "./Player";
import type { WorldState } from "./GameLogic";
import { WorldClock } from "./WorldClock";

/**
 * A minimal in-memory stand-in for the DOM `Storage` interface, so
 * these tests exercise real `JSON.stringify`/`parse` round-tripping (not
 * just object identity) without touching a real browser's
 * `localStorage` — this project's Vitest environment is plain Node
 * (see `vitest.config.ts`), same reasoning as `InputManager.test.ts`'s
 * `FakeEventTarget`.
 */
class FakeStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function newCharacter(overrides: Partial<{ name: string; level: number; xp: number; hp: number }> = {}): Character {
  const character = new Character(
    overrides.name ?? "Bram",
    "warrior",
    "front",
    { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 },
    30,
    0,
    "🔴",
  );
  if (overrides.level !== undefined) character.level = overrides.level;
  if (overrides.xp !== undefined) character.xp = overrides.xp;
  if (overrides.hp !== undefined) character.hp = overrides.hp;
  return character;
}

function newWorld(party: Party): WorldState {
  const level = getLevel("level-1");
  return {
    player: new Player(3, 4, 2, 2, 1),
    dungeon: level.dungeon,
    interactables: InteractableManager.fromSpawns(level.entities),
    inventory: new Inventory(),
    party,
    worldClock: new WorldClock(),
    monsters: [],
  };
}

describe("serialize / deserializeParty", () => {
  it("round-trips a character's core fields exactly", () => {
    const bram = newCharacter({ level: 3, xp: 12, hp: 20 });
    const world = newWorld(new Party([bram]));

    const data = serialize(world, "level-2");
    const restored = deserializeParty(data).members[0];

    expect(restored.name).toBe("Bram");
    expect(restored.classId).toBe("warrior");
    expect(restored.rank).toBe("front");
    expect(restored.portrait).toBe("🔴");
    expect(restored.stats).toEqual(bram.stats);
    expect(restored.maxHp).toBe(30);
    expect(restored.hp).toBe(20);
    expect(restored.level).toBe(3);
    expect(restored.xp).toBe(12);
  });

  it("round-trips equipped gear back into the same slots", () => {
    const bram = newCharacter();
    bram.equip(EQUIPMENT_ITEMS["rusted-sword"]);
    bram.equip(EQUIPMENT_ITEMS["old-buckler"]);
    const world = newWorld(new Party([bram]));

    const data = serialize(world, "level-1");
    const restored = deserializeParty(data).members[0];

    expect(restored.equippedIn("weapon")?.id).toBe("rusted-sword");
    expect(restored.equippedIn("offhand")?.id).toBe("old-buckler");
    expect(restored.equippedIn("armor")).toBeUndefined();
    expect(restored.effectiveStats.might).toBe(bram.effectiveStats.might); // the equipped bonus survived, not just the base stat
  });

  it("round-trips every party member, in order", () => {
    const world = newWorld(new Party([newCharacter({ name: "Bram" }), newCharacter({ name: "Ysolde" })]));
    const restored = deserializeParty(serialize(world, "level-1"));
    expect(restored.members.map((m) => m.name)).toEqual(["Bram", "Ysolde"]);
  });
});

describe("serialize / deserializeInventory", () => {
  it("round-trips item ids, names, and counts", () => {
    const world = newWorld(new Party([newCharacter()]));
    world.inventory.add("oil-flask", "an Oil Flask", 2);
    world.inventory.add("rusted-key", "a Rusted Key");

    const restored = deserializeInventory(serialize(world, "level-1"));

    // oil-flask was never identified before saving -- its mystery name
    // persists after loading too, the same as it would across a real
    // quit/relaunch (see the "identification state" test below for the
    // other half of this).
    expect(restored.entries()).toEqual(
      expect.arrayContaining([
        { id: "oil-flask", name: "a bubbling amber vial", count: 2 },
        { id: "rusted-key", name: "a Rusted Key", count: 1 },
      ]),
    );
  });

  it("round-trips identification state, so an item identified before saving stays identified after loading", () => {
    const world = newWorld(new Party([newCharacter()]));
    world.inventory.add("oil-flask", "an Oil Flask", 1);
    world.inventory.identify("oil-flask");

    const restored = deserializeInventory(serialize(world, "level-1"));

    expect(restored.entries()).toEqual([{ id: "oil-flask", name: "an Oil Flask", count: 1 }]);
  });
});

describe("serialize", () => {
  it("captures the level id and the party's grid position/facing", () => {
    const world = newWorld(new Party([newCharacter()]));
    const data = serialize(world, "level-2");

    expect(data.levelId).toBe("level-2");
    expect(data.playerX).toBe(3);
    expect(data.playerZ).toBe(4);
    expect(data.playerFacing).toBe(2);
  });
});

describe("saveToStorage / loadFromStorage (real JSON round-trip)", () => {
  it("loads back exactly what was saved", () => {
    const storage = new FakeStorage();
    const world = newWorld(new Party([newCharacter({ level: 2, xp: 5 })]));
    world.inventory.add("antidote", "an Antidote");
    const data = serialize(world, "level-3");

    saveToStorage(data, storage);
    const loaded = loadFromStorage(storage);

    expect(loaded).toEqual(data);
  });

  it("hasSave is false until something is saved", () => {
    const storage = new FakeStorage();
    expect(hasSave(storage)).toBe(false);
    saveToStorage(serialize(newWorld(new Party([newCharacter()])), "level-1"), storage);
    expect(hasSave(storage)).toBe(true);
  });

  it("loadFromStorage returns undefined when nothing is saved", () => {
    expect(loadFromStorage(new FakeStorage())).toBeUndefined();
  });

  it("loadFromStorage returns undefined for corrupted JSON instead of throwing", () => {
    const storage = new FakeStorage();
    storage.setItem("hollow-crown-save", "{not valid json");
    expect(loadFromStorage(storage)).toBeUndefined();
  });

  it("a save can be fully reconstructed into a WorldState-ready party and inventory", () => {
    const storage = new FakeStorage();
    const bram = newCharacter();
    bram.equip(EQUIPMENT_ITEMS["ember-charm"]);
    const world = newWorld(new Party([bram]));
    world.inventory.add("holy-water", "Holy Water");
    saveToStorage(serialize(world, "level-2"), storage);

    const loaded = loadFromStorage(storage) as SaveData;
    const party = deserializeParty(loaded);
    const inventory = deserializeInventory(loaded);

    expect(party.members[0].equippedIn("accessory")?.id).toBe("ember-charm");
    expect(inventory.has("holy-water")).toBe(true);
    expect(loaded.levelId).toBe("level-2");
  });
});
