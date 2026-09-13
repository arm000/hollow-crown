/**
 * Scene light tuning, pulled out of `Game.ts` as plain constants
 * specifically so `Lighting.test.ts` can sanity-check them without a
 * WebGL context — see docs/11-testing-strategy.md's worked example for
 * what this guard rail can and can't catch, and for the full story
 * behind the numbers here (short version below).
 *
 * Three.js has used physically-correct light units (candela-scale) for
 * years, with no "legacy lights" toggle left in this version to fall
 * back on. This project's original scaffold used small pre-correction
 * values (ambient 0.7, torch 1.6), which was a real mismatch — but *not*
 * the actual cause of the "too dark" reports it got blamed for. The
 * real cause was an unrelated CSS bug (a near-opaque full-screen overlay
 * visible from page load); once that was fixed, a second round of much
 * larger values tuned to compensate for it (ambient 12, torch 150,
 * exposure 1.4) turned out too bright. These are a third, deliberately
 * modest pass — closer to the first correction than the second — now
 * that the overlay confound is gone and "too bright" is real signal
 * about the lights specifically, not about something else on top of
 * them.
 */

export const AMBIENT_LIGHT_COLOR = 0x40405a;
export const AMBIENT_LIGHT_INTENSITY = 3;

export const TORCH_COLOR = 0xffb46b;
export const TORCH_INTENSITY = 35;
export const TORCH_DISTANCE = 10;
export const TORCH_DECAY = 2;

/**
 * Floors guarding against reverting to the original pre-physically-
 * correct-units values (ambient 0.7, torch 1.6) specifically — that
 * mismatch was real even though it wasn't the actual cause of either
 * "too dark" report. Not a claim that anything just above these floors
 * is confirmed to look right; only that going back to the old scale
 * would be a known regression in convention, not just in brightness.
 */
export const MIN_AMBIENT_LIGHT_INTENSITY = 2;
export const MIN_TORCH_INTENSITY = 15;
