# Testing Strategy

**Every feature needs a way to verify it works without a human clicking
through the game.** This doc is the parallel track to
[08-roadmap-phases.md](08-roadmap-phases.md): each phase there has a
"Playable when" gate that a human checks; each phase also gets an
**automated verification** gate here that a machine checks, and neither
gate is optional. A phase that's "playable" but has no automated check
is one uncaught regression away from silently breaking again later.

This does **not** replace human playtesting. Automated tests catch
*regressions* — "this used to work and now it doesn't." They cannot
judge whether a fight is fun or a puzzle is fair-but-hard (pillar 2 in
[01-vision.md](01-vision.md)); that's still a human call. What automated
tests buy is that a human never has to *re-verify* something that was
already working, every single time something else changes.

## Architecture requirements for testability

These aren't optional extras bolted on later — they have to be true of
how each feature is built in the first place, or testing it headlessly
becomes impractical after the fact.

1. **Game logic has zero rendering/DOM dependencies.** Grid position,
   facing, HP, inventory, combat resolution, monster AI decisions,
   interactable state — all of it lives in plain TypeScript classes that
   never import a browser API and never touch `THREE.WebGLRenderer` or
   the DOM. `DungeonMap`, and the grid/facing/animation-progress state in
   `Player`, already follow this today (see their test files); keep
   extending logic this way rather than mixing it into rendering code.
   The only things allowed to need a real browser are the renderer
   itself and DOM UI — and those get a different test layer (below), not
   skipped entirely.
2. **Every input source is injectable.** `InputManager` already takes an
   optional `target: Window` in its constructor specifically so a test
   can hand it a fake event target instead of the real `window` — this
   is the pattern to keep using for anything that would otherwise force
   a test into a real browser (see `InputManager.test.ts`).
