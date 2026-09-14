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
}

/** Skill points granted per level-up — spent on either a stat point (`Character.spendPointOnStat`, +1 per point) or unlocking a class's second skill (`unlockCost` below). Uniform across classes and levels: no growth curve to tune yet, and a flat number is easy to reason about against a flat unlock cost. */
export const SKILL_POINTS_PER_LEVEL = 3;

/**
 * Two skills per class: each class's original Phase 3 signature ability
 * (unchanged in effect/cost, `unlockCost: 0`) plus one new skill bought
 * with skill points earned via leveling. Deliberately kept to exactly
 * one new skill per class, not a sprawling tree — the original design
 * doc's "no skill tree in v1" was a scope call for that phase, not a
 * verdict against ever having one; this is that call being revisited on
 * a player request, in the same small, everything-answers-something
 * spirit as the first four:
 *
 * - Warrior's **Second Wind** answers attrition: a long fight the party
 *   is otherwise winning on chip damage, where Guard alone doesn't
 *   provide any actual sustain.
 * - Rogue's **Smoke Bomb** answers "this fight is unwinnable, get out
 *   now" — a guaranteed escape, unlike the resolve-scaled coin flip
 *   ordinary Flee already is.
 * - Mage's **Frost Lance** answers seeing a telegraphed heavy strike
 *   coming (the initiative tracker's whole reason for existing) with
 *   something better than just bracing for it: skip the monster's turn
 *   outright, at the cost of Firebolt's raw damage. It's the first
 *   in-game source for Stun, a status the engine has fully implemented
 *   since Phase 4 (see `StatusEffect.ts`) but nothing had ever inflicted.
 * - Cleric's **Smite** answers Cleric having zero offense of its own
 *   beyond a plain Attack, and doubles as a second, repeatable source of
 *   Holy damage alongside the single-use Holy Water pickup — Steward
 *   Marrow's weakness stops being a one-shot resource question.
 *
 * Execution logic for all eight still lives in `CombatEngine`, same
 * "one hardcoded switch is more honest than a generic effect system"
 * reasoning `classes.ts` (now this file) always gave — dispatched by
 * `id` instead of by `classId`, since a class can have more than one now.
 */
export const SKILLS: Record<ClassId, [SkillDef, SkillDef]> = {
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
      description: "Restores a third of max HP.",
      unlockCost: 8,
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
    },
  ],
};

/** Every skill a class could ever know, tier 1 first — for a level-up screen to list both regardless of which are unlocked yet. */
export function skillsFor(classId: ClassId): [SkillDef, SkillDef] {
  return SKILLS[classId];
}

/** The skill known from the moment a `Character` of this class is constructed, with no unlock step — see `Character.ts`. */
export function defaultSkillId(classId: ClassId): string {
  return SKILLS[classId][0].id;
}
