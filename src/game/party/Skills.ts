import type { ClassId } from "./Character";

export interface SkillDef {
  id: string;
  classId: ClassId;
  name: string;
  manaCost: number;
  /** What the skill is *for* — see the counterplay principle in docs/03-party-and-characters.md#classes. */
  description: string;
  /**
   * Skill points required to unlock this skill (docs/08-roadmap-phases.md
   * Phase 7's "skill points to allocate on level-up," finally building
   * what `Leveling.ts` always flagged as deferred). Every class's first
   * skill is 0 — known from the moment a `Character` is constructed
   * (see `Character.ts`'s constructor), the exact same "always available,
   * no unlock step" behavior this project shipped from Phase 3 onward.
   */
  unlockCost: number;
  /**
   * The id of another skill in the same class that unlocking this one
   * permanently rules out, and vice versa — a real build fork, not a
   * checklist (docs/08-roadmap-phases.md Phase 7, on a player request
   * that class skills "have a real impact on gameplay" via selection).
   * Only set on the two tier-2 options; the always-known tier-1 skill
   * has none. Enforced in `GameLogic.unlockSkill`, which is also the
   * one place a save can be trusted not to have both sides unlocked at
   * once — nothing else ever calls `Character.unlockSkill` directly.
   * There's no respec: once chosen, the other option is gone for that
   * character for the rest of the run, same "no un-choosing" spirit as
   * a `Door`'s "no re-locking" or a `ClassGate`'s "stays open."
   */
  exclusiveWith?: string;
}

/** Skill points granted per level-up — spent on either a stat point (`Character.spendPointOnStat`, +1 per point) or unlocking one of a class's two alternative skills (`unlockCost` below). Uniform across classes and levels: no growth curve to tune yet, and a flat number is easy to reason about against a flat unlock cost. */
export const SKILL_POINTS_PER_LEVEL = 3;

/**
 * Three skills per class: each class's original Phase 3 signature
 * ability (unchanged in effect/cost, `unlockCost: 0`, always known)
 * plus two alternative second skills bought with skill points — a real
 * fork, not a single yes/no unlock, per a player report that the
 * original one-skill-to-unlock version didn't actually let a class be
 * "customized by skill selection." Deliberately kept to exactly one
 * fork per class, not a sprawling tree — the original design doc's "no
 * skill tree in v1" was a scope call for that phase, not a verdict
 * against ever having *some* branching; this is that call being
 * revisited a second time, in the same small, everything-answers-
 * something spirit as the original four:
 *
 * - Warrior: **Second Wind** (self-heal — answers attrition alone, a
 *   sustain build) vs. **Rally Cry** (heals and steadies the whole
 *   party, clearing Fear — a support build that spends the Warrior's
 *   turn on the party instead of themselves).
 * - Rogue: **Smoke Bomb** (guaranteed escape — the utility build that
 *   answers "this fight is unwinnable, get out now") vs. **Ambush**
 *   (a much harder hit, but only while the target hasn't taken any
 *   damage yet — a burst-opener build that rewards striking first).
 * - Mage: **Frost Lance** (modest damage plus a guaranteed Stun — a
 *   control build, the first in-game source for a status the engine
 *   has fully implemented since Phase 4 but nothing had ever
 *   inflicted) vs. **Cinder Nova** (no control, just a much bigger
 *   fire hit — a pure burst-damage build).
 * - Cleric: **Smite** (Holy damage — an offense build, and a second,
 *   repeatable source of Steward Marrow's exact weakness alongside the
 *   single-use Holy Water pickup) vs. **Ward** (shields an ally from
 *   their next hit without spending their turn, reusing the same
 *   "defending" halved-damage mechanic `Defend`/`Guard` already use —
 *   a protector build that keeps a squishy Mage alive instead).
 *
 * Execution logic for all ten still lives in `CombatEngine`, same "one
 * hardcoded switch is more honest than a generic effect system"
 * reasoning `classes.ts` (this file's Phase 3 predecessor) always
 * gave — dispatched by `id`, not `classId`, since a class can know more
 * than one now.
 */
export const SKILLS: Record<ClassId, SkillDef[]> = {
  warrior: [
    {
      id: "warrior-guard",
      classId: "warrior",
      name: "Guard",
      manaCost: 0,
      description: "Draws the enemy's next attack and lessens it.",
      unlockCost: 0,
    },
    {
      id: "warrior-secondWind",
      classId: "warrior",
      name: "Second Wind",
      manaCost: 0,
      description: "Restores a third of max HP to yourself.",
      unlockCost: 8,
      exclusiveWith: "warrior-rallyCry",
    },
    {
      id: "warrior-rallyCry",
      classId: "warrior",
      name: "Rally Cry",
      manaCost: 0,
      description: "Heals the whole party a little and clears Fear from everyone.",
      unlockCost: 8,
      exclusiveWith: "warrior-secondWind",
    },
  ],
  rogue: [
    {
      id: "rogue-precisionStrike",
      classId: "rogue",
      name: "Precision Strike",
      manaCost: 0,
      description: "Ignores the target's resistance and causes Bleed.",
      unlockCost: 0,
    },
    {
      id: "rogue-smokeBomb",
      classId: "rogue",
      name: "Smoke Bomb",
      manaCost: 0,
      description: "Guarantees the party escapes this fight.",
      unlockCost: 8,
      exclusiveWith: "rogue-ambush",
    },
    {
      id: "rogue-ambush",
      classId: "rogue",
      name: "Ambush",
      manaCost: 0,
      description: "A much harder hit, but only while the target hasn't taken any damage yet.",
      unlockCost: 8,
      exclusiveWith: "rogue-smokeBomb",
    },
  ],
  mage: [
    {
      id: "mage-firebolt",
      classId: "mage",
      name: "Firebolt",
      manaCost: 6,
      description: "Fire damage based on Focus.",
      unlockCost: 0,
    },
    {
      id: "mage-frostLance",
      classId: "mage",
      name: "Frost Lance",
      manaCost: 8,
      description: "Modest damage, but stuns the enemy for its next turn.",
      unlockCost: 8,
      exclusiveWith: "mage-cinderNova",
    },
    {
      id: "mage-cinderNova",
      classId: "mage",
      name: "Cinder Nova",
      manaCost: 10,
      description: "A much bigger fire hit than Firebolt, with no other effect.",
      unlockCost: 8,
      exclusiveWith: "mage-frostLance",
    },
  ],
  cleric: [
    {
      id: "cleric-cleanse",
      classId: "cleric",
      name: "Cleanse",
      manaCost: 5,
      description: "Removes all negative status effects from an ally.",
      unlockCost: 0,
    },
    {
      id: "cleric-smite",
      classId: "cleric",
      name: "Smite",
      manaCost: 6,
      description: "Holy damage based on Focus.",
      unlockCost: 8,
      exclusiveWith: "cleric-ward",
    },
    {
      id: "cleric-ward",
      classId: "cleric",
      name: "Ward",
      manaCost: 4,
      description: "Shields an ally from their next hit, without spending their turn.",
      unlockCost: 8,
      exclusiveWith: "cleric-smite",
    },
  ],
};

/** The skill known from the moment a `Character` of this class is constructed, with no unlock step — see `Character.ts`. */
export function defaultSkillId(classId: ClassId): string {
  return SKILLS[classId][0].id;
}
