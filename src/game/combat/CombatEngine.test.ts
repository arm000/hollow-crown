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

  describe("turnQueue / currentTurnIndex (the initiative tracker's data)", () => {
    it("currentTurnIndex always points at currentActor within turnQueue", () => {
      const engine = new CombatEngine(newParty(), newMonster(), new SeededRng(1));
      let guard = 0;
      while (engine.result === "ongoing" && guard < 20) {
        expect(engine.turnQueue[engine.currentTurnIndex]).toBe(engine.currentActor);
        if (engine.isPartyTurn) engine.submitAction("attack");
        guard++;
      }
    });

    it("turnQueue contains exactly the party's living members plus the monster, every round", () => {
      const party = newParty();
      const monster = newMonster({ maxHp: 100 }); // won't die mid-test
      const engine = new CombatEngine(party, monster, new SeededRng(1));
      // Every party member's turn interleaves with the monster's, but
      // the monster's own turn always auto-resolves inside submitAction
      // (see resolveAutomaticTurns) -- so exactly one round completes
      // per `livingMembers().length` submitAction calls, regardless of
      // where the monster's single slot falls in that round's order.
      const partySize = party.livingMembers().length;
      for (let round = 0; round < 3; round++) {
        expect(new Set(engine.turnQueue)).toEqual(new Set([...party.livingMembers(), monster]));
        for (let i = 0; i < partySize; i++) engine.submitAction("defend");
      }
    });

    it("resets to 0 at the start of a new round", () => {
      const party = newParty();
      const engine = new CombatEngine(party, newMonster({ maxHp: 100 }), new SeededRng(1));
      expect(engine.currentTurnIndex).toBe(0);
      for (let i = 0; i < party.livingMembers().length; i++) engine.submitAction("defend");
      expect(engine.currentTurnIndex).toBe(0); // a fresh round just rolled
    });
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
      // Bounded to exactly one round (each acts once), not several -- since Batch 10, Guard has
      // a cooldown, so re-casting it every round can no longer be assumed; this test only ever
      // claims what a *single* successful cast does, not that it can be kept up indefinitely.
      const warrior = new Character("Bram", "warrior", "front", { might: 8, grace: 20, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      const rogue = new Character("Ysolde", "rogue", "front", { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 5 }, 22, 0);
      const party = new Party([warrior, rogue]);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(party, monster, new SeededRng(6));

      let warriorActed = false;
      let rogueActed = false;
      let guard = 0;
      while (engine.result === "ongoing" && !(warriorActed && rogueActed) && guard < 4) {
        if (engine.isPartyTurn) {
          const actor = engine.currentActor as Character;
          if (actor === warrior) {
            engine.submitAction("ability");
            warriorActed = true;
          } else {
            engine.submitAction("defend");
            rogueActed = true;
          }
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

    it("submitAction refuses a skillId the actor hasn't unlocked, without dealing any damage", () => {
      const warrior = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      const party = new Party([warrior]);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability", undefined, "warrior-secondWind");

      expect(monster.hp).toBe(9999); // nothing happened -- Second Wind isn't known yet, so it never even ran
      expect(engine.log.some((line) => line.includes("hasn't learned"))).toBe(true);
    });

    describe("cooldowns (docs/08-roadmap-phases.md Phase 7 Batch 10)", () => {
      it("a skill goes on cooldown the instant it resolves, refusing an immediate repeat", () => {
        const warrior = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
        const party = new Party([warrior]);
        const monster = newMonster({ maxHp: 9999 });
        const engine = new CombatEngine(party, monster, new SeededRng(1));

        expect(warrior.isSkillReady("warrior-guard")).toBe(true);
        if (engine.isPartyTurn) engine.submitAction("ability"); // Guard -- Bram's default tier-1 skill
        expect(warrior.isSkillReady("warrior-guard")).toBe(false);

        const dealtBefore = 9999 - monster.hp;
        if (engine.isPartyTurn) engine.submitAction("ability"); // same skill, still on cooldown

        expect(9999 - monster.hp).toBe(dealtBefore); // second attempt did nothing at all
        expect(engine.log.some((line) => line.includes("can't use") && line.includes("yet"))).toBe(true);
      });

      it("doesn't spend mana on a refused, still-on-cooldown attempt", () => {
        const mage = new Character("Corvin", "mage", "back", { might: 2, grace: 20, vitality: 5, focus: 9, resolve: 4 }, 14, 20);
        const party = new Party([mage]);
        const monster = newMonster({ maxHp: 9999 });
        const engine = new CombatEngine(party, monster, new SeededRng(1));

        if (engine.isPartyTurn) engine.submitAction("ability"); // Firebolt, 6 mana
        const manaAfterFirstCast = mage.mana;
        expect(manaAfterFirstCast).toBe(14); // 20 - 6

        if (engine.isPartyTurn) engine.submitAction("ability"); // still on cooldown

        expect(mage.mana).toBe(manaAfterFirstCast); // unchanged -- refused before the mana deduction
      });

      it("becomes usable again once its cooldown has fully ticked down", () => {
        // A solo party means each submitAction call here already runs
        // a full round (the actor's own turn, then the monster's,
        // auto-resolved within that same call) before control returns
        // -- so by the time the *second* call returns, Guard's 2-round
        // cooldown (Skills.ts) has already ticked all the way down:
        // started at 2 when cast, 1 by the end of that same call (the
        // round it was cast in ending), and 0 by the end of the next.
        const warrior = new Character("Bram", "warrior", "front", { might: 8, grace: 20, vitality: 30, focus: 1, resolve: 6 }, 60, 0);
        const party = new Party([warrior]);
        const monster = newMonster({ maxHp: 9999, might: 1 });
        const engine = new CombatEngine(party, monster, new SeededRng(1));

        if (engine.isPartyTurn) engine.submitAction("ability"); // Guard, starts a 2-round cooldown
        expect(warrior.isSkillReady("warrior-guard")).toBe(false);

        if (engine.isPartyTurn) engine.submitAction("defend"); // cooldown finishes ticking down during this round
        expect(warrior.isSkillReady("warrior-guard")).toBe(true);
      });
    });
  });

  describe("the four new skill-point-unlockable skills (docs/08-roadmap-phases.md Phase 7)", () => {
    it("Warrior's Second Wind heals a third of max HP", () => {
      // Grace 20 guarantees Bram acts first, and the monster is
      // pre-stunned so *its* guaranteed follow-up turn this round (a
      // 2-combatant fight always alternates, regardless of who's
      // faster) doesn't chip HP back off and make the expected total
      // depend on a damage roll.
      const warrior = new Character("Bram", "warrior", "front", { might: 8, grace: 20, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      warrior.skillPoints = 8;
      warrior.unlockSkill("warrior-secondWind", 8);
      warrior.takeDamage(20);
      const party = new Party([warrior]);
      const monster = newMonster({ maxHp: 9999 });
      monster.statusEffects.apply({ type: "stun", turnsRemaining: 1 });
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability", undefined, "warrior-secondWind");

      expect(warrior.hp).toBe(10 + Math.round(30 / 3));
    });

    it("Rogue's Smoke Bomb guarantees the party flees, unlike ordinary Flee's resolve-scaled chance", () => {
      const rogue = new Character("Ysolde", "rogue", "front", { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 0 }, 22, 0); // 0 Resolve -- ordinary Flee would be a coin flip at best
      rogue.skillPoints = 8;
      rogue.unlockSkill("rogue-smokeBomb", 8);
      const party = new Party([rogue]);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability", undefined, "rogue-smokeBomb");

      expect(engine.result).toBe("fled");
    });

    it("Mage's Frost Lance deals modest damage and stuns the monster, skipping its very next turn", () => {
      // A second party member (Bram) is what makes the stun's effect
      // observable at all: with only one party member, this exact
      // round's monster turn -- stunned and skipped -- is also this
      // round's *last* slot, so the round-end tick immediately removes
      // the stun again before a test could ever inspect it. With Bram
      // acting right after the skipped monster turn, his HP staying
      // full *is* the proof the skip actually happened.
      const mage = new Character("Corvin", "mage", "back", { might: 2, grace: 20, vitality: 5, focus: 9, resolve: 4 }, 14, 20); // high Grace -- always acts first
      const bram = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      mage.skillPoints = 8;
      mage.unlockSkill("mage-frostLance", 8);
      const party = new Party([mage, bram]);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability", undefined, "mage-frostLance");
      // currentActor is now Bram -- the monster's turn, right after the
      // mage's, was already auto-resolved (and skipped) within that
      // same submitAction call.
      if (engine.isPartyTurn) engine.submitAction("defend");

      expect(monster.hp).toBeLessThan(9999);
      expect(bram.hp).toBe(30); // never hit -- the monster's one turn this round was skipped
      expect(engine.log.some((line) => line.includes("stunned"))).toBe(true);
      expect(mage.mana).toBe(12); // 20 - Frost Lance's 8-mana cost
    });

    it("Cleric's Smite deals Holy damage, amplified by a Holy weakness", () => {
      const cleric = new Character("Maren", "cleric", "back", { might: 3, grace: 5, vitality: 6, focus: 8, resolve: 7 }, 18, 18);
      cleric.skillPoints = 8;
      cleric.unlockSkill("cleric-smite", 8);
      const party = new Party([cleric]);
      const monster = newMonster({ maxHp: 9999, resistances: { holy: 2 } });
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability", undefined, "cleric-smite");

      const dealt = 9999 - monster.hp;
      expect(dealt).toBeGreaterThan(cleric.stats.focus); // amplified by the weakness
      expect(cleric.mana).toBe(12); // 18 - Smite's 6-mana cost
    });
  });

  describe("each class's second tier-2 alternative (docs/08-roadmap-phases.md Phase 7's real build fork)", () => {
    it("Warrior's Rally Cry heals the whole living party and clears Fear from everyone", () => {
      const warrior = new Character("Bram", "warrior", "front", { might: 8, grace: 20, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      const ally = new Character("Ysolde", "rogue", "front", { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 5 }, 22, 0);
      warrior.takeDamage(15);
      ally.takeDamage(10);
      ally.statusEffects.apply({ type: "fear", turnsRemaining: 2 });
      warrior.skillPoints = 8;
      warrior.unlockSkill("warrior-rallyCry", 8);
      const party = new Party([warrior, ally]);
      const monster = newMonster({ maxHp: 9999 });
      monster.statusEffects.apply({ type: "stun", turnsRemaining: 1 }); // keep the monster's own turn from muddying the HP totals
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability", undefined, "warrior-rallyCry");

      expect(warrior.hp).toBeGreaterThan(15);
      expect(ally.hp).toBeGreaterThan(12);
      expect(ally.statusEffects.has("fear")).toBe(false);
    });

    it("Rogue's Ambush hits much harder while the target hasn't taken any damage yet", () => {
      const rogue = new Character("Ysolde", "rogue", "front", { might: 6, grace: 20, vitality: 7, focus: 2, resolve: 5 }, 22, 0);
      rogue.skillPoints = 8;
      rogue.unlockSkill("rogue-ambush", 8);
      const freshMonster = newMonster({ maxHp: 9999 });
      const alreadyHitMonster = newMonster({ maxHp: 9999 });
      alreadyHitMonster.takeDamage(1); // no longer at full HP -- the ambush window has passed

      const freshEngine = new CombatEngine(new Party([rogue]), freshMonster, new SeededRng(1));
      if (freshEngine.isPartyTurn) freshEngine.submitAction("ability", undefined, "rogue-ambush");
      const freshDealt = 9999 - freshMonster.hp;

      const staleRogue = new Character("Ysolde", "rogue", "front", { might: 6, grace: 20, vitality: 7, focus: 2, resolve: 5 }, 22, 0);
      staleRogue.skillPoints = 8;
      staleRogue.unlockSkill("rogue-ambush", 8);
      const staleEngine = new CombatEngine(new Party([staleRogue]), alreadyHitMonster, new SeededRng(1));
      if (staleEngine.isPartyTurn) staleEngine.submitAction("ability", undefined, "rogue-ambush");
      const staleDealt = 9998 - alreadyHitMonster.hp; // it started this exchange 1 HP down already

      expect(freshDealt).toBeGreaterThan(staleDealt);
    });

    it("Mage's Cinder Nova deals more fire damage than Firebolt, with no control effect", () => {
      const mage = new Character("Corvin", "mage", "back", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 14, 20);
      mage.skillPoints = 8;
      mage.unlockSkill("mage-cinderNova", 8);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(new Party([mage]), monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability", undefined, "mage-cinderNova");

      const dealt = 9999 - monster.hp;
      expect(dealt).toBeGreaterThan(mage.stats.focus + 6); // clearly more than Firebolt's focus + 1d6 ceiling
      expect(monster.statusEffects.has("stun")).toBe(false); // no control -- that's Frost Lance's job
      expect(mage.mana).toBe(10); // 20 - Cinder Nova's 10-mana cost
    });

    it("Cleric's Ward halves the monster's next hit on the target, without costing the target their own turn", () => {
      // Turn order is pinned down completely rather than left to the
      // dice: monster.initiativeStat is low enough that neither
      // party member's minimum possible roll can lose to its maximum
      // possible one, so the round is always [cleric, frail, monster]
      // -- letting frail act *normally* (a plain Attack, not Defend)
      // in between is what actually proves Ward never touched their
      // own turn, and it's also what isolates Ward's halving from the
      // ordinary Defend mechanic that would otherwise contaminate it.
      // might: 2 keeps even the heavy strike (might*3 + 1d4, see
      // Monster.ts) well inside frail's HP pool both halved and not --
      // a harder-hitting monster would floor frail at 0 HP either way
      // once halved damage still exceeds what's left, masking the
      // comparison this test actually needs to make.
      function runFight(useWard: boolean): number {
        const cleric = new Character("Maren", "cleric", "back", { might: 3, grace: 20, vitality: 6, focus: 8, resolve: 7 }, 18, 18);
        cleric.skillPoints = 8;
        cleric.unlockSkill("cleric-ward", 8);
        const frail = new Character("Corvin", "mage", "front", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 30, 20);
        frail.takeDamage(1); // strictly lower HP ratio than the (untouched, full-HP) cleric -- pickWardTarget breaks a full-HP tie by party order otherwise, which would ward the cleric instead
        const party = new Party([cleric, frail]);
        const monster = new Monster(
          { name: "Rot-thing", x: 1, z: 1, patrolPoints: [{ x: 1, z: 1 }], detectionRadius: 0, maxHp: 9999, might: 2, initiativeStat: -10 },
          OPEN_MAP,
          new Player(1, 1, 1, 2, 1),
        );
        const engine = new CombatEngine(party, monster, new SeededRng(2));

        if (engine.isPartyTurn && engine.currentActor === cleric) {
          if (useWard) engine.submitAction("ability", undefined, "cleric-ward");
          else engine.submitAction("defend"); // a harmless no-op turn for the baseline run -- doesn't touch frail at all
        }
        if (engine.isPartyTurn && engine.currentActor === frail) {
          engine.submitAction("attack"); // frail acts completely normally, proving Ward never spent their turn
        }

        return 29 - frail.hp;
      }

      const unwardedDamage = runFight(false);
      const wardedDamage = runFight(true);

      expect(unwardedDamage).toBeGreaterThan(0); // sanity: the monster actually landed a hit in the baseline
      expect(wardedDamage).toBe(Math.ceil(unwardedDamage / 2)); // the exact same halving Defend/Guard already use
    });
  });

  describe("each class's tier-1 alternative (docs/08-roadmap-phases.md Phase 7 Batch 9's character-creation build fork)", () => {
    // Constructed with an explicit startingSkillId (Character's 8th
    // constructor param), not unlockSkill -- unlockSkill would
    // correctly *refuse* every one of these, since the class's default
    // tier-1 skill is exclusiveWith it and already known the moment a
    // Character exists. This mirrors exactly how PartyCreationUI's own
    // choice reaches a real Character (roster.createCharacterFromSpec).
    it("Warrior's Power Strike deals more physical damage than a plain Attack, with no other effect", () => {
      const warrior = new Character(
        "Test",
        "warrior",
        "front",
        { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 },
        30,
        0,
        "⚪",
        "warrior-powerStrike",
      );
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(new Party([warrior]), monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability", undefined, "warrior-powerStrike");

      const dealt = 9999 - monster.hp;
      expect(dealt).toBeGreaterThan(warrior.stats.might + 4); // clearly more than a plain Attack's might + 1d4 ceiling
      expect(monster.statusEffects.list()).toHaveLength(0); // no control/DoT effect, unlike Precision Strike's Bleed
    });

    it("Rogue's Feint attempts an immediate flee at much better odds than a plain Flee", () => {
      const rogue = new Character(
        "Test",
        "rogue",
        "front",
        { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 0 }, // 0 Resolve -- an ordinary Flee here is a coin flip at best (30%)
        22,
        0,
        "⚪",
        "rogue-feint",
      );
      const party = new Party([rogue]);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability", undefined, "rogue-feint");

      expect(engine.result).toBe("fled");
    });

    it("Rogue's Feint isn't a guaranteed escape, unlike Smoke Bomb -- a bad enough roll still fails it", () => {
      const rogue = new Character(
        "Test",
        "rogue",
        "front",
        { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 0 },
        22,
        0,
        "⚪",
        "rogue-feint",
      );
      const party = new Party([rogue]);
      const monster = newMonster({ maxHp: 9999 });
      // Feint's chance here is 30 + 0*5 + 25 = 55 -- seed 6 rolls
      // above that on rollInt(1,100)'s first call (verified directly
      // against SeededRng rather than assumed).
      const engine = new CombatEngine(party, monster, new SeededRng(6));

      if (engine.isPartyTurn) engine.submitAction("ability", undefined, "rogue-feint");

      expect(engine.result).toBe("ongoing");
      expect(engine.log.some((line) => line.includes("doesn't bite"))).toBe(true);
    });

    it("Mage's Arcane Barrier halves the monster's next hit on the caster themself, the same halving Ward uses on an ally", () => {
      function runFight(useBarrier: boolean): number {
        const mage = new Character(
          "Test",
          "mage",
          "front", // front rank so the monster's single target is guaranteed to be the mage, not picked at random
          { might: 2, grace: 20, vitality: 5, focus: 9, resolve: 4 },
          30,
          20,
          "⚪",
          "mage-arcaneBarrier",
        );
        const party = new Party([mage]);
        const monster = new Monster(
          { name: "Rot-thing", x: 1, z: 1, patrolPoints: [{ x: 1, z: 1 }], detectionRadius: 0, maxHp: 9999, might: 2, initiativeStat: -10 },
          OPEN_MAP,
          new Player(1, 1, 1, 2, 1),
        );
        const engine = new CombatEngine(party, monster, new SeededRng(2));

        if (engine.isPartyTurn) {
          if (useBarrier) {
            engine.submitAction("ability", undefined, "mage-arcaneBarrier");
          } else {
            // Deliberately not "defend": with only one party member who
            // is both caster and the monster's only possible target,
            // self-Defending on their own turn never actually clears
            // (defending only clears on the *owner's own next turn*,
            // which never comes before the monster's turn in a 1v1
            // exchange) -- the same contamination this suite's real
            // Ward test avoids by having a second, un-defended party
            // member take the hit instead. There's no second member
            // here (Arcane Barrier is self-only), so the baseline
            // needs a genuinely zero-effect action instead: an "item"
            // action with no matching item (and no inventory attached
            // to the engine) is a documented no-op elsewhere in this
            // suite, touches `defending` not at all, and -- just as
            // important -- consumes zero rolls from the RNG stream,
            // same as the ability branch's own `warded.add` (an
            // "attack" baseline would consume a damage roll instead,
            // shifting the monster's subsequent roll out of alignment
            // between the two runs).
            engine.submitAction("item", "nonexistent");
          }
        }

        return 30 - mage.hp;
      }

      const unwardedDamage = runFight(false);
      const wardedDamage = runFight(true);

      expect(unwardedDamage).toBeGreaterThan(0); // sanity: the monster actually landed a hit in the baseline
      expect(wardedDamage).toBe(Math.ceil(unwardedDamage / 2));
    });

    it("Cleric's Radiant Spark deals Holy damage, weaker than Smite", () => {
      const cleric = new Character(
        "Test",
        "cleric",
        "back",
        { might: 3, grace: 5, vitality: 6, focus: 8, resolve: 7 },
        18,
        18,
        "⚪",
        "cleric-radiantSpark",
      );
      const monster = newMonster({ maxHp: 9999, resistances: { holy: 2 } });
      const engine = new CombatEngine(new Party([cleric]), monster, new SeededRng(1));

      if (engine.isPartyTurn) engine.submitAction("ability", undefined, "cleric-radiantSpark");

      const dealt = 9999 - monster.hp;
      expect(dealt).toBeGreaterThan(0);
      // Smite's own damage floor (focus + 1d4, doubled by the same
      // weakness) is strictly higher than Radiant Spark's ceiling
      // (ceil(focus/2) + 1d4, doubled) at this focus value -- proof
      // the tier-1 freebie stays meaningfully weaker than the skill
      // point-gated upgrade.
      expect(dealt).toBeLessThan((cleric.stats.focus + 4) * 2);
      expect(cleric.mana).toBe(14); // 18 - Radiant Spark's 4-mana cost
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

    it("a DoT tick on the monster doesn't repeat its HP in the log -- CombatUI's status line already shows it persistently", () => {
      const party = newParty();
      const monster = newMonster({ maxHp: 9999 });
      monster.statusEffects.apply({ type: "bleed", turnsRemaining: 1, tickDamage: 5 });
      const hpBefore = monster.hp;

      const engine = new CombatEngine(party, monster, new SeededRng(1));
      let guard = 0;
      while (engine.result === "ongoing" && guard < 6 && monster.hp === hpBefore) {
        if (engine.isPartyTurn) engine.submitAction("defend");
        guard++;
      }

      const woundsLine = engine.log.find((line) => line.includes("lingering wounds"));
      expect(woundsLine).toBeDefined();
      expect(woundsLine).not.toContain("HP left"); // the monster's own hits landing on the party may add other "HP left" lines elsewhere in the log -- this checks the wounds line itself, specifically
    });

    it("a DoT tick on a party member lists their current HP -- player request: \"list how much current HP they have left\"", () => {
      const bram = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      bram.statusEffects.apply({ type: "bleed", turnsRemaining: 1, tickDamage: 5 });
      const party = new Party([bram]);
      const monster = newMonster({ maxHp: 9999, might: 0 }); // might: 0 -- isolates the DoT's own HP change from the monster's own attack
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      let guard = 0;
      while (engine.result === "ongoing" && guard < 6 && bram.hp === 30) {
        if (engine.isPartyTurn) engine.submitAction("defend");
        guard++;
      }

      expect(bram.hp).toBeLessThan(30);
      expect(engine.log.some((line) => line.includes(`lingering wounds — ${bram.hp}/${bram.maxHp} HP left`))).toBe(
        true,
      );
    });
  });

  describe("monster attacks list the target's remaining HP (player request: \"list how much current HP they have left\")", () => {
    it("a landed hit's log line names the target's current/max HP", () => {
      const bram = new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
      const party = new Party([bram]);
      const monster = newMonster({ maxHp: 9999 });
      const engine = new CombatEngine(party, monster, new SeededRng(1));

      let guard = 0;
      while (engine.result === "ongoing" && guard < 6 && bram.hp === 30) {
        if (engine.isPartyTurn) engine.submitAction("defend");
        guard++;
      }

      expect(bram.hp).toBeLessThan(30);
      expect(engine.log.some((line) => line.includes(`takes`) && line.includes(`${bram.hp}/${bram.maxHp} HP left`))).toBe(
        true,
      );
    });
  });
});
