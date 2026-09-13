/**
 * Randomness abstraction — see docs/11-testing-strategy.md's
 * architecture requirement: anything that rolls dice has to go through
 * an injectable RNG rather than calling `Math.random()` directly, or
 * combat becomes untestable (initiative order, damage rolls, and the
 * monster's telegraph timing all need to be reproducible under a fixed
 * seed).
 */
export interface Rng {
  /** A float in [0, 1), like `Math.random()`. */
  next(): number;
}

/** The real RNG used in actual play. */
export class RandomRng implements Rng {
  next(): number {
    return Math.random();
  }
}

/**
 * A small deterministic PRNG (mulberry32) for tests and, if it's ever
 * wanted, a "seed of the day" mode. Same seed in, same sequence out —
 * that's the entire point.
 */
export class SeededRng implements Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/** An integer in [min, max], inclusive. */
export function rollInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}
