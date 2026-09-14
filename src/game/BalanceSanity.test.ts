import { describe, expect, it } from "vitest";
import type { DamageType } from "./combat/DamageType";
import { applyResistance } from "./combat/DamageType";
import { DungeonMap } from "./DungeonMap";
import { InteractableManager } from "./interactables/InteractableManager";
import { LEVELS } from "./levels";
import { buildMonsters } from "./monster/bestiary";
import { EQUIPMENT_ITEMS } from "./party/Equipment";
import { xpToNextLevel } from "./party/Leveling";
import { Player } from "./Player";

/**
 * Phase 6's "balance sanity checks that are cheap to assert
 * automatically and easy to accidentally break by hand"
 * (docs/08-roadmap-phases.md#phase-6--full-campaign--release-polish):
 * not a substitute for the per-encounter/full-campaign playthrough
 * tests, which prove specific fights actually play out right — these
 * are cheap, general invariants that a numeric tweak months from now
 * could break without anyone noticing until a player hits it.
 */

const DAMAGE_TYPES: DamageType[] = ["physical", "fire", "blight", "holy"];

describe("XP curve", () => {
  it("is strictly increasing, so leveling never gets cheaper or free at a higher level", () => {
    for (let level = 1; level < 30; level++) {
      expect(xpToNextLevel(level + 1)).toBeGreaterThan(xpToNextLevel(level));
    }
  });

  it("never returns zero or a negative threshold", () => {
    for (let level = 1; level < 30; level++) {
      expect(xpToNextLevel(level)).toBeGreaterThan(0);
    }
  });
});

