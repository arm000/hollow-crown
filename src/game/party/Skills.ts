import type { ClassId } from "./Character";

export interface SkillDef {
  id: string;
  classId: ClassId;
  name: string;
  manaCost: number;
  /**
   * Turns before this skill can be used again, starting the moment
   * it's cast (docs/08-roadmap-phases.md Phase 7 Batch 10, on a player
   * report: "Power Strike is strictly better than a regular attack, so
   * why wouldn't a Warrior use it every turn?" — true of every 0-mana
   * skill with no built-in drawback, not just that one). Ticks down by
   * one every round (`Character.tickCooldowns`, called from the same
   * `CombatEngine.rollInitiative(true)` round boundary that already
   * ticks status-effect durations — the same "turns" unit Bleed/Fear/
   * Stun already use).
   *
   * **Must be at least 2.** A character only ever gets one action per
   * round, so their own next possible attempt at a skill is already
   * the *next* round — a cooldown of 1 ticks away during that exact
   * transition and is therefore indistinguishable from 0, a no-op
   * that was actually shipped once here before a test caught it. 2 is
   * the smallest value with any real effect at all ("sit out one full
   * round"); every tier-1 skill uses exactly that, every tier-2 skill
   * uses 3 ("sit out two"), regardless of mana cost — a mana-gated
   * skill still gets a real cooldown, not 0, since mana alone doesn't
   * stop a Mage with a full bar from casting Firebolt several rounds
   * running; the mana cost and the cooldown are two independent
   * throttles, not a reason to skip one of them. `CombatEngine.resolveAbility`
   * checks the cooldown before mana, so `Character.knowsSkill` staying
   * true (nothing here ever *forgets* a skill) is the only thing that
   * doesn't gate a skill. There is deliberately no cooldown on the base
   * Attack/Defend/Flee actions — with everything else on a timer, those
   * stay the reliable fallback while a skill recharges, instead of
   * every turn boiling down to "spam the one best skill."
   */
  cooldown: number;
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
   * Set on both tier-2 options (unlocked by spending points, enforced
   * in `GameLogic.unlockSkill` — the one place a save can be trusted
   * not to have both sides of *that* fork known at once) and, since
   * Batch 9, on both tier-1 options too: `PartyCreationUI` is where
   * that fork is chosen (which tier-1 skill a character starts
   * knowing — see `Character`'s `startingSkillId`), so there's no
   * `unlockSkill` call to intercept it there. The `exclusiveWith`
   * field still does real work for tier-1: it's what makes
   * `LevelUpUI.buildSkillRow` correctly show the tier-1 option not
   * picked at creation as "unavailable (chose the other one)" instead
   * of a live 0-point "Unlock" button that would just let a player
   * pick up the alternative they turned down. There's no respec either
   * way: once chosen, the other option is gone for that character for
   * the rest of the run, same "no un-choosing" spirit as a `Door`'s
   * "no re-locking" or a `ClassGate`'s "stays open."
   */
  exclusiveWith?: string;
}

/** Skill points granted per level-up — spent on either a stat point (`Character.spendPointOnStat`, +1 per point) or unlocking one of a class's two alternative skills (`unlockCost` below). Uniform across classes and levels: no growth curve to tune yet, and a flat number is easy to reason about against a flat unlock cost. */
export const SKILL_POINTS_PER_LEVEL = 3;

/**
 * Four skills per class, two exclusive pairs:
 *
 * - **Tier 1** (`unlockCost: 0`, both indices 0-1 below): a real choice
 *   made at character creation (`PartyCreationUI`, docs/08-roadmap-phases.md
 *   Phase 7 Batch 9, on a player request for "a character creation
 *   screen... where the user can... pick a starting skill") between
 *   an offense-leaning option and a defense/utility-leaning one. Index
 *   0 of each class's array is that class's original Phase 3 signature
 *   ability and stays `Character`'s default (`defaultSkillId`) for
 *   anything that doesn't go through creation — `roster.createStartingParty`,
 *   `RescueEncounter`'s recruits, every pre-Batch-9 test.
 * - **Tier 2** (`unlockCost: 8`, indices 2-3): the Batch 5 build fork,
 *   unlocked mid-run by spending skill points earned from leveling —
 *   see that batch's own history in docs/08-roadmap-phases.md for why
 *   it exists.
 *
 * Both forks use the exact same `exclusiveWith` mechanism (see that
 * field's own doc comment) and the exact same "no respec, ever" rule —
 * tier 1 is just chosen at a different moment (creation, not a
 * `GameLogic.unlockSkill` call) and never costs a point either way.
 * Every class's pair, tier 1 then tier 2:
 *
 * - Warrior: **Guard** (draws and halves the monster's next attack —
 *   defense) vs. **Power Strike** (a harder physical hit than a plain
 *   Attack, no downside — offense) at tier 1; **Second Wind**
 *   (self-heal, sustain) vs. **Rally Cry** (party-wide heal, clears
 *   Fear, support) at tier 2.
 * - Rogue: **Precision Strike** (ignores resistance, causes Bleed —
 *   offense) vs. **Feint** (a much better-than-average flee chance,
 *   immediate — utility) at tier 1; **Smoke Bomb** (guaranteed
 *   escape) vs. **Ambush** (bonus damage only against a still-full-HP
 *   target) at tier 2 — Feint and Smoke Bomb are deliberately not the
 *   same power level (a coin-flip-plus now vs. a certainty later),
 *   giving Rogue a real escape-focused progression rather than a flat
 *   upgrade.
 * - Mage: **Firebolt** (Focus-based fire damage — offense) vs.
 *   **Arcane Barrier** (shields the Mage's own next hit, reusing
 *   `CombatEngine`'s `warded` set — defense) at tier 1; **Frost Lance**
 *   (control, guaranteed Stun) vs. **Cinder Nova** (bigger fire hit,
 *   no control) at tier 2.
 * - Cleric: **Cleanse** (removes every negative status from an ally —
 *   utility) vs. **Radiant Spark** (modest Focus-based Holy damage,
 *   weaker than Smite — offense) at tier 1; **Smite** (Cleric's real
 *   offense, Focus-based Holy damage) vs. **Ward** (shields an ally's
 *   next hit without spending their turn) at tier 2 — Radiant Spark
 *   and Smite are deliberately not the same power level either, so
 *   unlocking Smite later stays worth it even for a Cleric who started
 *   offense-leaning.
 *
 * Execution logic for all fourteen still lives in `CombatEngine`, same
 * "one hardcoded switch is more honest than a generic effect system"
 * reasoning `classes.ts` (this file's Phase 3 predecessor) always
 * gave — dispatched by `id`, not `classId`, since a class can know more
 * than one now.
 *
 * Every skill also has a `cooldown` (Batch 10) — see that field's own
 * doc comment for why, including why it's never 1. Both sides of a
 * fork always share the same cooldown, so choosing between them is
 * purely about the effect, never about which one recharges faster:
 * every tier-1 skill sits at 2 rounds, every tier-2 skill at 3,
 * mana-gated or not — mana cost and cooldown are separate throttles
 * layered on top of each other, not substitutes for one another.
 */
export const SKILLS: Record<ClassId, SkillDef[]> = {
  warrior: [
    {
      id: "warrior-guard",
      classId: "warrior",
      name: "Guard",
      manaCost: 0,
      cooldown: 2,
      description: "Draws the enemy's next attack and lessens it.",
      unlockCost: 0,
      exclusiveWith: "warrior-powerStrike",
    },
    {
      id: "warrior-powerStrike",
      classId: "warrior",
      name: "Power Strike",
      manaCost: 0,
      cooldown: 2,
      description: "A harder physical hit than a plain Attack, with no other effect.",
      unlockCost: 0,
      exclusiveWith: "warrior-guard",
    },
    {
      id: "warrior-secondWind",
      classId: "warrior",
      name: "Second Wind",
      manaCost: 0,
      cooldown: 3,
      description: "Restores a third of max HP to yourself.",
      unlockCost: 8,
      exclusiveWith: "warrior-rallyCry",
    },
    {
      id: "warrior-rallyCry",
      classId: "warrior",
      name: "Rally Cry",
      manaCost: 0,
      cooldown: 3,
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
      cooldown: 2,
      description: "Ignores the target's resistance and causes Bleed.",
      unlockCost: 0,
      exclusiveWith: "rogue-feint",
    },
    {
      id: "rogue-feint",
      classId: "rogue",
      name: "Feint",
      manaCost: 0,
      cooldown: 2,
      description: "Creates an opening and immediately attempts to flee, at much better than usual odds.",
      unlockCost: 0,
      exclusiveWith: "rogue-precisionStrike",
    },
    {
      id: "rogue-smokeBomb",
      classId: "rogue",
      name: "Smoke Bomb",
      manaCost: 0,
      cooldown: 3,
      description: "Guarantees the party escapes this fight.",
      unlockCost: 8,
      exclusiveWith: "rogue-ambush",
    },
    {
      id: "rogue-ambush",
      classId: "rogue",
      name: "Ambush",
      manaCost: 0,
      cooldown: 3,
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
      cooldown: 2,
      description: "Fire damage based on Focus.",
      unlockCost: 0,
      exclusiveWith: "mage-arcaneBarrier",
    },
    {
      id: "mage-arcaneBarrier",
      classId: "mage",
      name: "Arcane Barrier",
      manaCost: 4,
      cooldown: 2,
      description: "Shields yourself from your next hit, without spending a later turn.",
      unlockCost: 0,
      exclusiveWith: "mage-firebolt",
    },
    {
      id: "mage-frostLance",
      classId: "mage",
      name: "Frost Lance",
      manaCost: 8,
      cooldown: 3,
      description: "Modest damage, but stuns the enemy for its next turn.",
      unlockCost: 8,
      exclusiveWith: "mage-cinderNova",
    },
    {
      id: "mage-cinderNova",
      classId: "mage",
      name: "Cinder Nova",
      manaCost: 10,
      cooldown: 3,
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
      cooldown: 2,
      description: "Removes all negative status effects from an ally.",
      unlockCost: 0,
      exclusiveWith: "cleric-radiantSpark",
    },
    {
      id: "cleric-radiantSpark",
      classId: "cleric",
      name: "Radiant Spark",
      manaCost: 4,
      cooldown: 2,
      description: "A modest burst of Holy damage based on Focus, weaker than Smite.",
      unlockCost: 0,
      exclusiveWith: "cleric-cleanse",
    },
    {
      id: "cleric-smite",
      classId: "cleric",
      name: "Smite",
      manaCost: 6,
      cooldown: 3,
      description: "Holy damage based on Focus.",
      unlockCost: 8,
      exclusiveWith: "cleric-ward",
    },
    {
      id: "cleric-ward",
      classId: "cleric",
      name: "Ward",
      manaCost: 4,
      cooldown: 3,
      description: "Shields an ally from their next hit, without spending their turn.",
      unlockCost: 8,
      exclusiveWith: "cleric-smite",
    },
  ],
};

/** The skill known from the moment a `Character` of this class is constructed, with no unlock step, *unless* `PartyCreationUI` offered (and the player picked) a different tier-1 option — see `Character`'s `startingSkillId`. Always index 0, the class's original Phase 3 signature ability, so every caller that doesn't pass a `startingSkillId` keeps behaving exactly as it always has. */
export function defaultSkillId(classId: ClassId): string {
  return SKILLS[classId][0].id;
}
