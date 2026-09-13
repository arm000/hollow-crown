import { describe, expect, it } from "vitest";
import { rollInt, SeededRng } from "./Rng";

describe("SeededRng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    const sequenceA = Array.from({ length: 10 }, () => a.next());
    const sequenceB = Array.from({ length: 10 }, () => b.next());
    expect(sequenceA).toEqual(sequenceB);
  });

  it("produces a different sequence for a different seed", () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("always returns a value in [0, 1)", () => {
    const rng = new SeededRng(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("rollInt", () => {
  it("never falls outside [min, max]", () => {
    const rng = new SeededRng(123);
    for (let i = 0; i < 1000; i++) {
      const value = rollInt(rng, 1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("handles a single-value range", () => {
    const rng = new SeededRng(1);
    expect(rollInt(rng, 5, 5)).toBe(5);
  });
});
