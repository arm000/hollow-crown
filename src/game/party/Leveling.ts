import type { Character, ClassId } from "./Character";
import type { Party } from "./Party";
import { SKILL_POINTS_PER_LEVEL } from "./Skills";

/**
 * XP and level-up (docs/03-party-and-characters.md#leveling): "XP
 * awarded for combat victories and for first-time discovery of secrets"
 * and "a flat HP/Mana increase plus stat points... no level cap defined
 * yet". Kept as plain functions operating on a `Character`, not methods
 * on the class itself, matching `GameLogic.ts`'s `equipItem` — the data
 * this needs (the growth table) lives here, next to the functions that
 * use it, not on `Character`.
 *
 * **The "stat points to allocate" the design doc always asked for are
 * now real** (docs/08-roadmap-phases.md Phase 7, on a player request):
 * HP/Mana still grow automatically per class below, same numbers as
 * before, but stats no longer do — every level instead grants
 * `SKILL_POINTS_PER_LEVEL` skill points, spent by the player via
 * `Character.spendPointOnStat`/`unlockSkill` (see `Skills.ts`), not
 * auto-applied here. This was the one deliberate simplification this
 * module always flagged as "revisit once a level-up screen is worth
 * building" — that screen now exists.
 */

/** XP needed to advance *from* `level` — a fresh counter per level, not a cumulative total, so this resets to 0 (not decremented from some grand total) on every level-up. Linear on purpose: no level cap or difficulty curve exists yet to tune a curve against (docs/03-party-and-characters.md#leveling). */
export function xpToNextLevel(level: number): number {
  return level * 20;
}

interface LevelUpGrowth {
  hpBonus: number;
  manaBonus: number;
}

/** One class-flavored HP/Mana growth step per level — Warriors get tougher, Mages get more Mana, and so on, echoing each class's job in docs/03-party-and-characters.md#classes rather than a single flat growth applied to everyone. Stat growth is no longer part of this table (see this file's module doc) — every class grants the same flat `SKILL_POINTS_PER_LEVEL` instead, spent by the player on whichever stats they actually want. */
const LEVEL_UP_GROWTH: Record<ClassId, LevelUpGrowth> = {
  warrior: { hpBonus: 6, manaBonus: 0 },
  rogue: { hpBonus: 4, manaBonus: 0 },
  mage: { hpBonus: 2, manaBonus: 6 },
  cleric: { hpBonus: 3, manaBonus: 4 },
};

/** XP awarded the first time a secret (currently: a secret wall) is found — combat victories instead scale with `Monster.xpReward`, since not every monster should be worth the same. */
export const SECRET_DISCOVERY_XP = 15;

function applyLevelUp(character: Character): void {
  const growth = LEVEL_UP_GROWTH[character.classId];
  character.level += 1;
  character.skillPoints += SKILL_POINTS_PER_LEVEL;
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
      // Naming the points directly, not just "level up," is what makes
      // the level-up screen (see LevelUpUI.ts) worth actually opening
      // rather than something to click past.
      messages.push(`${member.name} reaches level ${level}! (+${SKILL_POINTS_PER_LEVEL} skill points)`);
    }
  }
  return messages;
}
