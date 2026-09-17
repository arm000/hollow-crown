import { describe, expect, it } from "vitest";
import { DungeonMap } from "../DungeonMap";
import { SeededRng } from "../Rng";
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
        { type: "screechingWraith", x: 3, z: 3, patrolPoints: [{ x: 3, z: 3 }] },
        { type: "courtAlchemist", x: 4, z: 4, patrolPoints: [{ x: 4, z: 4 }] },
        { type: "boundServant", x: 6, z: 6, patrolPoints: [{ x: 6, z: 6 }] },
        { type: "armoredSentinel", x: 7, z: 7, patrolPoints: [{ x: 7, z: 7 }] },
        { type: "stewardMarrow", x: 5, z: 5, patrolPoints: [{ x: 5, z: 5 }] },
      ],
      OPEN_MAP,
      player,
    );

    expect(monsters).toHaveLength(7);
    expect(monsters[0].name).toBe("Rot-thing");
    expect(monsters[1].name).toBe("Cinder Wretch");
    expect(monsters[1].resistances.fire).toBe(2); // the Cinder Wretch's actual identity, not a placeholder
    expect(monsters[2].name).toBe("Screeching Wraith");
    expect(monsters[3].name).toBe("Court Alchemist");
    expect(monsters[4].name).toBe("Bound Servant");
    expect(monsters[5].name).toBe("Armored Sentinel");
    expect(monsters[6].name).toBe("Steward Marrow");
  });

  it("returns an empty list for an empty spawn list", () => {
    const player = new Player(1, 1, 1, 2, 1);
    expect(buildMonsters([], OPEN_MAP, player)).toEqual([]);
  });
});

describe("createScreechingWraith", () => {
  it("its telegraphed heavy strike inflicts Fear", () => {
    const [wraith] = buildMonsters(
      [{ type: "screechingWraith", x: 1, z: 1, patrolPoints: [{ x: 1, z: 1 }] }],
      OPEN_MAP,
      new Player(1, 1, 1, 2, 1),
    );
    const rng = new SeededRng(1);

    wraith.takeCombatTurn(rng); // lighter hit
    const heavy = wraith.takeCombatTurn(rng);

    expect(heavy.statusEffect?.type).toBe("fear");
  });
});

describe("createCourtAlchemist", () => {
  it("its telegraphed heavy turn heals instead of attacking", () => {
    const [alchemist] = buildMonsters(
      [{ type: "courtAlchemist", x: 1, z: 1, patrolPoints: [{ x: 1, z: 1 }] }],
      OPEN_MAP,
      new Player(1, 1, 1, 2, 1),
    );
    const rng = new SeededRng(1);
    alchemist.takeDamage(15);
    const hpBeforeHeal = alchemist.hp;

    alchemist.takeCombatTurn(rng); // lighter hit
    const heavy = alchemist.takeCombatTurn(rng);

    expect(heavy.damage).toBe(0);
    expect(alchemist.hp).toBeGreaterThan(hpBeforeHeal);
  });
});

describe("createBoundServant", () => {
  it("has no resistance and no status effect -- the telegraph itself, turned up, is the whole lesson", () => {
    const [servant] = buildMonsters(
      [{ type: "boundServant", x: 1, z: 1, patrolPoints: [{ x: 1, z: 1 }] }],
      OPEN_MAP,
      new Player(1, 1, 1, 2, 1),
    );
    expect(servant.resistances).toEqual({});
    expect(servant.heavyStatusEffect).toBeUndefined();
    expect(servant.hasReach).toBe(false);
  });

  it("its telegraphed heavy strike deals meaningfully more damage than its light hit", () => {
    const [servant] = buildMonsters(
      [{ type: "boundServant", x: 1, z: 1, patrolPoints: [{ x: 1, z: 1 }] }],
      OPEN_MAP,
      new Player(1, 1, 1, 2, 1),
    );
    const rng = new SeededRng(1);
    const light = servant.takeCombatTurn(rng);
    const heavy = servant.takeCombatTurn(rng);
    expect(heavy.damage).toBeGreaterThan(light.damage);
  });
});

describe("createArmoredSentinel", () => {
  it("resists Physical and has reach -- can target any living party member, not just the front rank", () => {
    const [sentinel] = buildMonsters(
      [{ type: "armoredSentinel", x: 1, z: 1, patrolPoints: [{ x: 1, z: 1 }] }],
      OPEN_MAP,
      new Player(1, 1, 1, 2, 1),
    );
    expect(sentinel.resistances.physical).toBeLessThan(1);
    expect(sentinel.hasReach).toBe(true);
    expect(sentinel.heavyStatusEffect).toBeUndefined(); // reach is the whole mechanic, not stacked with a status too
  });
});

describe("createStewardMarrow", () => {
  it("combines the Rot-thing's telegraph, the Wraith's Fear, and a Cinder-Wretch-shaped resistance profile", () => {
    const [marrow] = buildMonsters(
      [{ type: "stewardMarrow", x: 1, z: 1, patrolPoints: [{ x: 1, z: 1 }] }],
      OPEN_MAP,
      new Player(1, 1, 1, 2, 1),
    );

    expect(marrow.resistances.physical).toBeLessThan(1); // resistant, like the Cinder Wretch
    expect(marrow.resistances.holy).toBeGreaterThan(1); // weak, but to Holy rather than Fire -- not the same trick again

    const rng = new SeededRng(1);
    marrow.takeCombatTurn(rng); // lighter hit
    expect(marrow.takeCombatTurn(rng).statusEffect?.type).toBe("fear"); // the telegraphed strike
  });
});
