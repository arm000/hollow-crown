import type { ResistanceMap } from "../combat/DamageType";
import { StatusEffectSet } from "../combat/StatusEffect";
import type { EquipmentItem, EquipmentSlot } from "./Equipment";
import { defaultSkillId } from "./Skills";

/** One of the four starting classes (see docs/03-party-and-characters.md). No hybrid/multiclass in v1. */
export type ClassId = "warrior" | "rogue" | "mage" | "cleric";

/** Every `ClassId`, for anything that needs to iterate all of them rather than hardcode the union — `PartyCreationUI`'s class picker, and `AssetManifest.test.ts`'s "every class has a linked portrait" check. */
export const ALL_CLASS_IDS: ClassId[] = ["warrior", "rogue", "mage", "cleric"];

/** Front rank can be targeted by melee and can melee; back rank is safe from melee bar reach. */
export type Rank = "front" | "back";

/** How much a single skill point spent on Vitality/Focus nudges max HP/Mana (see `Character.spendPointOnStat`) — roughly half of a typical level-up's own flat class bonus (`Leveling.ts`'s `LEVEL_UP_GROWTH`), since a point is a smaller, player-chosen increment rather than a guaranteed per-level one. */
const VITALITY_HP_PER_POINT = 3;
const FOCUS_MANA_PER_POINT = 3;

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
 * A party member. Phase 3's `PartyCreationUI`/`roster.createParty` build
 * these from a player's class/name/portrait choices
 * (docs/03-party-and-characters.md "Party creation vs. pre-generated");
 * `roster.createStartingParty` still hardcodes the Phase 2 defaults for
 * anything that skips character creation, tests included.
 */
export class Character {
  readonly side = "party" as const;
  hp: number;
  mana: number;
  /** Grows via leveling (see `Leveling.ts`) -- not readonly like `stats`/`name`/`classId`, which never change after creation. */
  maxHp: number;
  maxMana: number;
  /** Both start at 1/0 and only ever change through `Leveling.ts`'s `gainXp` -- kept as plain mutable fields here rather than methods, same as `hp`/`mana`, since `Character` itself owns no leveling rules. */
  level = 1;
  xp = 0;
  /** Base resistances are empty for every starting character — an equipped accessory is the only source. */
  resistances: ResistanceMap = {};
  readonly statusEffects = new StatusEffectSet();
  private readonly equipment: Partial<Record<EquipmentSlot, EquipmentItem>> = {};
  /** Unspent skill points (docs/08-roadmap-phases.md Phase 7), granted by `Leveling.gainXp` — spent via `spendPointOnStat`/`unlockSkill`, never auto-applied. */
  skillPoints = 0;
  /** Every skill id this character can currently use in combat — starts with just the class's default (see the constructor), grows only through `unlockSkill`. A `Set` rather than a fixed pair since nothing here assumes exactly two will ever exist. */
  private readonly knownSkillIds: Set<string>;

  constructor(
    public readonly name: string,
    public readonly classId: ClassId,
    public rank: Rank,
    public readonly stats: CharacterStats,
    maxHp: number,
    maxMana: number,
    /** A plain color-swatch placeholder, not real character art (that's docs/10-visual-style-guide.md's job, still ahead) — enough for a party-creation slot and the HUD/inventory screen to be visually distinguishable at a glance. */
    public readonly portrait: string = "⚪",
  ) {
    this.maxHp = maxHp;
    this.maxMana = maxMana;
    this.hp = maxHp;
    this.mana = maxMana;
    // Every class's first skill (see Skills.ts) has always been
    // unconditionally available, since Phase 3 -- only a class's
    // *second* skill is ever actually locked behind spending points.
    this.knownSkillIds = new Set([defaultSkillId(classId)]);
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

  knowsSkill(skillId: string): boolean {
    return this.knownSkillIds.has(skillId);
  }

  /** Every skill id currently known, for a combat/level-up UI to list — a snapshot, not a live view, so a caller can't mutate this character's actual skill set through it. */
  listKnownSkillIds(): string[] {
    return [...this.knownSkillIds];
  }

  /**
   * Spends one skill point to raise `stat` by 1. Returns false (and
   * changes nothing) if there's no point to spend — the caller's job to
   * only offer this when `skillPoints > 0`, this is just the guard
   * against it happening anyway.
   *
   * Vitality and Focus also nudge `maxHp`/`maxMana` (and top up current
   * HP/Mana by the same amount, same as `Leveling.ts`'s own flat
   * per-level bonus already does) — those two stats' whole documented
   * job (docs/03-party-and-characters.md#core-stats) is "drives max
   * HP"/"drives max Mana," and a level-up screen that let a player put
   * a point into either for literally no effect would be offering a
   * choice that's secretly a trap. Might/Grace/Resolve stay exactly
   * what they've always been: read straight off `stats`/`effectiveStats`
   * wherever combat math needs them, no derived field to keep in sync.
   */
  spendPointOnStat(stat: keyof CharacterStats): boolean {
    if (this.skillPoints <= 0) return false;
    this.stats[stat] += 1;
    this.skillPoints -= 1;
    if (stat === "vitality") {
      this.maxHp += VITALITY_HP_PER_POINT;
      this.hp += VITALITY_HP_PER_POINT;
    } else if (stat === "focus") {
      this.maxMana += FOCUS_MANA_PER_POINT;
      this.mana += FOCUS_MANA_PER_POINT;
    }
    return true;
  }

  /**
   * Spends `cost` skill points to learn `skillId`. The cost is a
   * parameter rather than looked up here so `Character` never needs to
   * know `Skills.ts` exists beyond the one default id every character
   * starts with (see the constructor) — the caller (`GameLogic.ts`'s
   * `unlockSkill`) already has the real `SkillDef` in hand and is
   * where that data actually lives. Returns false, changing nothing,
   * if the skill is already known or there aren't enough points.
   */
  unlockSkill(skillId: string, cost: number): boolean {
    if (this.knownSkillIds.has(skillId) || this.skillPoints < cost) return false;
    this.knownSkillIds.add(skillId);
    this.skillPoints -= cost;
    return true;
  }

  /** Replaces the known-skill set wholesale, no cost check — `SaveGame.ts`'s `deserializeCharacter` only, restoring exactly what a save recorded rather than re-spending points for it. Never call this from gameplay code; that's what `unlockSkill` is for. */
  restoreKnownSkillIds(skillIds: Iterable<string>): void {
    this.knownSkillIds.clear();
    for (const id of skillIds) this.knownSkillIds.add(id);
  }
}
