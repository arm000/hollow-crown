import { describe, expect, it } from "vitest";
import { DungeonMap } from "../DungeonMap";
import { Player } from "../Player";
import { buildMonsters } from "./bestiary";

const OPEN_MAP = new DungeonMap(["#####", "#...#", "#...#", "#...#", "#####"]);

describe("buildMonsters", () => {
  it("builds one Monster per spawn, matching its type's identity", () => {
    const player = new Player(1, 1, 1, 2, 1);
    const monsters = buildMonsters(
      [
        { type: "rotThing", x: 1, z: 1, patrolPoints: [{ x: 1, z: 1 }] },
        { type: "cinderWretch", x: 2, z: 2, patrolPoints: [{ x: 2, z: 2 }] },
      ],
      OPEN_MAP,
      player,
    );

    expect(monsters).toHaveLength(2);
    expect(monsters[0].name).toBe("Rot-thing");
    expect(monsters[1].name).toBe("Cinder Wretch");
    expect(monsters[1].resistances.fire).toBe(2); // the Cinder Wretch's actual identity, not a placeholder
  });

  it("returns an empty list for an empty spawn list", () => {
    const player = new Player(1, 1, 1, 2, 1);
    expect(buildMonsters([], OPEN_MAP, player)).toEqual([]);
  });
});