3. **Randomness is seedable.** Nothing exists yet that rolls dice
   (initiative, damage variance, monster AI randomness, loot), but the
   moment [Phase 2](08-roadmap-phases.md#phase-2--party--turn-based-combat)
   introduces any of it, that randomness must go through an injectable
   RNG (a `Rng` interface/class threaded through combat and AI code)
   rather than calling `Math.random()` directly. Otherwise combat tests
   become flaky or untestable outright — "does initiative order come out
   right" is only checkable with a fixed seed.
4. **A minimal debug/inspection hook for browser-integration tests.**
   Pure logic tests (layer 1 below) can't catch "the button exists in
   the DOM but nothing is wired to it" — that needs a real browser
   driving the real page (layer 3 below). To assert anything meaningful
   from outside the page (e.g. "did tapping the move pad actually change
   the party's grid position"), the game needs to expose a small,
   read-only inspection surface, gated to a dedicated build so it never
   ships to players:
   ```ts
   if (import.meta.env.MODE === "e2e") {
     (window as unknown as { __hollowCrown?: unknown }).__hollowCrown = {
       getPlayerGrid: () => ({ x: player.gridX, z: player.gridZ, facing: player.facing }),
     };
   }
   ```
   Built via a dedicated `vite build --mode e2e` (or served via `vite
   --mode e2e` for a dev-server-backed test run), never the plain
   `npm run build` that ships to
   [GitHub Pages](09-deployment.md) — Vite's dead-code elimination
   strips the whole block from any other mode, so this never reaches
   players. **Not yet implemented** — this is the design for whenever
   layer 3 (below) is actually wired in, expected around
   [Phase 1](08-roadmap-phases.md#phase-1--world-interaction--objective).

## The three test layers

### 1. Unit/logic tests — Vitest, no browser

Fast, run in plain Node, cover the actual game rules. **This is
implemented now** (`vitest`, `npm test`), covering the logic that
already exists:

- `DungeonMap.test.ts` — tile lookups, out-of-bounds handling, and a
  flood-fill connectivity check on `STARTING_LEVEL` that verifies every
  floor tile is reachable from the start — the automated equivalent of
  "a human can walk a full lap of the level" from Phase 0's playability
  gate.
- `Player.test.ts` — movement blocked by walls, grid position updates,
  the animation state machine (`isAnimating`, camera settling exactly on
  the destination), facing wraparound, and the shortest-path turn
  adjustment (a real bug class in naive angle lerping, worth its own
  regression test).
- `InputManager.test.ts` — action queue FIFO order, the keyboard→action
  mapping (including the WASD/arrow-key overlap and the deliberate
  asymmetry where arrow keys mirror turn, not strafe), key-repeat
  filtering.

Every future phase's logic gets this same treatment as it's written —
not deferred to "later," which was the old (now wrong) framing of the
`Testing` section in
[07-technical-architecture.md](07-technical-architecture.md#testing).
Concretely, expected coverage per phase:

| Phase | New logic to unit-test |
| --- | --- |
| 1 | Interactable state transitions (locked→unlocked, lever→linked door, pressure-plate held/released), win-condition evaluation |
| 2 | `WorldClock` tick ordering, initiative roll (seeded), damage formula, turn resolution, victory/defeat detection |
| 3 | Ability effects, equipment stat modifiers, XP/level-up math, damage-type resistance/weakness application |
| 4 | Save/load round-trip (serialize then deserialize reproduces identical state), level-transition state, additional monster AI behaviors |
| 5+ | Whatever new logic ships — the rule doesn't relax with content growth |

### 2. Headless scripted playthroughs — Vitest, still no browser

A step up from isolated unit tests: drive the actual game-logic classes
(not the renderer) through a scripted sequence of actions and assert the
end state, simulating a full playthrough without any UI at all. This is
the direct automated stand-in for a phase's "Playable when" gate,
runnable in CI on every push:

- **Phase 0** (retroactively expressible now that the logic exists):
  script a lap around `STARTING_LEVEL` (a fixed sequence of
  forward/turn actions) and assert the player ends back at the start
  tile facing the original direction, with no exception thrown along
  the way.
- **Phase 1**: script the exact sequence that solves the level's
  lock-and-key/lever puzzle and assert the win state fires; separately,
  assert that reaching the exit *without* the key does not.
- **Phase 2**: script a party walking into the one monster's detection
  radius, resolve combat with a fixed RNG seed, and assert the
  deterministic outcome (win, correct XP awarded) — plus a second script
  that never Defends through the telegraphed heavy strike, asserting the
  loss is real and traceable, per the "hard but fair" rule in
  [05-combat.md](05-combat.md#monster-design-every-type-is-a-lesson).
- **Phase 3+**: script fighting the Physical-resistant monster with only
  melee (assert it goes badly) vs. with Fire (assert it doesn't) — this
  is the automated proof behind Phase 3's "Playable when" claim in the
  roadmap, not just an assertion in prose.

### 3. Browser end-to-end smoke tests — Playwright, real headless browser

Catches what layers 1-2 structurally can't: wiring bugs (a button exists
in the DOM but nothing listens to it), rendering-integration breakage,
and — directly relevant to the mobile platform requirement in
[01-vision.md](01-vision.md#platform--scope) — whether touch controls
actually work, checked by a machine instead of a human physically
tapping a phone every time.

**Designed, not yet implemented** (tracked to land alongside Phase 1's
first real DOM UI, using the debug hook described above):

- Tooling: `@playwright/test`, with a config running (at least) a
  desktop Chromium project and a mobile-emulated project (a Playwright
  built-in device profile — touch-enabled, coarse pointer — so the
  `@media (hover: none) and (pointer: coarse)` touch-control CSS in
  `index.html` actually activates during the test, the same condition a
  real phone triggers).
- Target: the `e2e`-mode build (see above) served via `vite preview
  --mode e2e` or similar, driven by Playwright's `webServer` config so
  the whole suite runs with one command in CI.
- Example assertions once wired: page loads with no console errors;
  pressing `KeyW` changes `window.__hollowCrown.getPlayerGrid()`; on the
  mobile project, tapping the on-screen move-pad button produces the
  same grid change that `KeyW` does on desktop — closing the exact gap
  flagged when `TouchControls` first shipped ("I couldn't test on an
  actual physical touchscreen from here"); render a frame at the start
  position and assert average pixel luminance is above a floor — see
  the worked example just below for why this one matters.

## A worked example: the near-black lighting bug

A real bug that's useful for calibrating what these layers can and
can't actually catch. Phase 1's scene lights were tuned using
pre-physically-correct Three.js intensity conventions (small values
like `0.7`/`1.6`); Three.js has used physically-correct, candela-scale
light units for years with no "legacy lights" toggle left to fall back
on, so the scene rendered near-black. A user report ("I can't see
anything") caught it — not a test.

- **Layer 1 (Vitest, no browser) structurally could not have caught
  this.** `Game.ts` owns the `THREE.WebGLRenderer` and both lights, and
  is deliberately outside what layer 1 touches (see "Architecture
  requirements for testability" above) — a plain Node test has no
  WebGL context to render a frame and observe that it came out too
  dark. This isn't a gap we forgot to cover; it's the boundary the
  architecture draws on purpose.
- **What layer 1 *can* do, once the bug is understood**: the tuning
  values were pulled out into `Lighting.ts` as plain exported constants
  specifically so a cheap guard-rail test (`Lighting.test.ts`) can
  assert they stay above a known-bad floor. Be honest about what this
  buys: it's a **regression net, not a bug-finder**. It stops the exact
  old value from silently coming back; it would not have caught the bug
  the first time, because nothing about `1.6` looked wrong on its own
  — it only became "obviously too low" once we knew the physically-
  correct-units floor to compare it against.
- **What would actually catch this class of bug**: the rendered-frame
  brightness check added to layer 3's example assertions above — render
  a frame, sample average pixel luminance, assert it clears a floor.
  This is meaningfully lighter-weight than the screenshot-diff visual
  regression testing ruled out below (it doesn't break on every
  intentional art/color change, only on "the scene went dark"), which
  is exactly the kind of narrow, specific exception the non-goal below
  already leaves room for.
- **What nothing here catches**: whether the brightness is actually
  *pleasant*, or tonally right, once it clears "not literally
  unplayable". That's still pillar 6's human gate in
  [01-vision.md](01-vision.md#pillars) — automated tests catch
  regressions, not fitness for purpose.

## CI wiring

Implemented now:

- **`.github/workflows/ci.yml`** — runs on every pull request:
  typecheck, `npm test` (layers 1-2 above), and a production build.
  Gives fast feedback before anything merges, with no human needing to
  remember to run tests locally first.
- **`.github/workflows/deploy.yml`** — the Pages deploy job now runs
  typecheck and `npm test` before `npm run build`, so a failing test
  blocks the live deploy at
  [https://arm000.github.io/hollow-crown/](09-deployment.md) directly,
  not just a parallel workflow that could pass or fail independently of
  whether the site actually got published.

Once Playwright (layer 3) is wired in, its suite joins both workflows
the same way — it's slower than the Vitest layers, so if it ever gets
slow enough to matter, split it into its own job that runs in parallel
with (not blocking) the fast unit-test job, and only gate the *deploy*
on both.

## Non-goals

- **No visual regression/screenshot-diff testing.** Pixel-perfect
  screenshot comparison is high-maintenance (breaks on every intentional
  visual change) and the art is still flat placeholder color through
  [Phase 4](08-roadmap-phases.md#phase-4--multi-level-descent--persistence)
  anyway per [10-visual-style-guide.md](10-visual-style-guide.md#where-this-lands-in-the-roadmap)
  — revisit only if a specific recurring rendering bug (not just "did
  the art change") justifies it. The average-luminance floor check in
  the worked example above is exactly that kind of narrow exception,
  not a reversal of this non-goal: it only fails on "the scene is
  unplayably dark," not on any ordinary visual change.
- **No automated fuzzing of hand-authored level layouts.** Levels are
  hand-authored, not generated (per
  [01-vision.md](01-vision.md#explicit-non-goals-for-now)), so the thing
  worth testing is "is *this specific* level solvable/connected" (layer
  1/2, per-level) — not a general solver for arbitrary levels that don't
  exist.
- **No load/stress testing.** Single-player, client-side, no backend —
  there's no server capacity question to test.
- **Automated tests don't replace the "Playable when" human gates in
  [08-roadmap-phases.md](08-roadmap-phases.md).** A phase still isn't
  done until both gates pass — a green test suite that nobody has
  actually played is exactly the kind of thing pillar 6 in
  [01-vision.md](01-vision.md#pillars) ("playable beats feature-complete")
  is warning against.