describe("resistance math", () => {
  it("never produces a negative, NaN, or non-finite damage value, across every damage type and a range of resistance multipliers", () => {
    const multipliers = [0, 0.1, 0.5, 0.9, 1, 1.5, 2, 5];
    const rawDamages = [0, 1, 5, 17, 100];
    for (const type of DAMAGE_TYPES) {
      for (const multiplier of multipliers) {
        for (const raw of rawDamages) {
          const result = applyResistance(raw, { [type]: multiplier }, type);
          expect(Number.isFinite(result), `type=${type} mult=${multiplier} raw=${raw}`).toBe(true);
          expect(result, `type=${type} mult=${multiplier} raw=${raw}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("every monster type's resistances (docs/05-combat.md#monster-design-every-type-is-a-lesson) use only positive, finite multipliers", () => {
    // Built straight from real monster spawns, not a hand-copied list --
    // this fails the moment a new monster type ships with a broken
    // resistance value, without needing to remember to update it here.
    const dungeon = new DungeonMap(["###", "#.#", "###"]);
    const player = new Player(1, 1, 1, 2, 1);
    const seenTypes = new Set<string>();
    for (const level of LEVELS) {
      for (const spawn of level.monsters) {
        if (seenTypes.has(spawn.type)) continue;
        seenTypes.add(spawn.type);
        const [monster] = buildMonsters([{ ...spawn, x: 1, z: 1 }], dungeon, player);
        for (const [type, multiplier] of Object.entries(monster.resistances)) {
          expect(DAMAGE_TYPES, `${monster.name}'s resistance key "${type}"`).toContain(type);
          expect(Number.isFinite(multiplier), `${monster.name} ${type}`).toBe(true);
          expect(multiplier, `${monster.name} ${type}`).toBeGreaterThan(0);
        }
      }
    }
    expect(seenTypes.size).toBeGreaterThan(0); // sanity: the loop above actually ran against real data
  });
});

describe("level data integrity", () => {
  it("every equipmentItem spawn across every level references a real entry in EQUIPMENT_ITEMS", () => {
    for (const level of LEVELS) {
      for (const spawn of level.entities) {
        if (spawn.type !== "equipmentItem") continue;
        const itemId = spawn.params?.itemId as string | undefined;
        expect(itemId, `${level.id} (${spawn.x},${spawn.z})`).toBeDefined();
        expect(EQUIPMENT_ITEMS[itemId!], `${level.id} (${spawn.x},${spawn.z}) itemId="${itemId}"`).toBeDefined();
      }
    }
  });

  it("every door/stairsDown/classGate spawn that references another tile points at coordinates within that level's own map bounds", () => {
    for (const level of LEVELS) {
      for (const spawn of level.entities) {
        const doorX = spawn.params?.doorX as number | undefined;
        const doorZ = spawn.params?.doorZ as number | undefined;
        if (doorX === undefined || doorZ === undefined) continue;
        expect(doorX, `${level.id} lever/plate at (${spawn.x},${spawn.z})`).toBeGreaterThanOrEqual(0);
        expect(doorX).toBeLessThan(level.dungeon.width);
        expect(doorZ).toBeGreaterThanOrEqual(0);
        expect(doorZ).toBeLessThan(level.dungeon.height);
      }
    }
  });

  it("every level's lever/plate spawns actually resolve to a real door (buildEntities doesn't throw)", () => {
    // A bounds check alone (the test above) doesn't catch a doorX/doorZ
    // that's in range but simply has no door spawned there --
    // `buildEntities` throws in that case (see
    // `interactables/buildEntities.ts`'s `buildDoorLinked`), so this
    // proves every lever/plate's target is a door that actually exists,
    // not just a valid coordinate.
    for (const level of LEVELS) {
      expect(() => InteractableManager.fromSpawns(level.entities), level.id).not.toThrow();
    }
  });

  it("every locked door's keyId has a matching keyItem spawn somewhere in the same level", () => {
    // A door with a keyId that nothing in the level ever hands out would
    // be a real dead end -- the mandatory-path equivalent of the level 1
    // block puzzle bug (docs/08-roadmap-phases.md Phase 6 batch 4):
    // content placed, but nothing lets the party actually reach or use it.
    for (const level of LEVELS) {
      const keyItemIds = new Set(
        level.entities.filter((s) => s.type === "keyItem").map((s) => s.params?.itemId as string),
      );
      for (const spawn of level.entities) {
        if (spawn.type !== "door") continue;
        const keyId = spawn.params?.keyId as string | undefined;
        if (keyId === undefined) continue; // lever/plate-only doors have no key at all, nothing to check
        expect(keyItemIds, `${level.id} door at (${spawn.x},${spawn.z}) wants keyId="${keyId}"`).toContain(keyId);
      }
    }
  });

  /**
   * Every floor tile, and every entity spawn, reachable from the level's
   * own start tile -- a raw wall/floor BFS, the exact same shape as
   * `DungeonMap.test.ts`'s dedicated level 1 check, generalized across
   * all four levels. This is the general form of the bug a player report
   * actually found by hand (docs/08-roadmap-phases.md Phase 6 batch 4):
   * a pushable block sat on the *only* tile leading to (1, 4), which
   * this check would have caught immediately once that tile held a real
   * pickup with nothing (at the time) able to ever reach it -- a
   * `PushableBlock`/`Door`/`ClassGate` all sit on ordinary floor tiles
   * in the raw grid (only the entity, not the tile, blocks movement),
   * so none of them can make a reachable tile look unreachable here;
   * only a genuinely isolated *tile* would. Secret walls are the one
   * deliberate exception -- see the inline comment below, same
   * reasoning as `DungeonMap.test.ts`'s existing level 1 version.
   */
  it("every floor tile and every entity spawn is reachable from the level's start tile, in every level", () => {
    for (const level of LEVELS) {
      const secretWallTiles = new Set(
        level.entities.filter((s) => s.type === "secretWall").map((s) => `${s.x},${s.z}`),
      );
      const passable = (x: number, z: number) => !level.dungeon.isWall(x, z) || secretWallTiles.has(`${x},${z}`);

      const start = level.dungeon.findStart();
      const seen = new Set<string>([`${start.x},${start.z}`]);
      const queue: Array<{ x: number; z: number }> = [start];
      const steps: Array<[number, number]> = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ];
      while (queue.length > 0) {
        const { x, z } = queue.shift()!;
        for (const [dx, dz] of steps) {
          const nx = x + dx;
          const nz = z + dz;
          const key = `${nx},${nz}`;
          if (!passable(nx, nz) || seen.has(key)) continue;
          seen.add(key);
          queue.push({ x: nx, z: nz });
        }
      }

      let floorTileCount = 0;
      for (let z = 0; z < level.dungeon.height; z++) {
        for (let x = 0; x < level.dungeon.width; x++) {
          if (passable(x, z)) floorTileCount++;
        }
      }
      expect(seen.size, level.id).toBe(floorTileCount);

      const unreachableSpawns = level.entities.filter((s) => !seen.has(`${s.x},${s.z}`));
      expect(unreachableSpawns, `${level.id}: ${JSON.stringify(unreachableSpawns)}`).toEqual([]);
    }
  });
});
