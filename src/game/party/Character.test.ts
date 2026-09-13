import { describe, expect, it } from "vitest";
import { Character } from "./Character";

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
});
