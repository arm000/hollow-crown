import type { ClassId } from "./Character";

export interface AbilityDef {
  id: string;
  name: string;
  manaCost: number;
  /** What the ability is *for* — see the counterplay principle below. */
  description: string;
}

/**
 * One ability per class, per docs/08-roadmap-phases.md Phase 3. Each
 * exists to answer something specific, per the counterplay principle in
 * docs/03-party-and-characters.md#classes — not just more damage:
 *
 * - Warrior's Guard answers a fight where the party needs to protect a
 *   specific ally from the next hit.
 * - Rogue's Precision Strike answers a Physical-resistant enemy without
 *   needing the Mage, and applies Bleed on top.
 * - Mage's Firebolt is *the* answer to a Physical-resistant, Fire-weak
 *   enemy (docs/05-combat.md's Cinder Wretch).
 * - Cleric's Cleanse answers Poison/Bleed/Fear/Silence once something in
 *   the game actually inflicts them.
 *
 * Execution logic lives in `CombatEngine` (one class, one hardcoded
 * ability — a small switch is more honest than a generic effect system
 * built for four fixed entries).
 */
export const CLASS_ABILITIES: Record<ClassId, AbilityDef> = {
  warrior: {
    id: "guard",
    name: "Guard",
    manaCost: 0,
    description: "Draws the enemy's next attack and lessens it.",
  },
  rogue: {
    id: "precisionStrike",
    name: "Precision Strike",
    manaCost: 0,
    description: "Ignores the target's resistance and causes Bleed.",
  },
  mage: {
    id: "firebolt",
    name: "Firebolt",
    manaCost: 6,
    description: "Fire damage based on Focus.",
  },
  cleric: {
    id: "cleanse",
    name: "Cleanse",
    manaCost: 5,
    description: "Removes all negative status effects from an ally.",
  },
};
