import { describe, expect, it } from "vitest";
import {
  AMBIENT_LIGHT_INTENSITY,
  MIN_AMBIENT_LIGHT_INTENSITY,
  MIN_TORCH_INTENSITY,
  TORCH_INTENSITY,
} from "./Lighting";

/**
 * A regression guard, not a bug-finder — see the worked example in
 * docs/11-testing-strategy.md. This would have stopped the near-black
 * lighting bug from silently coming back once we knew the floor to
 * check against; it would *not* have caught it the first time, since a
 * plain Node test has no WebGL context to render a frame and see that
 * it was too dark.
 */
describe("Lighting", () => {
  it("ambient light intensity stays above the known near-black floor", () => {
    expect(AMBIENT_LIGHT_INTENSITY).toBeGreaterThanOrEqual(MIN_AMBIENT_LIGHT_INTENSITY);
  });

  it("torch intensity stays above the known near-black floor", () => {
    expect(TORCH_INTENSITY).toBeGreaterThanOrEqual(MIN_TORCH_INTENSITY);
  });
});
