import type { DungeonMap } from "../DungeonMap";
import type { ResistanceMap } from "../combat/DamageType";
import { StatusEffectSet, type StatusEffectInstance } from "../combat/StatusEffect";
import type { Player } from "../Player";
import { rollInt, type Rng } from "../Rng";
import type { Tickable } from "../WorldClock";

export interface GridPoint {
  x: number;
  z: number;
}

/** World-turns a monster ignores the party's proximity for after `disengage()` — long enough to actually put distance between them (the largest current detection radius is 5), not just one token step. */
const DISENGAGE_COOLDOWN_TURNS = 5;

/** Combat-log flavor for the light/heavy halves of a turn — overridable so a spellcaster doesn't "claw" at anyone (docs/08-roadmap-phases.md Phase 4's Court Alchemist). Defaults match the original Rot-thing/Cinder Wretch text exactly, so neither needs to pass this. */
export interface MonsterFlavor {
  /** Shown on the lighter hit, which also foreshadows the telegraphed turn to come — the "hard but fair" rule (docs/05-combat.md#telegraphing-the-hard-but-fair-rule) requires the warning to already be in this line. */
  light: string;
  /** Shown when the telegraphed turn actually resolves. */
  heavy: string;
}

const DEFAULT_FLAVOR: MonsterFlavor = {
  light: "claws at you, and rears back for something heavier!",
  heavy: "unleashes its heavy strike!",
};

export interface MonsterOptions {
  name: string;
  x: number;
  z: number;
  /** Points the monster walks between, in order, looping back to the first once it reaches the last — until it spots the party. */
  patrolPoints: GridPoint[];
  /** Manhattan distance at which the monster notices the party (docs/04-exploration-and-world.md — simple radius, no vision cones in v1). */
  detectionRadius: number;
  maxHp: number;
  might: number;
  initiativeStat: number;
  /** Damage-type resistances/weaknesses (docs/05-combat.md#monster-design-every-type-is-a-lesson) — empty by default, e.g. the Rot-thing has none. */
  resistances?: ResistanceMap;
  /** XP the party earns for defeating this monster (docs/03-party-and-characters.md#leveling) — defaults to 0 so existing tests that build a bare `Monster` for AI/combat behavior don't all need updating just to add a number they don't care about. */
  xpReward?: number;
  flavor?: MonsterFlavor;
  /** Applied to the target when the telegraphed heavy strike lands, in addition to its damage — the Screeching Wraith's Fear (docs/05-combat.md#a-teaching-ladder-illustrative-not-final-content). */
  heavyStatusEffect?: StatusEffectInstance;
  /**
   * If set, the telegraphed "heavy" turn heals the monster by this much
   * instead of attacking — the Court Alchemist. A true support caster
   * healing a second, separate monster would need multi-monster combat,
   * which `CombatEngine` doesn't have yet (docs/08-roadmap-phases.md
   * Phase 4's monster roster expansion is scoped to this simpler,
   * single-monster analogue: burst it down or watch it undo your work,
   * which still teaches the same urgency "kill the healer first" is
   * getting at).
   */
  healsOnHeavyTurn?: number;
  /**
   * The Armored Sentinel's signature mechanic
   * (docs/05-combat.md#a-teaching-ladder-illustrative-not-final-content):
   * a reach weapon that ignores rank entirely, so `CombatEngine.pickTarget`
   * draws from every living party member instead of preferring the front
   * rank — "rank alone doesn't guarantee safety," the specific lesson a
   * back-rank caster tucked safely behind a Warrior needs to learn at
   * least once. Defaults to `false` for every other monster, which still
   * respect rank exactly as before.
   */
  hasReach?: boolean;
}

export interface MonsterCombatTurn {
  message: string;
  damage: number;
  /** Set only on a heavy strike that also inflicts a status effect. */
  statusEffect?: StatusEffectInstance;
}

/**
 * A single "aggressive melee" monster (docs/05-combat.md#monster-ai-v1-scope):
 * patrols on the shared world-turn tick until it notices the party, then
 * closes in. Its combat turn alternates a lighter hit with a telegraphed
 * heavy strike (docs/05-combat.md#monster-design-every-type-is-a-lesson)
 * — every type earns its place by requiring a real response, not just
 * being a bigger damage sponge; here, that response is "Defend on the
 * telegraphed turn."
 */
export class Monster implements Tickable {
  readonly side = "monster" as const;
  readonly name: string;
  x: number;
  z: number;
  hp: number;
  readonly maxHp: number;
  readonly might: number;
  readonly initiativeStat: number;
  readonly resistances: ResistanceMap;
  readonly xpReward: number;
  readonly statusEffects = new StatusEffectSet();

  private readonly patrolPoints: GridPoint[];
  private readonly detectionRadius: number;
  private readonly flavor: MonsterFlavor;
  /** Public (unlike `flavor`) — the bestiary/codex screen (docs/05-combat.md#the-bestiary) reads these once a type has been encountered, to describe its signature mechanic without a separate, hand-maintained data table duplicating what the monster already knows about itself. */
  readonly heavyStatusEffect: StatusEffectInstance | undefined;
  readonly healsOnHeavyTurn: number | undefined;
  readonly hasReach: boolean;
  private patrolIndex = 0;
  private alerted = false;
  private telegraphed = false;
  /**
   * Counts down to 0 after `disengage()` (a successful Flee or Smoke
   * Bomb) — while positive, `tick()` skips re-alerting entirely, even
   * if the party is still standing right next to it, and
   * `GameLogic.advanceWorldTurn` refuses to re-trigger combat against
   * this monster no matter how close the party is (see `isDisengaged`).
   * Without this, a monster left adjacent the instant combat ends (Flee
   * doesn't relocate the party) would simply re-notice and close back
   * to adjacent within the same world-turn its cooldown-free `tick()`
   * ran in, making a successful flee functionally indistinguishable
   * from just continuing the fight — the exact "the monster just
   * re-engages into combat again" a player reported about Smoke Bomb,
   * which is just the same underlying bug with a guaranteed trigger.
   */
  private disengageCooldown = 0;

