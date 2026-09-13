import { describe, expect, it } from "vitest";
import { DungeonMap } from "../DungeonMap";
import { Player } from "../Player";
import { SeededRng } from "../Rng";
import { Monster } from "./Monster";

const OPEN_MAP = new DungeonMap([
  "#########",
  "#.......#",
  "#.......#",
  "#.......#",
  "#########",
]);

function newMonster(overrides: Partial<{ x: number; z: number; detectionRadius: number; player: Player }> = {}) {
  const player = overrides.player ?? new Player(1, 1, 1, 2, 1);
  const monster = new Monster(
    {
      name: "Rot-thing",
      x: overrides.x ?? 5,
      z: overrides.z ?? 2,
      patrolPoints: [
        { x: 5, z: 2 },
        { x: 6, z: 2 },
      ],
      detectionRadius: overrides.detectionRadius ?? 2,
      maxHp: 10,
      might: 3,
      initiativeStat: 4,
    },
    OPEN_MAP,
    player,
  );
  return { monster, player };
}

describe("Monster", () => {
  it("is not alerted or down at creation", () => {
    const { monster } = newMonster();
    expect(monster.isAlerted).toBe(false);
    expect(monster.isDown).toBe(false);
  });

  it("patrols back and forth between its patrol points while unaware", () => {
    // Starts exactly on patrol point 0, so the first tick at each point
    // just advances which point it's walking toward -- movement happens
    // on the tick after that.
    const { monster } = newMonster({ x: 5, z: 2, detectionRadius: 0, player: new Player(1, 1, 1, 2, 1) });
    monster.tick();
    expect([monster.x, monster.z]).toEqual([5, 2]);
    monster.tick(); // walks toward point 1
    expect([monster.x, monster.z]).toEqual([6, 2]);
    monster.tick(); // arrived; advances target back to point 0
    expect([monster.x, monster.z]).toEqual([6, 2]);
    monster.tick(); // walks back toward point 0
    expect([monster.x, monster.z]).toEqual([5, 2]);
  });

  it("becomes alerted once the party is within its detection radius", () => {
    const player = new Player(5, 4, 1, 2, 1); // 2 tiles from (5,2): within radius 2
    const { monster } = newMonster({ x: 5, z: 2, detectionRadius: 2, player });
    monster.tick();
    expect(monster.isAlerted).toBe(true);
  });

  it("stays unaware outside its detection radius", () => {
    const player = new Player(1, 1, 1, 2, 1); // far from (5,2)
    const { monster } = newMonster({ x: 5, z: 2, detectionRadius: 1, player });
    monster.tick();
    expect(monster.isAlerted).toBe(false);
  });

  it("closes in on the party once alerted, if not already adjacent", () => {
    const player = new Player(5, 4, 1, 2, 1); // 2 tiles from the monster at (5,2)
    const { monster } = newMonster({ x: 5, z: 2, detectionRadius: 5, player });
    monster.tick(); // notices, and since still 2 tiles away, steps toward the player
    expect(monster.isAlerted).toBe(true);
    expect([monster.x, monster.z]).toEqual([5, 3]);
  });

  it("stops closing in once adjacent to the party (ready for combat, not stacking on its tile)", () => {
    const player = new Player(5, 1, 1, 2, 1); // already adjacent to the monster at (5,2)
    const { monster } = newMonster({ x: 5, z: 2, detectionRadius: 5, player });
    monster.tick(); // becomes alerted, but distance is already 1 -- stays put
    expect(monster.isAlerted).toBe(true);
    expect([monster.x, monster.z]).toEqual([5, 2]);
    monster.tick(); // still adjacent -- still doesn't move onto the party's tile
    expect([monster.x, monster.z]).toEqual([5, 2]);
  });

  it("does nothing once defeated", () => {
    const player = new Player(5, 1, 1, 2, 1);
    const { monster } = newMonster({ x: 5, z: 2, detectionRadius: 5, player });
    monster.takeDamage(999);
    expect(monster.isDown).toBe(true);
    monster.tick();
    expect([monster.x, monster.z]).toEqual([5, 2]); // unchanged
  });

  it("disengage clears alert state, so it won't immediately re-chase after a fled encounter", () => {
    const player = new Player(5, 1, 1, 2, 1);
    const { monster } = newMonster({ x: 5, z: 2, detectionRadius: 5, player });
    monster.tick(); // becomes alerted
    expect(monster.isAlerted).toBe(true);

    monster.disengage();

    expect(monster.isAlerted).toBe(false);
  });

  it("takeDamage never drops HP below zero", () => {
    const { monster } = newMonster();
    monster.takeDamage(9999);
    expect(monster.hp).toBe(0);
  });

  describe("takeCombatTurn", () => {
    it("alternates a lighter hit and a telegraphed heavy strike", () => {
      const { monster } = newMonster();
      const rng = new SeededRng(1);

      const first = monster.takeCombatTurn(rng);
      const second = monster.takeCombatTurn(rng);
      const third = monster.takeCombatTurn(rng);

      expect(first.message).toContain("rears back");
      expect(second.message).toContain("heavy strike");
      expect(third.message).toContain("rears back");
      // The heavy strike is meaningfully bigger than the lighter hit.
      expect(second.damage).toBeGreaterThan(first.damage);
    });
  });
});
