/**
 * Scene light tuning, pulled out of `Game.ts` as plain constants
 * specifically so `Lighting.test.ts` can sanity-check them without a
 * WebGL context — see docs/11-testing-strategy.md's worked example for
 * exactly what this guard rail can and can't catch (short version: it
 * stops a known-bad value from coming back; it would not have caught
 * the original bug, since nothing about `1.6` looked wrong on its own).
 *
 * Three.js has used physically-correct light units (candela-scale)
 * for years — there is no "legacy lights" toggle left in this version
 * to fall back on. Pre-physically-correct tutorial code (and this
 * project's own original scaffold) commonly used small values like
 * 0.5-2, which render as near-black under the current model.
 */

export const AMBIENT_LIGHT_COLOR = 0x40405a;
export const AMBIENT_LIGHT_INTENSITY = 3;

export const TORCH_COLOR = 0xffb46b;
export const TORCH_INTENSITY = 40;
export const TORCH_DISTANCE = 12;
export const TORCH_DECAY = 2;

/**
 * Floors below which a physically-correct-units light is effectively
 * invisible in a small dungeon corridor — calibrated against the
 * actual near-black regression this project shipped (ambient `0.7`,
 * torch `1.6`), not picked arbitrarily. Guards against reverting to
 * that regime, not against "is this pleasant to look at".
 */
export const MIN_AMBIENT_LIGHT_INTENSITY = 2;
export const MIN_TORCH_INTENSITY = 15;
