import { describe, expect, it } from "vitest";
import type { DamageType } from "./combat/DamageType";
import { applyResistance } from "./combat/DamageType";
import { DungeonMap } from "./DungeonMap";
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
});
