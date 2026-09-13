import type { Character, ClassId, CharacterStats } from "./Character";
import type { Party } from "./Party";

/**
 * XP and level-up (docs/03-party-and-characters.md#leveling): "XP
 * awarded for combat victories and for first-time discovery of secrets"
 * and "a flat HP/Mana increase plus stat points... no level cap defined
 * yet". Kept as plain functions operating on a `Character`, not methods
 * on the class itself, matching `GameLogic.ts`'s `equipItem` — the data
 * this needs (the growth table) lives here, next to the functions that
 * use it, not on `Character`.
 *
 * **Deliberate simplification, not the full roadmap ask:** the doc's
 * "stat points to allocate" implies a player choice; there's no
 * point-buy UI yet, so growth is a fixed per-class table applied
 * automatically instead, in the same spirit as "no skill tree in v1."
 * Revisit once a level-up screen is worth building.
 */

/** XP needed to advance *from* `level` — a fresh counter per level, not a cumulative total, so this resets to 0 (not decremented from some grand total) on every level-up. Linear on purpose: no level cap or difficulty curve exists yet to tune a curve against (docs/03-party-and-characters.md#leveling). */
export function xpToNextLevel(level: number): number {
  return level * 20;
}

interface LevelUpGrowth {
  statBonus: Partial<CharacterStats>;
  hpBonus: number;
  manaBonus: number;
}

/** One class-flavored growth step per level — Warriors get tougher and hit harder, Mages get more Mana and Focus, and so on, echoing each class's job in docs/03-party-and-characters.md#classes rather than a single flat growth applied to everyone. */
const LEVEL_UP_GROWTH: Record<ClassId, LevelUpGrowth> = {
  warrior: { statBonus: { might: 2, vitality: 1 }, hpBonus: 6, manaBonus: 0 },
  rogue: { statBonus: { might: 1, grace: 2 }, hpBonus: 4, manaBonus: 0 },
  mage: { statBonus: { focus: 2, resolve: 1 }, hpBonus: 2, manaBonus: 6 },
  cleric: { statBonus: { focus: 1, resolve: 2 }, hpBonus: 3, manaBonus: 4 },
};

/** XP awarded the first time a secret (currently: a secret wall) is found — combat victories instead scale with `Monster.xpReward`, since not every monster should be worth the same. */
export const SECRET_DISCOVERY_XP = 15;

function applyLevelUp(character: Character): void {
  const growth = LEVEL_UP_GROWTH[character.classId];
  character.level += 1;
  for (const key of Object.keys(growth.statBonus) as Array<keyof CharacterStats>) {
    character.stats[key] += growth.statBonus[key] ?? 0;
  }
  character.maxHp += growth.hpBonus;
  character.hp += growth.hpBonus;
  character.maxMana += growth.manaBonus;
  character.mana += growth.manaBonus;
}

/** Awards `amount` XP to `character`, applying every level-up it triggers (more than one, if `amount` is large) — each level needs progressively more XP than the last, per `xpToNextLevel`. Returns the levels reached, in order. */
export function gainXp(character: Character, amount: number): number[] {
  character.xp += amount;
  const levelsGained: number[] = [];
  while (character.xp >= xpToNextLevel(character.level)) {
    character.xp -= xpToNextLevel(character.level);
    applyLevelUp(character);
    levelsGained.push(character.level);
  }
  return levelsGained;
}

/**
 * Awards `amount` XP to every living member of `party` — both combat
 * victories (`Game.checkCombatEnd`) and first-time secret discovery
 * (`SecretWall.interact`) route through this, per
 * docs/03-party-and-characters.md#leveling. A downed member gets
 * nothing; leveling up a character who isn't currently fighting for
 * anything reads as a reward with no clear cause. Returns one
 * announcement per level gained, across the whole party, in award order.
 */
export function awardPartyXp(party: Party, amount: number): string[] {
  const messages: string[] = [];
  for (const member of party.livingMembers()) {
    for (const level of gainXp(member, amount)) {
      messages.push(`${member.name} reaches level ${level}!`);
    }
  }
  return messages;
}
