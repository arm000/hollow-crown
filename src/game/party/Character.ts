import type { ResistanceMap } from "../combat/DamageType";
import { StatusEffectSet } from "../combat/StatusEffect";
import type { EquipmentItem, EquipmentSlot } from "./Equipment";

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
  /** Base resistances are empty for every starting character — an equipped accessory is the only source. */
  resistances: ResistanceMap = {};
  readonly statusEffects = new StatusEffectSet();
  private readonly equipment: Partial<Record<EquipmentSlot, EquipmentItem>> = {};

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

  equip(item: EquipmentItem): EquipmentItem | undefined {
    const previous = this.equipment[item.slot];
    this.equipment[item.slot] = item;
    return previous;
  }

  unequip(slot: EquipmentSlot): EquipmentItem | undefined {
    const previous = this.equipment[slot];
    delete this.equipment[slot];
    return previous;
  }

  equippedIn(slot: EquipmentSlot): EquipmentItem | undefined {
    return this.equipment[slot];
  }

  /** Everything currently worn, across all slots — for a HUD/inventory screen to list. */
  listEquipment(): EquipmentItem[] {
    return Object.values(this.equipment).filter((item): item is EquipmentItem => item !== undefined);
  }

  /** Base stats plus every equipped item's bonus — this is what combat math should always read, not `.stats` directly. */
  get effectiveStats(): CharacterStats {
    const effective = { ...this.stats };
    for (const item of Object.values(this.equipment)) {
      if (!item?.statBonus) continue;
      for (const key of Object.keys(item.statBonus) as Array<keyof CharacterStats>) {
        effective[key] += item.statBonus[key] ?? 0;
      }
    }
    return effective;
  }

  /** Base resistances plus every equipped item's bonus, stacked multiplicatively. */
  get effectiveResistances(): ResistanceMap {
    const effective: ResistanceMap = { ...this.resistances };
    for (const item of Object.values(this.equipment)) {
      if (!item?.resistanceBonus) continue;
      for (const [type, multiplier] of Object.entries(item.resistanceBonus) as Array<
        [keyof ResistanceMap, number]
      >) {
        effective[type] = (effective[type] ?? 1) * multiplier;
      }
    }
    return effective;
  }

  /** Grace (including equipment) stands in as this character's initiative stat (docs/05-combat.md#initiative). */
  get initiativeStat(): number {
    return this.effectiveStats.grace;
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
