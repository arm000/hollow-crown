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
 *
 * This has already been tuned blind twice without anyone confirming the
 * result on an actual screen (no rendering/screenshot tool is available
 * in this environment) — first ambient 0.7/torch 1.6 (reported as
 * unreadably dark), then ambient 3/torch 40 with no tone mapping
 * (*also* reported as too dark). The current values, paired with
 * `Game.ts` now setting `ACESFilmicToneMapping`, are a considerably
 * more generous third attempt, biased toward "definitely visible, maybe
 * too bright" rather than repeating an undershoot. Still unconfirmed —
 * see the note in Game.ts and ask for a screenshot before tuning this
 * again rather than guessing a fourth time.
 */

export const AMBIENT_LIGHT_COLOR = 0x40405a;
export const AMBIENT_LIGHT_INTENSITY = 12;

export const TORCH_COLOR = 0xffb46b;
export const TORCH_INTENSITY = 150;
export const TORCH_DISTANCE = 15;
export const TORCH_DECAY = 2;

/**
 * Floors below which a physically-correct-units light is known, from
 * this project's own two prior misses, to be too dark in a small
 * dungeon corridor. Not a promise that clearing these floors looks
 * *good* — only that we've already confirmed (by user report) that
 * ambient 3 / torch 40 without tone mapping was still too dark, so
 * settling for that regime again would be a known regression.
 */
export const MIN_AMBIENT_LIGHT_INTENSITY = 8;
export const MIN_TORCH_INTENSITY = 80;