  constructor(
    options: MonsterOptions,
    private readonly dungeon: DungeonMap,
    private readonly player: Player,
  ) {
    this.name = options.name;
    this.x = options.x;
    this.z = options.z;
    this.patrolPoints = options.patrolPoints;
    this.detectionRadius = options.detectionRadius;
    this.maxHp = options.maxHp;
    this.hp = options.maxHp;
    this.might = options.might;
    this.initiativeStat = options.initiativeStat;
    this.resistances = options.resistances ?? {};
    this.xpReward = options.xpReward ?? 0;
    this.flavor = options.flavor ?? DEFAULT_FLAVOR;
    this.heavyStatusEffect = options.heavyStatusEffect;
    this.healsOnHeavyTurn = options.healsOnHeavyTurn;
    this.hasReach = options.hasReach ?? false;
  }

  get isDown(): boolean {
    return this.hp <= 0;
  }

  get isAlerted(): boolean {
    return this.alerted;
  }

  /** True for a few world-turns right after `disengage()` — `GameLogic.advanceWorldTurn` won't restart combat against this monster while it's true, no matter how close the party still is (see `disengageCooldown`'s doc comment). */
  get isDisengaged(): boolean {
    return this.disengageCooldown > 0;
  }

  private distanceToPlayer(): number {
    return Math.abs(this.player.gridX - this.x) + Math.abs(this.player.gridZ - this.z);
  }

  tick(): void {
    if (this.isDown) return;

    if (this.disengageCooldown > 0) {
      this.disengageCooldown--;
      this.patrol();
      return;
    }

    if (!this.alerted) {
      if (this.distanceToPlayer() <= this.detectionRadius) {
        this.alerted = true;
      } else {
        this.patrol();
        return;
      }
    }

    if (this.distanceToPlayer() > 1) {
      this.stepToward(this.player.gridX, this.player.gridZ);
    }
  }

  private patrol(): void {
    const target = this.patrolPoints[this.patrolIndex];
    if (this.x === target.x && this.z === target.z) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length;
      return;
    }
    this.stepToward(target.x, target.z);
  }

  /** Steps one tile toward (targetX, targetZ), preferring the axis with the larger gap and falling back to the other if that step is blocked. */
  private stepToward(targetX: number, targetZ: number): void {
    const dx = Math.sign(targetX - this.x);
    const dz = Math.sign(targetZ - this.z);
    if (dx === 0 && dz === 0) return;

    const stepsToTry: Array<[number, number]> =
      Math.abs(targetX - this.x) >= Math.abs(targetZ - this.z)
        ? [
            [dx, 0],
            [0, dz],
          ]
        : [
            [0, dz],
            [dx, 0],
          ];

    for (const [stepX, stepZ] of stepsToTry) {
      if (stepX === 0 && stepZ === 0) continue;
      const nx = this.x + stepX;
      const nz = this.z + stepZ;
      if (!this.dungeon.isWall(nx, nz)) {
        this.x = nx;
        this.z = nz;
        return;
      }
    }
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  /**
   * Used when the party successfully flees combat (an ordinary Flee,
   * or a guaranteed-escape skill like the Rogue's Smoke Bomb). Resets
   * alert state *and* starts the disengage cooldown (see its doc
   * comment) — the alert reset alone used to be the whole thing, but
   * since Flee never relocates the party, they're still standing right
   * next to a monster that would otherwise re-notice them (it's within
   * its own detection radius by definition) and close back to adjacent
   * within the very same world-turn, making a successful flee
   * indistinguishable from just continuing the fight.
   */
  disengage(): void {
    this.alerted = false;
    this.disengageCooldown = DISENGAGE_COOLDOWN_TURNS;
  }

  /**
   * One combat turn: alternates a lighter hit with a telegraphed heavy
   * strike, so a party paying attention always sees the heavy one
   * coming a turn ahead (the "hard but fair" rule in
   * docs/05-combat.md#telegraphing-the-hard-but-fair-rule).
   */
  takeCombatTurn(rng: Rng): MonsterCombatTurn {
    if (this.telegraphed) {
      this.telegraphed = false;
      if (this.healsOnHeavyTurn) {
        this.hp = Math.min(this.maxHp, this.hp + this.healsOnHeavyTurn);
        return { message: `${this.name} ${this.flavor.heavy}`, damage: 0 };
      }
      return {
        message: `${this.name} ${this.flavor.heavy}`,
        damage: this.might * 3 + rollInt(rng, 1, 4),
        statusEffect: this.heavyStatusEffect,
      };
    }
    this.telegraphed = true;
    return {
      message: `${this.name} ${this.flavor.light}`,
      damage: this.might + rollInt(rng, 1, 4),
    };
  }
}
