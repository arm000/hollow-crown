import * as THREE from "three";

export type MonsterAnimKind = "attack" | "hit";

const ATTACK_DURATION = 0.35;
const HIT_DURATION = 0.25;
/** World units the monster lunges toward the party on its own attack — small on purpose, the corridor is narrow and this is a capsule placeholder, not a rigged character (docs/10-visual-style-guide.md's art pass is still ahead). */
const ATTACK_LUNGE_DISTANCE = 0.5;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** An out-and-back envelope: eases up to a peak at the animation's midpoint, then back down to 0 by the end — the shape both the attack lunge and the hit punch/flash share. */
function outAndBack(t: number): number {
  return t < 0.5 ? easeOutCubic(t * 2) : 1 - easeOutCubic((t - 0.5) * 2);
}

/**
 * Pure animation math for a monster's mesh reacting to combat
 * (docs/08-roadmap-phases.md Phase 7, on a player request for attack
 * animations): lunging toward the party on its own attack, or a quick
 * punch-and-flash when the party's attack lands. No Three.js
 * scene/material access of its own — `Game.ts` reads `positionOffset`/
 * `scale`/`flashIntensity` every frame and applies them to the real
 * mesh itself, the same "pure state, dumb renderer applies it" split
 * `Player.ts`'s own move/turn animation already uses, which is also
 * why this is a real, unit-tested class rather than inline state in
 * the untested `Game.ts` glue layer.
 *
 * `play()` queues rather than instantly overwriting: a party hit and
 * the monster's own automatic counter-attack can both land within the
 * same `CombatEngine.submitAction` call (see `Game.ts`'s
 * `handleCombatAction`), and showing them as two quick beats in
 * sequence — hit flash, then the counter-attack's lunge — reads far
 * better than the second instantly cutting off the first.
 */
export class MonsterAnimator {
  private queue: MonsterAnimKind[] = [];
  private current: MonsterAnimKind | undefined;
  private t = 1;

  get isAnimating(): boolean {
    return this.current !== undefined || this.queue.length > 0;
  }

  /** Queues an animation to play once whatever's currently running (if anything) finishes. */
  play(kind: MonsterAnimKind): void {
    this.queue.push(kind);
  }

  /** Drops anything queued or in progress — a fresh encounter starting shouldn't carry over a stale animation from the last one. */
  reset(): void {
    this.queue = [];
    this.current = undefined;
    this.t = 1;
  }

  update(deltaSeconds: number): void {
    if (this.current === undefined) {
      this.current = this.queue.shift();
      this.t = 0;
    }
    if (this.current === undefined) return;

    const duration = this.current === "attack" ? ATTACK_DURATION : HIT_DURATION;
    this.t = Math.min(1, this.t + deltaSeconds / duration);
    if (this.t >= 1) this.current = undefined; // finished -- the next update() call picks up the queue, if anything
  }

  /**
   * World-space offset to add to the monster mesh's grid position this
   * frame, a straight line from `(fromX, fromZ)` toward
   * `(towardX, towardZ)` — zero outside an "attack" animation.
   */
  positionOffset(fromX: number, fromZ: number, towardX: number, towardZ: number): THREE.Vector3 {
    if (this.current !== "attack") return new THREE.Vector3();
    const dx = towardX - fromX;
    const dz = towardZ - fromZ;
    const length = Math.hypot(dx, dz) || 1;
    const lunge = outAndBack(this.t) * ATTACK_LUNGE_DISTANCE;
    return new THREE.Vector3((dx / length) * lunge, 0, (dz / length) * lunge);
  }

  /** Scale multiplier for the "hit" reaction's punch — 1 (no change) outside it. */
  get scale(): number {
    if (this.current !== "hit") return 1;
    return 1 + outAndBack(this.t) * 0.25;
  }

  /** 0-1 flash brightness for the "hit" reaction, fading out linearly — 0 outside it. */
  get flashIntensity(): number {
    if (this.current !== "hit") return 0;
    return 1 - this.t;
  }
}
