import type { DungeonMap } from "../DungeonMap";
import type { Player } from "../Player";
import { rollInt, type Rng } from "../Rng";
import type { Tickable } from "../WorldClock";

export interface GridPoint {
  x: number;
  z: number;
}

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
}

export interface MonsterCombatTurn {
  message: string;
  damage: number;
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

  private readonly patrolPoints: GridPoint[];
  private readonly detectionRadius: number;
  private patrolIndex = 0;
  private alerted = false;
  private telegraphed = false;

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
  }

  get isDown(): boolean {
    return this.hp <= 0;
  }

  get isAlerted(): boolean {
    return this.alerted;
  }

  private distanceToPlayer(): number {
    return Math.abs(this.player.gridX - this.x) + Math.abs(this.player.gridZ - this.z);
  }

  tick(): void {
    if (this.isDown) return;

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

  /** Resets alert state — used when the party successfully flees combat, so the monster doesn't immediately re-engage the moment exploration resumes (it's still adjacent). */
  disengage(): void {
    this.alerted = false;
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
      return {
        message: `${this.name} unleashes its heavy strike!`,
        damage: this.might * 3 + rollInt(rng, 1, 4),
      };
    }
    this.telegraphed = true;
    return {
      message: `${this.name} claws at you, and rears back for something heavier!`,
      damage: this.might + rollInt(rng, 1, 4),
    };
  }
}
