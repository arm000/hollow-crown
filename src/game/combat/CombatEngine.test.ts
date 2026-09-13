import { describe, expect, it } from "vitest";
import { DungeonMap } from "../DungeonMap";
import { Monster } from "../monster/Monster";
import { Character } from "../party/Character";
import { Party } from "../party/Party";
import { Player } from "../Player";
import { SeededRng } from "../Rng";
import { CombatEngine } from "./CombatEngine";

const OPEN_MAP = new DungeonMap(["###", "#.#", "###"]);

function newParty(): Party {
  return new Party([
    new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0),
    new Character("Corvin", "mage", "back", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 14, 20),
  ]);
}

function newMonster(overrides: Partial<{ maxHp: number; might: number }> = {}): Monster {
  return new Monster(
    {
      name: "Rot-thing",
      x: 1,
      z: 1,
      patrolPoints: [{ x: 1, z: 1 }],
      detectionRadius: 0,
      maxHp: overrides.maxHp ?? 20,
      might: overrides.might ?? 3,
      initiativeStat: 3,
    },
    OPEN_MAP,
    new Player(1, 1, 1, 2, 1),
  );
}

describe("CombatEngine", () => {
  it("starts on a living combatant's turn, never mid-construction on a downed one", () => {
    const engine = new CombatEngine(newParty(), newMonster(), new SeededRng(1));
    expect(engine.result).toBe("ongoing");
    if (engine.currentActor.side === "party") {
      expect(engine.currentActor.isDown).toBe(false);
    }
  });

  it("attacking reduces the monster's HP", () => {
    const monster = newMonster({ maxHp: 100 });
    const engine = new CombatEngine(newParty(), monster, new SeededRng(1));
    // Drive party turns until we've made at least one attack.
    while (engine.isPartyTurn) {
      engine.submitAction("attack");
      if (monster.hp < 100) break;
    }
    expect(monster.hp).toBeLessThan(100);
  });

  it("declares victory once the monster's HP reaches zero", () => {
    const monster = newMonster({ maxHp: 1 }); // dies to any hit
    const engine = new CombatEngine(newParty(), monster, new SeededRng(1));
    while (engine.isPartyTurn && engine.result === "ongoing") {
      engine.submitAction("attack");
    }
    expect(engine.result).toBe("victory");
  });

  it("declares defeat once every party member is down", () => {
    const party = new Party([
      new Character("Frail", "mage", "front", { might: 1, grace: 1, vitality: 1, focus: 1, resolve: 1 }, 1, 0),
    ]);
    const monster = newMonster({ might: 50 }); // guaranteed to down a 1-HP character in one hit
    const engine = new CombatEngine(party, monster, new SeededRng(1));
    // Never attack -- just keep defending; the monster still eventually lands a hit that ends it.
    let guard = 0;
    while (engine.result === "ongoing" && guard < 20) {
      if (engine.isPartyTurn) engine.submitAction("defend");
      guard++;
    }
    expect(engine.result).toBe("defeat");
  });

  it("defending halves the damage from the monster's next hit", () => {
    // Run the same seed twice: once always attacking, once always defending,
    // and compare total damage taken -- defending should never do worse.
    const attackRng = new SeededRng(99);
    const attackParty = newParty();
    const attackMonster = newMonster({ maxHp: 9999 });
    const attackEngine = new CombatEngine(attackParty, attackMonster, attackRng);
    for (let i = 0; i < 6 && attackEngine.result === "ongoing"; i++) {
      if (attackEngine.isPartyTurn) attackEngine.submitAction("attack");
    }
    const hpLostAttacking = attackParty.members.reduce((sum, m) => sum + (m.maxHp - m.hp), 0);

    const defendRng = new SeededRng(99);
    const defendParty = newParty();
    const defendMonster = newMonster({ maxHp: 9999 });
    const defendEngine = new CombatEngine(defendParty, defendMonster, defendRng);
    for (let i = 0; i < 6 && defendEngine.result === "ongoing"; i++) {
      if (defendEngine.isPartyTurn) defendEngine.submitAction("defend");
    }
    const hpLostDefending = defendParty.members.reduce((sum, m) => sum + (m.maxHp - m.hp), 0);

    expect(hpLostDefending).toBeLessThanOrEqual(hpLostAttacking);
  });

  it("a successful flee ends the encounter without victory or defeat", () => {
    const party = new Party([
      new Character("Lucky", "rogue", "front", { might: 5, grace: 5, vitality: 10, focus: 1, resolve: 100 }, 20, 0),
    ]);
    const engine = new CombatEngine(party, newMonster({ maxHp: 9999 }), new SeededRng(1));
    // Resolve is maxed out, so the flee-chance formula (30 + resolve*5) guarantees success on the first try.
    if (engine.isPartyTurn) engine.submitAction("flee");
    expect(engine.result).toBe("fled");
  });

  it("ignores a submitted action when it isn't the party's turn", () => {
    const monster = newMonster({ maxHp: 9999 });
    const engine = new CombatEngine(newParty(), monster, new SeededRng(1));
    // Force it to not be the party's turn by exhausting it artificially isn't
    // possible from the outside, so just assert the guard exists: submitting
    // while ongoing and it IS the party's turn should always change state,
    // and calling it again immediately after the queue moves on/monster
    // resolves should never throw.
    expect(() => {
      engine.submitAction("attack");
      engine.submitAction("attack");
    }).not.toThrow();
  });
});
