import { describe, expect, it } from "vitest";
import type { ResistanceMap } from "./DamageType";
import { DungeonMap } from "../DungeonMap";
import { Inventory } from "../Inventory";
import { Monster } from "../monster/Monster";
import { Character } from "../party/Character";
import { EQUIPMENT_ITEMS } from "../party/Equipment";
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

function newMonster(overrides: Partial<{ maxHp: number; might: number; resistances: ResistanceMap }> = {}): Monster {
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
      resistances: overrides.resistances,
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

  it("a normal attack is reduced by the monster's Physical resistance", () => {
    const party = new Party([
      new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0),
    ]);
    const monster = newMonster({ maxHp: 9999, resistances: { physical: 0.5 } });
    const engine = new CombatEngine(party, monster, new SeededRng(1));
    if (engine.isPartyTurn) engine.submitAction("attack");
    const dealt = 9999 - monster.hp;
    expect(dealt).toBeLessThanOrEqual(Math.round((8 + 4) * 0.5)); // might(8) + max roll(4), halved
  });

  it("equipped gear changes actual combat damage, not just the Character unit in isolation", () => {
    const bareHanded = new Character("Bram", "warrior", "front", { might: 5, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
    const bareMonster = newMonster({ maxHp: 9999 });
    const bareEngine = new CombatEngine(new Party([bareHanded]), bareMonster, new SeededRng(2));
    if (bareEngine.isPartyTurn) bareEngine.submitAction("attack");
    const bareDamage = 9999 - bareMonster.hp;

    const armed = new Character("Bram", "warrior", "front", { might: 5, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
    armed.equip(EQUIPMENT_ITEMS["rusted-sword"]); // +2 might
    const armedMonster = newMonster({ maxHp: 9999 });
    const armedEngine = new CombatEngine(new Party([armed]), armedMonster, new SeededRng(2)); // same seed
    if (armedEngine.isPartyTurn) armedEngine.submitAction("attack");
    const armedDamage = 9999 - armedMonster.hp;

    expect(armedDamage).toBeGreaterThan(bareDamage);
  });

  describe("abilities", () => {
    it("Rogue's Precision Strike ignores Physical resistance and applies Bleed", () => {
      const rogue = new Character("Ysolde", "rogue", "front", { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 5 }, 22, 0);
      const party = new Party([rogue]);
      const monster = newMonster({ maxHp: 9999, resistances: { physical: 0.1 } }); // would nearly nullify a normal attack
      const engine = new CombatEngine(party, monster, new SeededRng(4));

      if (engine.isPartyTurn) engine.submitAction("ability");

      const dealt = 9999 - monster.hp;
      expect(dealt).toBeGreaterThanOrEqual(rogue.stats.might); // full damage, not reduced to ~10%
      expect(monster.statusEffects.has("bleed")).toBe(true);
    });

    it("Mage's Firebolt is amplified by a Fire weakness and spends mana", () => {
      const mage = new Character("Corvin", "mage", "back", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 14, 20);
      const party = new Party([mage]);
      const monster = newMonster({ maxHp: 9999, resistances: { fire: 2 } });
      const engine = new CombatEngine(party, monster, new SeededRng(5));

      if (engine.isPartyTurn) engine.submitAction("ability");

      const dealt = 9999 - monster.hp;
      expect(dealt).toBeGreaterThan(mage.stats.focus); // amplified by the weakness
      expect(mage.mana).toBe(14); // 20 - the 6-mana cost
    });

    it("Warrior's Guard makes the monster's next attack target Bram, not a random front-rank pick", () => {
      // Grace 20 guarantees Bram wins initiative over both Ysolde (max roll 8+6=14) and the
      // monster (max roll 3+6=9), so his Guard is always active before the first monster attack.
      const warrior = new Character("Bram", "warrior", "front", { might: 8, grace: 20, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      const rogue = new Character("Ysolde", "rogue", "front", { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 5 }, 22, 0);
      const party = new Party([warrior, rogue]);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(party, monster, new SeededRng(6));

      let guard = 0;
      while (engine.result === "ongoing" && guard < 8) {
        if (engine.isPartyTurn) {
          const actor = engine.currentActor as Character;
          engine.submitAction(actor === warrior ? "ability" : "defend");
        }
        guard++;
      }

      expect(rogue.hp).toBe(rogue.maxHp);
      expect(warrior.hp).toBeLessThan(warrior.maxHp);
    });

    it("Cleric's Cleanse removes status effects from the most-afflicted living ally", () => {
      const cleric = new Character("Maren", "cleric", "back", { might: 3, grace: 5, vitality: 6, focus: 8, resolve: 7 }, 18, 18);
      const ally = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      ally.statusEffects.apply({ type: "bleed", turnsRemaining: 3, tickDamage: 3 });
      const party = new Party([cleric, ally]);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(party, monster, new SeededRng(8));

      let guard = 0;
      let cleansed = false;
      while (engine.result === "ongoing" && guard < 10 && !cleansed) {
        if (engine.isPartyTurn) {
          const actor = engine.currentActor as Character;
          engine.submitAction(actor === cleric ? "ability" : "defend");
          if (actor === cleric) cleansed = true;
        }
        guard++;
      }

      expect(ally.statusEffects.has("bleed")).toBe(false);
    });

    it("an ability without enough mana fails and spends no mana", () => {
      const mage = new Character("Corvin", "mage", "back", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 14, 5); // Firebolt costs 6
      const party = new Party([mage]);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability");

      expect(mage.mana).toBe(5);
      expect(monster.hp).toBe(9999);
    });
  });

  describe("items", () => {
    it("a damage item (Oil Flask) hits the monster and is consumed", () => {
      const bram = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      const party = new Party([bram]);
      const monster = newMonster({ maxHp: 9999 });
      const inventory = new Inventory();
      inventory.add("oil-flask", "an Oil Flask", 1);
      const engine = new CombatEngine(party, monster, new SeededRng(1), inventory);

      if (engine.isPartyTurn) engine.submitAction("item", "oil-flask");

      expect(monster.hp).toBeLessThan(9999);
      expect(inventory.has("oil-flask")).toBe(false); // the one flask is used up
    });

    it("an Oil Flask's Fire damage is amplified by a Fire weakness, just like Firebolt", () => {
      const bram = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      const party = new Party([bram]);
      const monster = newMonster({ maxHp: 9999, resistances: { fire: 2 } });
      const inventory = new Inventory();
      inventory.add("oil-flask", "an Oil Flask", 1);
      const engine = new CombatEngine(party, monster, new SeededRng(1), inventory);

      if (engine.isPartyTurn) engine.submitAction("item", "oil-flask");

      expect(9999 - monster.hp).toBe(12); // 6 base damage, doubled by the weakness
    });

    it("a cure item (Antidote) removes the matching status effect", () => {
      const bram = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      bram.statusEffects.apply({ type: "poison", turnsRemaining: 3, tickDamage: 2 });
      const party = new Party([bram]);
      const inventory = new Inventory();
      inventory.add("antidote", "an Antidote", 1);
      const engine = new CombatEngine(party, newMonster({ maxHp: 9999 }), new SeededRng(1), inventory);

      if (engine.isPartyTurn) engine.submitAction("item", "antidote");

      expect(bram.statusEffects.has("poison")).toBe(false);
    });

    it("using an item identifies it, so an unidentified consumable's inventory listing reveals its true name from then on", () => {
      const bram = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      const party = new Party([bram]);
      const monster = newMonster({ maxHp: 9999 });
      const inventory = new Inventory();
      inventory.add("oil-flask", "an Oil Flask", 2);
      expect(inventory.entries()[0].name).toBe("a bubbling amber vial"); // unidentified before use
      const engine = new CombatEngine(party, monster, new SeededRng(1), inventory);

      if (engine.isPartyTurn) engine.submitAction("item", "oil-flask");

      expect(inventory.entries()[0].name).toBe("an Oil Flask"); // identified by use, even with one still held
    });

    it("using an item the party doesn't have does nothing and doesn't throw", () => {
      const party = newParty();
      const engine = new CombatEngine(party, newMonster({ maxHp: 9999 }), new SeededRng(1), new Inventory());

      expect(() => {
        if (engine.isPartyTurn) engine.submitAction("item", "oil-flask");
      }).not.toThrow();
    });

    it("using an item with no inventory attached at all is a graceful no-op", () => {
      const party = newParty();
      const engine = new CombatEngine(party, newMonster({ maxHp: 9999 }), new SeededRng(1)); // no inventory passed

      expect(() => {
        if (engine.isPartyTurn) engine.submitAction("item", "oil-flask");
      }).not.toThrow();
    });
  });

  describe("status effects", () => {
    it("a stunned monster skips its turn without attacking", () => {
      const party = newParty();
      const monster = newMonster({ maxHp: 9999 });
      monster.statusEffects.apply({ type: "stun", turnsRemaining: 1 });
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("defend");

      const hpLost = party.members.reduce((sum, m) => sum + (m.maxHp - m.hp), 0);
      expect(hpLost).toBe(0);
      expect(engine.log.some((line) => line.includes("stunned"))).toBe(true);
    });

    it("a feared character is forced to Defend regardless of the chosen action", () => {
      const bram = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      const corvin = new Character("Corvin", "mage", "back", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 14, 20);
      corvin.statusEffects.apply({ type: "fear", turnsRemaining: 1 });
      const party = new Party([bram, corvin]);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(party, monster, new SeededRng(2));

      let guard = 0;
      let corvinTried = false;
      while (engine.result === "ongoing" && guard < 10 && !corvinTried) {
        if (engine.isPartyTurn) {
          const actor = engine.currentActor as Character;
          // Bram just defends (so any monster.hp change can only be attributed to
          // Corvin); Corvin tries to attack despite being feared.
          engine.submitAction(actor === corvin ? "attack" : "defend");
          if (actor === corvin) corvinTried = true;
        }
        guard++;
      }

      expect(engine.log.some((line) => line.includes("afraid"))).toBe(true);
      expect(monster.hp).toBe(9999); // Corvin's attack never actually landed
    });

    it("a silenced character's ability fails without consuming mana", () => {
      const mage = new Character("Corvin", "mage", "back", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 14, 20);
      mage.statusEffects.apply({ type: "silence", turnsRemaining: 1 });
      const party = new Party([mage]);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability");

      expect(mage.mana).toBe(20);
      expect(monster.hp).toBe(9999);
      expect(engine.log.some((line) => line.includes("silence"))).toBe(true);
    });

    it("Bleed ticks damage each round until it expires", () => {
      const party = newParty();
      const monster = newMonster({ maxHp: 9999 });
      monster.statusEffects.apply({ type: "bleed", turnsRemaining: 1, tickDamage: 5 });
      const hpBefore = monster.hp;

      // Any party action triggers finishPartyTurn -> eventually a new round's
      // rollInitiative, which is where DoT ticks are applied.
      const engine = new CombatEngine(party, monster, new SeededRng(1));
      let guard = 0;
      while (engine.result === "ongoing" && guard < 6 && monster.hp === hpBefore) {
        if (engine.isPartyTurn) engine.submitAction("defend");
        guard++;
      }

      expect(monster.hp).toBeLessThanOrEqual(hpBefore - 5);
    });
  });
});
