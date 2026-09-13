import type { ResistanceMap } from "../combat/DamageType";
import { StatusEffectSet } from "../combat/StatusEffect";

/** One of the four starting classes (see docs/03-party-and-characters.md). No hybrid/multiclass in v1. */
export type ClassId = "warrior" | "rogue" | "mage" | "cleric";

/** Front rank can be targeted by melee and can melee; back rank is safe from melee bar reach. */
export type Rank = "front" | "back";

/**
 * The five core stats (docs/03-party-and-characters.md#core-stats).
 * Kept small on purpose — this is the whole attribute list, not a
 * simulationist stat sheet.
 */
export interface CharacterStats {
  might: number; // melee damage, carry capacity
  grace: number; // initiative order, ranged accuracy, evasion
  vitality: number; // max HP
  focus: number; // max mana, spell/ability strength
  resolve: number; // resistance to debuffs/fear, flee chance
}

/**
 * A party member. Phase 2 hardcodes the roster (see `roster.ts`) — no
 * creation UI and no leveling yet (docs/03-party-and-characters.md
 * "Party creation vs. pre-generated" — that's Phase 3).
 */
export class Character {
  readonly side = "party" as const;
  hp: number;
  mana: number;
  /** Base resistances are empty for every starting character — equipment (Phase 3 accessories) is the only source so far. */
  resistances: ResistanceMap = {};
  readonly statusEffects = new StatusEffectSet();

  constructor(
    public readonly name: string,
    public readonly classId: ClassId,
    public rank: Rank,
    public readonly stats: CharacterStats,
    public readonly maxHp: number,
    public readonly maxMana: number,
  ) {
    this.hp = maxHp;
    this.mana = maxMana;
  }

  /** Grace stands in as this character's initiative stat (docs/05-combat.md#initiative). */
  get initiativeStat(): number {
    return this.stats.grace;
  }

  get isDown(): boolean {
    return this.hp <= 0;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }
}
