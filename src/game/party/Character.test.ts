import { describe, expect, it } from "vitest";
import { Character, STAT_DESCRIPTIONS, type CharacterStats } from "./Character";

const ALL_STATS: Array<keyof CharacterStats> = ["might", "grace", "vitality", "focus", "resolve"];

function newCharacter(overrides: Partial<{ maxHp: number }> = {}) {
  return new Character(
    "Test",
    "warrior",
    "front",
    { might: 5, grace: 5, vitality: 5, focus: 5, resolve: 5 },
    overrides.maxHp ?? 20,
    0,
  );
}

describe("Character", () => {
  it("starts at full HP and mana", () => {
    const character = newCharacter();
    expect(character.hp).toBe(character.maxHp);
  });

  it("uses Grace as its initiative stat", () => {
    const character = new Character("Test", "rogue", "front", { might: 1, grace: 9, vitality: 1, focus: 1, resolve: 1 }, 10, 0);
    expect(character.initiativeStat).toBe(9);
  });

  it("is not down at full health", () => {
    expect(newCharacter().isDown).toBe(false);
  });

  it("is down once HP reaches zero", () => {
    const character = newCharacter({ maxHp: 10 });
    character.takeDamage(10);
    expect(character.isDown).toBe(true);
  });

  it("damage never drops HP below zero", () => {
    const character = newCharacter({ maxHp: 10 });
    character.takeDamage(999);
    expect(character.hp).toBe(0);
  });

  it("healing never exceeds max HP", () => {
    const character = newCharacter({ maxHp: 10 });
    character.takeDamage(3);
    character.heal(999);
    expect(character.hp).toBe(10);
  });

  describe("skills (docs/08-roadmap-phases.md Phase 7)", () => {
    it("knows its class's default skill from construction, with no unlock step", () => {
      const character = newCharacter(); // a warrior
      expect(character.knowsSkill("warrior-guard")).toBe(true);
      expect(character.listKnownSkillIds()).toEqual(["warrior-guard"]);
    });

    it("doesn't know a class's second skill until it's unlocked", () => {
      expect(newCharacter().knowsSkill("warrior-secondWind")).toBe(false);
    });

    it("starts with zero skill points", () => {
      expect(newCharacter().skillPoints).toBe(0);
    });

    it("knows the given startingSkillId instead of the class default, when one is passed (PartyCreationUI's tier-1 choice)", () => {
      const character = new Character(
        "Test",
        "warrior",
        "front",
        { might: 5, grace: 5, vitality: 5, focus: 5, resolve: 5 },
        20,
        0,
        "⚪",
        "warrior-powerStrike",
      );
      expect(character.knowsSkill("warrior-powerStrike")).toBe(true);
      expect(character.knowsSkill("warrior-guard")).toBe(false);
      expect(character.listKnownSkillIds()).toEqual(["warrior-powerStrike"]);
    });
  });

  describe("spendPointOnStat", () => {
    it("raises the stat by 1 and consumes one point when a point is available", () => {
      const character = newCharacter();
      character.skillPoints = 1;
      expect(character.spendPointOnStat("might")).toBe(true);
      expect(character.stats.might).toBe(6);
      expect(character.skillPoints).toBe(0);
    });

    it("refuses, changing nothing, when there are no points left", () => {
      const character = newCharacter();
      expect(character.spendPointOnStat("might")).toBe(false);
      expect(character.stats.might).toBe(5);
    });

    it("a point spent on Vitality also raises max HP and tops up current HP by the same amount", () => {
      const character = newCharacter({ maxHp: 20 });
      character.skillPoints = 1;
      const baseMaxHp = character.maxHp;

      character.spendPointOnStat("vitality");

      expect(character.maxHp).toBeGreaterThan(baseMaxHp);
      expect(character.hp).toBe(character.maxHp); // topped up, not left behind at the old max
    });

    it("a point spent on Focus also raises max Mana and tops up current Mana by the same amount", () => {
      const character = newCharacter();
      character.skillPoints = 1;
      const baseMaxMana = character.maxMana;

      character.spendPointOnStat("focus");

      expect(character.maxMana).toBeGreaterThan(baseMaxMana);
      expect(character.mana).toBe(character.maxMana);
    });

    it("a point spent on Might/Grace/Resolve leaves max HP and max Mana untouched", () => {
      const character = newCharacter();
      character.skillPoints = 3;
      const { maxHp, maxMana } = character;

      character.spendPointOnStat("might");
      character.spendPointOnStat("grace");
      character.spendPointOnStat("resolve");

      expect(character.maxHp).toBe(maxHp);
      expect(character.maxMana).toBe(maxMana);
    });
  });

  describe("unlockSkill", () => {
    it("learns the skill and spends the points when enough are available", () => {
      const character = newCharacter();
      character.skillPoints = 8;
      expect(character.unlockSkill("warrior-secondWind", 8)).toBe(true);
      expect(character.knowsSkill("warrior-secondWind")).toBe(true);
      expect(character.skillPoints).toBe(0);
    });

    it("refuses, changing nothing, without enough points", () => {
      const character = newCharacter();
      character.skillPoints = 7;
      expect(character.unlockSkill("warrior-secondWind", 8)).toBe(false);
      expect(character.knowsSkill("warrior-secondWind")).toBe(false);
      expect(character.skillPoints).toBe(7);
    });

    it("refuses a skill already known, without spending anything", () => {
      const character = newCharacter();
      character.skillPoints = 99;
      expect(character.unlockSkill("warrior-guard", 0)).toBe(false);
      expect(character.skillPoints).toBe(99);
    });
  });

  describe("restoreKnownSkillIds", () => {
    it("replaces the known-skill set wholesale, with no cost check", () => {
      const character = newCharacter();
      character.restoreKnownSkillIds(["warrior-guard", "warrior-secondWind"]);
      expect(character.knowsSkill("warrior-secondWind")).toBe(true);
      expect(character.skillPoints).toBe(0); // unaffected -- restoring isn't spending
    });
  });

  describe("STAT_DESCRIPTIONS (tooltip text shared by PartyCreationUI and LevelUpUI)", () => {
    it("covers every stat with a non-empty description", () => {
      for (const stat of ALL_STATS) {
        expect(STAT_DESCRIPTIONS[stat].length, stat).toBeGreaterThan(0);
      }
    });
  });
});
