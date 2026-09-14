import { describe, expect, it } from "vitest";
import { MonsterAnimator } from "./MonsterAnimator";

describe("MonsterAnimator", () => {
  it("starts idle: no offset, normal scale, no flash", () => {
    const animator = new MonsterAnimator();
    expect(animator.isAnimating).toBe(false);
    expect(animator.positionOffset(0, 0, 1, 0)).toEqual({ x: 0, y: 0, z: 0 });
    expect(animator.scale).toBe(1);
    expect(animator.flashIntensity).toBe(0);
  });

  describe("attack", () => {
    it("lunges toward the target and back to zero by the end", () => {
      const animator = new MonsterAnimator();
      animator.play("attack");
      animator.update(0.001); // start it running
      expect(animator.isAnimating).toBe(true);

      // Partway through: some nonzero offset toward the target.
      animator.update(0.1);
      const mid = animator.positionOffset(0, 0, 1, 0);
      expect(mid.x).toBeGreaterThan(0);
      expect(mid.z).toBe(0);

      // Run it out to completion.
      animator.update(10);
      expect(animator.isAnimating).toBe(false);
      expect(animator.positionOffset(0, 0, 1, 0)).toEqual({ x: 0, y: 0, z: 0 });
    });

    it("offsets along the straight line from the monster toward the party, any direction", () => {
      const animator = new MonsterAnimator();
      animator.play("attack");
      animator.update(0.1); // partway through, nonzero lunge

      const towardNegX = animator.positionOffset(5, 5, 4, 5); // target is west
      expect(towardNegX.x).toBeLessThan(0);
      expect(towardNegX.z).toBeCloseTo(0);

      const towardPosZ = animator.positionOffset(5, 5, 5, 6); // target is south
      expect(towardPosZ.x).toBeCloseTo(0);
      expect(towardPosZ.z).toBeGreaterThan(0);
    });

    it("doesn't affect scale or flash -- those are the hit reaction's job", () => {
      const animator = new MonsterAnimator();
      animator.play("attack");
      animator.update(0.1);
      expect(animator.scale).toBe(1);
      expect(animator.flashIntensity).toBe(0);
    });
  });

  describe("hit", () => {
    it("punches the scale up and flashes, both fading back to neutral by the end", () => {
      const animator = new MonsterAnimator();
      animator.play("hit");
      animator.update(0.001);

      animator.update(0.05);
      expect(animator.scale).toBeGreaterThan(1);
      expect(animator.flashIntensity).toBeGreaterThan(0);

      animator.update(10);
      expect(animator.isAnimating).toBe(false);
      expect(animator.scale).toBe(1);
      expect(animator.flashIntensity).toBe(0);
    });

    it("doesn't produce a position offset -- that's the attack lunge's job", () => {
      const animator = new MonsterAnimator();
      animator.play("hit");
      animator.update(0.1);
      expect(animator.positionOffset(0, 0, 1, 0)).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  it("queues a second animation rather than cutting the first one off, so both play in sequence", () => {
    const animator = new MonsterAnimator();
    animator.play("hit");
    animator.play("attack");
    animator.update(0.001);

    // The hit is still the one actually running.
    expect(animator.scale).toBeGreaterThan(1);

    // Finish it -- the queued attack should then take over on its own.
    animator.update(10);
    expect(animator.isAnimating).toBe(true); // the queued attack picked up
    animator.update(0.001);
    expect(animator.scale).toBe(1); // hit is over
    const offset = animator.positionOffset(0, 0, 1, 0);
    expect(offset.x).toBeGreaterThanOrEqual(0); // the attack lunge is now running
  });

  it("reset drops anything queued or in progress", () => {
    const animator = new MonsterAnimator();
    animator.play("hit");
    animator.play("attack");
    animator.update(0.05);
    expect(animator.isAnimating).toBe(true);

    animator.reset();

    expect(animator.isAnimating).toBe(false);
    expect(animator.scale).toBe(1);
    expect(animator.flashIntensity).toBe(0);
    animator.update(10); // nothing left queued to pick up
    expect(animator.isAnimating).toBe(false);
  });
});
