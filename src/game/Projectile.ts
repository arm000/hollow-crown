import * as THREE from "three";

const PROJECTILE_DURATION = 0.25;

/**
 * Pure animation math for a ranged skill's placeholder VFX
 * (docs/14-asset-inventory.md, on a player request for spell-effect
 * placeholders) — a small colored bolt traveling in a straight line
 * from wherever it was fired to wherever it was aimed, over a fixed
 * duration. No Three.js scene/material access of its own; `Game.ts`
 * reads `position()`/`color`/`isActive` every frame and applies them to
 * a real mesh, the same "pure state, dumb renderer applies it" split
 * `MonsterAnimator.ts`/`Player.ts` already use — and why this is a
 * real, unit-tested class rather than inline state in the untested
 * `Game.ts` glue layer.
 *
 * Only one projectile is ever in flight at a time — v1 combat is
 * strictly one party action at a time, so there's never a reason for
 * more — `fire()` simply restarts the single flight in progress rather
 * than queuing, unlike `MonsterAnimator.play()`.
 */
export class Projectile {
  private t = 1;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private _color = 0xffffff;

  get isActive(): boolean {
    return this.t < 1;
  }

  /** Meaningless (but harmless) to read once `isActive` is false. */
  get color(): number {
    return this._color;
  }

  /** Starts a new flight from `from` to `to`, replacing whatever (if anything) was already in flight. */
  fire(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    this.from.copy(from);
    this.to.copy(to);
    this._color = color;
    this.t = 0;
  }

  update(deltaSeconds: number): void {
    if (this.t >= 1) return;
    this.t = Math.min(1, this.t + deltaSeconds / PROJECTILE_DURATION);
  }

  /** Ends whatever's in flight immediately — a fresh encounter starting shouldn't carry over a stale bolt from the last one, same reasoning as `MonsterAnimator.reset()`. */
  cancel(): void {
    this.t = 1;
  }

  /** A fresh `Vector3` each call, linearly interpolated between `from` and `to` — call only while `isActive`. */
  position(): THREE.Vector3 {
    return new THREE.Vector3().lerpVectors(this.from, this.to, this.t);
  }
}
