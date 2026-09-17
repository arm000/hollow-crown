import { describe, expect, it } from "vitest";
import { DungeonMap } from "../DungeonMap";
import { Player } from "../Player";
import { buildMonsters } from "./bestiary";
import { describeMonster } from "./BestiaryEntry";

const OPEN_MAP = new DungeonMap(["#####", "#...#", "#...#", "#...#", "#####"]);

function monsterOf(type: "rotThing" | "cinderWretch" | "screechingWraith" | "courtAlchemist" | "armoredSentinel") {
  return buildMonsters(
    [{ type, x: 1, z: 1, patrolPoints: [{ x: 1, z: 1 }] }],
    OPEN_MAP,
    new Player(1, 1, 1, 2, 1),
  )[0];
}

describe("describeMonster", () => {
  it("a Rot-thing has no resistances, no inflicted status, no self-heal, and no reach", () => {
    const entry = describeMonster(monsterOf("rotThing"));
    expect(entry.name).toBe("Rot-thing");
    expect(entry.resistances).toEqual([]);
    expect(entry.inflicts).toBeUndefined();
    expect(entry.healsOnHeavyTurn).toBeUndefined();
    expect(entry.hasReach).toBeUndefined();
  });

  it("an Armored Sentinel's entry carries hasReach", () => {
    expect(describeMonster(monsterOf("armoredSentinel")).hasReach).toBe(true);
  });

  it("a Cinder Wretch lists exactly its non-neutral resistances", () => {
    const entry = describeMonster(monsterOf("cinderWretch"));
    expect(entry.resistances).toEqual(
      expect.arrayContaining([
        { damageType: "physical", multiplier: 0.5 },
        { damageType: "fire", multiplier: 2 },
      ]),
    );
    expect(entry.resistances).toHaveLength(2); // no neutral entries included
  });

  it("a Screeching Wraith's entry names Fear", () => {
    expect(describeMonster(monsterOf("screechingWraith")).inflicts).toBe("fear");
  });

  it("a Court Alchemist's entry carries its self-heal amount", () => {
    expect(describeMonster(monsterOf("courtAlchemist")).healsOnHeavyTurn).toBeGreaterThan(0);
  });
});
