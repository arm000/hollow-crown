import { describe, expect, it } from "vitest";
import { Character } from "./Character";
import { awardPartyXp, gainXp, xpToNextLevel } from "./Leveling";
import { Party } from "./Party";
import { SKILL_POINTS_PER_LEVEL } from "./Skills";

function newWarrior(): Character {
  return new Character("Bram", "warrior", "front", { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, 30, 0);
}

function newMage(): Character {
  return new Character("Corvin", "mage", "back", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 14, 20);
}

describe("xpToNextLevel", () => {
  it("grows with level, so later levels need more XP than earlier ones", () => {
    expect(xpToNextLevel(2)).toBeGreaterThan(xpToNextLevel(1));
  });
});

describe("gainXp", () => {
  it("accumulates XP without leveling up below the threshold", () => {
    const character = newWarrior();
    gainXp(character, xpToNextLevel(1) - 1);
    expect(character.level).toBe(1);
    expect(character.xp).toBe(xpToNextLevel(1) - 1);
  });

  it("levels up once XP reaches the threshold, carrying over the remainder", () => {
    const character = newWarrior();
    const levels = gainXp(character, xpToNextLevel(1) + 5);
    expect(character.level).toBe(2);
    expect(character.xp).toBe(5);
    expect(levels).toEqual([2]);
  });

  it("grants class-flavored HP/Mana growth on level-up, plus skill points -- stats no longer grow automatically", () => {
    const warrior = newWarrior();
    const baseMight = warrior.stats.might;
    const baseMaxHp = warrior.maxHp;
    const baseSkillPoints = warrior.skillPoints;

    gainXp(warrior, xpToNextLevel(1));

    expect(warrior.stats.might).toBe(baseMight); // stat growth is now the player's choice, not automatic
    expect(warrior.maxHp).toBeGreaterThan(baseMaxHp);
    expect(warrior.hp).toBe(warrior.maxHp); // the HP gain also topped up current HP, not just the max
    expect(warrior.skillPoints).toBe(baseSkillPoints + SKILL_POINTS_PER_LEVEL);
  });

  it("a Mage's growth includes Mana, unlike a Warrior's", () => {
    const mage = newMage();
    const baseMaxMana = mage.maxMana;

    gainXp(mage, xpToNextLevel(1));

    expect(mage.maxMana).toBeGreaterThan(baseMaxMana);
  });

  it("handles multiple level-ups from one large XP award", () => {
    const character = newWarrior();
    const levels = gainXp(character, xpToNextLevel(1) + xpToNextLevel(2) + 3);
    expect(character.level).toBe(3);
    expect(levels).toEqual([2, 3]);
  });
});

describe("awardPartyXp", () => {
  it("awards XP to every living member and reports each level gained", () => {
    const bram = newWarrior();
    const corvin = newMage();
    const party = new Party([bram, corvin]);

    const messages = awardPartyXp(party, xpToNextLevel(1));

    expect(bram.level).toBe(2);
    expect(corvin.level).toBe(2);
    expect(messages).toEqual([
      `Bram reaches level 2! (+${SKILL_POINTS_PER_LEVEL} skill points)`,
      `Corvin reaches level 2! (+${SKILL_POINTS_PER_LEVEL} skill points)`,
    ]);
  });

  it("skips downed members entirely", () => {
    const bram = newWarrior();
    bram.takeDamage(9999);
    const party = new Party([bram]);

    const messages = awardPartyXp(party, xpToNextLevel(1));

    expect(bram.level).toBe(1);
    expect(bram.xp).toBe(0);
    expect(messages).toEqual([]);
  });

  it("returns no messages when nobody levels up", () => {
    const party = new Party([newWarrior()]);
    const messages = awardPartyXp(party, 1);
    expect(messages).toEqual([]);
  });
});
