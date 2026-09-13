# Roadmap: Phased Implementation

**Rule for every phase below: it isn't done until it's playable.** Each
phase has an explicit "Playable when" gate — a real start-to-finish loop
a person can sit down and complete. If a phase's scope doesn't reduce to
something playable, split it rather than skip the gate. Don't start the
next phase's systems until the current phase's gate is met.

**"Playable" includes touch, on a phone-sized viewport, with no keyboard
or mouse.** Mobile is a platform requirement from Phase 0 onward (see
[01-vision.md](01-vision.md#platform--scope)), not a pass added at the
end — every phase gate below should be read as "playable with a keyboard
*and* playable with touch controls alone."

**Every phase also has an "Automated verification" gate alongside
"Playable when."** Full strategy in
[11-testing-strategy.md](11-testing-strategy.md) — the short version:
each phase's playability claim needs a test (or a small suite) that
proves it without a human, and that test gets written in the same phase
the feature ships in, not retrofitted later.

Every push to `main` auto-deploys to
**https://arm000.github.io/hollow-crown/** (see
[09-deployment.md](09-deployment.md)) — use that live URL, on an actual
phone, to check each phase's touch-playability gate rather than only
testing against a local dev server.

Phases are additive: each one keeps everything the previous phase made
playable working, and layers new systems on top.

---

## Phase 0 — Walking Skeleton ✅ Complete

**Scope:** Grid-locked first-person movement and rendering, playable by
keyboard or touch. One small hand-authored level. No interactables, no
entities, no UI beyond static HUD text and the on-screen touch pads.

**Built:** `DungeonMap`, `DungeonMesh`, `Player`, `InputManager`,
`TouchControls`, `Game`.

**Playable when:** Launch the game, walk a full lap of the level, turn,
strafe, hit walls without breaking anything — on a keyboard *and* on a
touch-only phone-sized viewport (on-screen movement/turn pads, no
keyboard). No crashes, no dead ends that shouldn't be dead ends.

**Automated verification:** `DungeonMap.test.ts` (level connectivity —
every floor tile reachable from the start, the automated form of "a
human can walk a full lap"), `Player.test.ts` (movement/wall-blocking,
turning, animation state), `InputManager.test.ts` (key mapping, queue
behavior) — all via `npm test`, run in CI on every PR and before every
deploy. The touch-control half of this gate (does tapping a pad actually
move the party) is not yet automated — that's the Playwright layer
designed in [11-testing-strategy.md](11-testing-strategy.md#3-browser-end-to-end-smoke-tests--playwright-real-headless-browser),
expected to land in Phase 1.

**Status:** Done — this is the current state of the repo. (Touch controls
were added after the mobile platform requirement was introduced,
retrofitted onto the original keyboard-only build so this phase's gate
stays true; the Vitest suite above was added the same way once automated
verification became a requirement.)

---

## Phase 1 — World Interaction & Objective

**Scope:**

- `Interactable` base entity type + concrete types: door (lockable),
  lever, pressure plate, pushable block, secret wall, lore item, exit
  tile.
- One small hand-authored level built specifically as a lock-and-key or
  lever puzzle (find a key or throw a switch to open the way to an exit).
- Minimal DOM HUD feedback: "The door is locked.", "You found a Rusted
  Key.", item pickups added to a placeholder inventory list (no UI
  polish needed yet — a plain text list is fine).
- A win state: reaching the exit tile with the right conditions met shows
  an end screen.

**New tech:** `Interactable` base class, tile-event/interact-key
handling, extended level data format (see
[07-technical-architecture.md](07-technical-architecture.md#level-data)),
minimal DOM HUD.

**Playable when:** A person can walk into the level knowing nothing,
figure out the puzzle (get a key, throw a lever, find a secret), and
reach a "You escaped" end screen. Complete, if tiny, beginning-to-end
loop.

**Automated verification:** unit tests on `Interactable` state
transitions (door locked→unlocked only with the right key, lever
correctly toggles its linked door, pressure plate held/released) and on
win-condition evaluation, plus a headless scripted-playthrough test that
runs the exact action sequence solving the puzzle and asserts the win
state fires — and a second script proving it does *not* fire without the
key/lever step, so the gate isn't just "some sequence wins" but "the
puzzle is actually required." See
[11-testing-strategy.md](11-testing-strategy.md#2-headless-scripted-playthroughs--vitest-still-no-browser).
This is also the target phase for wiring the Playwright E2E layer
(including the mobile-touch project), since it's the first phase with a
real DOM UI worth testing end-to-end.

**Status:** In progress, shipped in batches (each pushed and deployed
independently):
- ✅ Batch 1 — `Interactable`/`InteractableManager` foundation, `Door`
  (lockable), `KeyItem`, `ExitTile`, the interact action (keyboard
  `Space` + a touch button), the placeholder HUD message line and
  inventory list, the win screen, and a hand-authored key-and-door
  level. Game's movement/interact resolution was pulled out into a pure
  `GameLogic` module specifically so it's headlessly testable — see
  `StartingLevel.playthrough.test.ts` for the scripted positive/negative
  playthroughs.
- ✅ Batch 2 — `Lever` (toggles a linked door — a two-pass entity build
  since the lever needs the door's actual instance, not just its
  coordinates) and `LoreItem` (re-readable, interact-triggered rather
  than auto-pickup, per the docs' distinction). The level gained an
  optional branch: a lever unlocks a small bonus alcove with a lore
  item, entirely bypassable and not required to win — covered by its
  own headless playthrough alongside the main one.
- ✅ Batch 3 — `PushableBlock` (moved via a push-resolution step in
  `GameLogic`, not an interact), `PressurePlate` (state recomputed from
  scratch after every move — self-correcting, no separate on-exit event
  to keep in sync), and `SecretWall` (a normal wall tile whose entity
  overrides the raw grid once revealed; `DungeonMesh` now exposes
  `hideWallFace` so the revealed passage visually opens up, via
  zero-scaling that one `InstancedMesh` instance rather than rebuilding
  geometry). `Player.tryMove` was generalized to accept anything
  answering "is this blocked" instead of a `DungeonMap` specifically, so
  a revealed secret wall can actually override the raw grid rather than
  being silently re-blocked by Player's own internal wall check. Also
  fixed a real bug surfaced while testing this batch: `attemptInteract`
  checked the party's own tile before the tile it's facing, which meant
  standing on an item while facing a secret wall behind it always hit
  the item first — swapped to faced-first, own-tile-fallback.
- ⬜ Batch 4 — Playwright E2E layer remains a deliberate deferral, not
  part of this pass; final polish and doc sign-off.

---

## Phase 2 — Party & Turn-Based Combat

**Scope:**

- Hardcoded 4-character party (one pre-built character per class:
  Warrior/Rogue/Mage/Cleric), front/back rank.
- `WorldClock`: the world-turn tick described in
  [04-exploration-and-world.md](04-exploration-and-world.md#world-turns).
- One monster type ("aggressive melee" AI per
  [05-combat.md](05-combat.md#monster-ai-v1-scope)) that patrols and
  detects the party on the shared tick. Even with only Attack/Defend/Flee
  available this phase, this monster should already have a real,
  telegraphed signature mechanic (e.g. a heavy strike flagged one turn
  ahead that must be Defended or raced down) per
  [05-combat.md](05-combat.md#monster-design-every-type-is-a-lesson) —
  not a plain damage sponge. Damage-type resistance/weakness can wait for
  Phase 3, since that needs the Ability/Item actions to be meaningful.
- Combat trigger + `CombatController`: initiative roll, turn queue,
  Attack/Defend/Flee actions (Ability/Item can wait for Phase 3), combat
  DOM UI overlaying the first-person view.
- Victory (XP, return to exploration) and defeat (party wipe -> reload)
  handling. Downed/revive logic can be a stub (defeat just ends the
  encounter) if a real revive ability isn't built yet.

**New tech:** `Monster` entity, `WorldClock`, `Combatant` model,
`CombatController`, combat DOM UI, basic damage formula (see
[05-combat.md](05-combat.md#resolution) — expect to tune numbers here as
this phase is built).

**Playable when:** Explore Phase 1's puzzle loop (or a new small level
built for this phase) with a monster patrolling it, get into a fight,
resolve it turn-by-turn to a win or a loss, and see the game react
correctly either way — and losing that fight without ever Defending
through the telegraphed heavy strike should feel like a fair, avoidable
mistake, not bad luck.

**Automated verification:** this is the phase where randomness first
enters the game (initiative rolls), so the seedable-RNG requirement in
[11-testing-strategy.md](11-testing-strategy.md#architecture-requirements-for-testability)
lands here, not later — unit tests lock down `WorldClock` tick order,
the damage formula, and turn resolution against fixed seeds. A headless
scripted playthrough drives a fixed action sequence into the fight and
asserts the deterministic outcome, plus a second script that never
Defends through the telegraphed strike and asserts the resulting loss —
the automated version of "this loss was fair and avoidable," not just an
assertion in prose.

**Status:** Complete.

- `party/`: `Character` (five stats, HP/mana, Grace as the initiative
  stat), `Party` (isDefeated/livingMembers/livingFrontRank), and
  `roster.ts`'s hardcoded four (Bram/Ysolde/Corvin/Maren, one per
  class). HUD gained a party status line.
- `WorldClock`: one player action (move, turn, or interact — all three,
  not just movement) advances every registered `Tickable` once, per
  docs/04-exploration-and-world.md.
- `Monster` (`monster/Monster.ts`): patrols between fixed points,
  notices the party within a Manhattan-distance radius, closes in once
  alerted, and stops at adjacency rather than stacking onto the party's
  tile. Its combat turn alternates a lighter hit with a telegraphed
  heavy strike (might x3) — the "every monster is a lesson" mechanic
  from [05-combat.md](05-combat.md#monster-design-every-type-is-a-lesson),
  proven by the headless playthrough below rather than asserted in
  prose. `disengage()` clears alert state on a successful flee, so the
  party actually gets away instead of re-triggering combat next turn.
- `Rng` (`Rng.ts`): a `SeededRng` (mulberry32) and a `RandomRng`
  wrapping `Math.random()` — the seedable-RNG architecture requirement
  landed here as planned, threaded through initiative, damage rolls,
  the monster's target pick, and flee chance.
- `CombatEngine` (`combat/CombatEngine.ts`): pure logic, zero rendering
  dependency. Initiative re-rolled each round (Grace + d6), Attack/
  Defend/Flee, melee targets the front rank, Defend halves the next hit
  taken before the actor's next turn, victory/defeat/fled all handled.
  `CombatUI` (`combat/CombatUI.ts`) is the thin DOM layer on top —
  buttons plus number-key shortcuts, shown/hidden via the same
  `display:none` + `:not([hidden])` pattern learned from the win-screen
  bug (applied proactively this time, not as a second fix).
- One Rot-thing patrols the main corridor between the key and lever
  branches in `STARTING_LEVEL` — the encounter is mandatory, not a side
  room, so the "Playable when" gate is actually exercised by anyone
  reaching the exit.
- Defeat is the stub the roadmap allows: a `#defeat-screen` overlay and
  frozen input, no revive/reload system yet.

Tests: `WorldClock`, `Rng`/`SeededRng`, `Monster` (patrol, detection,
chase, combat-turn alternation, disengage), `CombatEngine` (attack,
victory, defeat, Defend's mitigation, flee, turn-order safety), plus
`RotThingEncounter.playthrough.test.ts` — a full party winning by
attacking, and (the phase's specific automated-verification ask) a
solo fragile combatant who is *guaranteed* downed within two monster
turns by never Defending, and *survives those same two hits* under the
same seed by Defending instead. 119 tests passing.

---

## Phase 3 — Character Depth & Equipment

**Scope:**

- Full class definitions: each of the 4 classes gets 1-2 real abilities
  (Ability combat action goes live), a level table, and stat growth
  (leveling per [03-party-and-characters.md](03-party-and-characters.md#leveling)).
  Ability design follows the counterplay principle in
  [03-party-and-characters.md](03-party-and-characters.md#classes) — each
  ability should be *the* answer to something, not just more damage.
- Damage types (Physical/Fire/Blight/Holy) and the status-effect set
  (Poison, Stun, Bleed, Fear, Silence) go live per
  [05-combat.md](05-combat.md#monster-design-every-type-is-a-lesson), and
  the Item combat action ships with the combat-countering consumables
  from [06-items-and-equipment.md](06-items-and-equipment.md#combat-countering-consumables).
- Equipment slots (Weapon/Off-hand/Armor/Accessory) with real stat
  effects; a slotted shared inventory UI (not spatial-grid — see
  [06-items-and-equipment.md](06-items-and-equipment.md#inventory-model)).
- Minimal party-creation/naming screen (pick class + portrait per slot;
  full point-buy attribute creation is a stretch goal, not required).
- A second monster type that's resistant to Physical and weak to Fire
  (the Cinder Wretch example in
  [05-combat.md](05-combat.md#a-teaching-ladder-illustrative-not-final-content)),
  so the phase proves damage types matter in a real fight, not just on
  paper. At least one non-combat puzzle should also depend on a class
  ability or found gear (e.g., a locked gate only Rogue lockpicking
  opens, or a chasm only a Mage spell crosses).

**New tech:** class/ability data tables, equipment stat-modifier system,
inventory UI, skill-check gating on interactables.

**Playable when:** Build and level a party across a slightly larger
level, equip gear found along the way, and see a specific build choice
(a class ability, a piece of gear) materially change how a specific
puzzle or fight plays out — not just bigger numbers in the same fights.
Concretely: fighting the Physical-resistant monster with only melee
should be a visibly bad time, and switching to Fire (Mage spell or an
Oil Flask) should visibly fix it.

**Automated verification:** unit tests on ability effects, equipment
stat modifiers, XP/level-up math, and damage-type resistance/weakness
application. A headless scripted playthrough is the direct proof behind
the "visibly bad time / visibly fixed" claim above: script the fight
against the Physical-resistant monster with melee-only and assert a
losing or costly outcome, then the same fight substituting a Fire spell
or Oil Flask and assert a clearly better one — an actual pass/fail
check, not a design intention.

**Status:** In progress, shipped in batches (each pushed and deployed
independently):

- ✅ Batch 1 — Damage types, abilities, status effects, and a second
  monster type:
  - `DamageType.ts`: Physical/Fire/Blight/Holy, a resistance/weakness
    multiplier applied via `applyResistance`. `Character` and `Monster`
    both carry a `resistances` map (empty by default — equipment is the
    only source so far, and none exists yet).
  - `StatusEffect.ts`: all five effects (Poison, Stun, Bleed, Fear,
    Silence) fully mechanically wired into `CombatEngine` — DoT
    ticking, skip-turn, forced-defend, ability-block — and unit tested
    directly. Only Bleed has an actual in-game source this phase (the
    Rogue's ability); the rest await a monster or item that inflicts
    them (Phase 4's Screeching Wraith is exactly that for Fear). The
    *mechanics* are real now, not placeholder — only some of their
    in-game triggers are staged for later.
  - `classes.ts` + `CombatEngine`: one ability per class, the "ability"
    combat action goes live. Warrior's Guard (redirect + mitigate),
    Rogue's Precision Strike (ignores resistance, applies Bleed),
    Mage's Firebolt (Fire damage), Cleric's Cleanse (clears status
    effects) — each answers something specific, per the counterplay
    principle in [03-party-and-characters.md](03-party-and-characters.md#classes).
  - `WorldState.monster` generalized to `monsters: Monster[]` — the
    game now supports more than one monster type coexisting in a level
    (this also directly sets up Phase 4's roster expansion).
    `bestiary.ts` holds monster-type factories; the Cinder Wretch
    (Physical-resistant, Fire-weak) now patrols the room by the lever,
    alongside Phase 2's Rot-thing.
  - Found and fixed a real timing bug while testing this: status
    effects were ticking (and expiring) at the *start* of the round
    they were applied in, so a 1-turn Stun/Fear/Silence would expire
    before it ever blocked anything. Fixed by ticking at round *end*
    instead — caught by the tests written specifically to exercise
    these mechanics, exactly the point of writing them.
  - `CinderWretchEncounter.playthrough.test.ts`: the phase's specific
    automated-verification ask — a solo, fragile Mage loses (or at best
    doesn't cleanly win) fighting the Wretch with melee alone under a
    fixed seed, and wins decisively under the *same* seed by using
    Firebolt instead. 148 tests passing.
- ⬜ Batch 2 — Equipment slots + stat modifiers + slotted inventory UI.
- ⬜ Batch 3 — Item combat action + combat-countering consumables (Oil
  Flask, Antidote, Bandages, Smelling Salts, Holy Water).
- ⬜ Batch 4 — Leveling (XP curve, level-up), a minimal party-creation/
  naming screen, and a non-combat puzzle gated by a class ability or
  found gear.

---

## Phase 4 — Multi-Level Descent & Persistence

**Scope:**

- Stairs/level-transition entity linking 2-3 authored levels into one
  small descent.
- Save/load via `localStorage`
  ([07-technical-architecture.md](07-technical-architecture.md#save-system)):
  party state, current level, position/facing.
- Monster roster expansion to 2-3 more types (cautious ranged, support,
  per [05-combat.md](05-combat.md#monster-ai-v1-scope)), each one
  actually clearing the "new lesson" bar in
  [05-combat.md](05-combat.md#monster-design-every-type-is-a-lesson) —
  e.g. the Screeching Wraith (Fear) and Court Alchemist (kill-the-healer
  priority) from the teaching-ladder example. A monster that's just a
  stat variant of an existing type doesn't count toward this scope item.
- Bestiary/codex UI: once a monster type has been encountered, its known
  resistance/weakness/status/signature mechanic becomes visible in a
  simple codex screen, per
  [05-combat.md](05-combat.md#the-bestiary) — small scope (a list + detail
  view), but this is what turns "I got lucky" into "I remembered its
  weakness" for repeat encounters.
- A real difficulty curve across the levels, tuned by hand.

**New tech:** level-transition manager, save/load serialization, monster
AI variety, bestiary/codex UI and its backing data.

**Playable when:** Descend through the full small multi-level dungeon,
quit mid-session, relaunch, resume from the save, and finish the
descent — with a difficulty curve that's noticeably harder at the bottom
than the top, and where each new monster type met along the way plays
differently enough that "check the codex, then fight" is a real, useful
habit rather than a formality.

**Automated verification:** a save/load round-trip test (serialize party
+ level + position state, deserialize, assert it's identical to the
original — this is the kind of bug that's invisible until someone's
actual save gets corrupted, exactly what this gate exists to catch),
unit tests on the new monster AI behaviors and on
level-transition state, and a headless scripted playthrough of the full
multi-level descent end to end. If Playwright landed in Phase 1, its
suite gets a save/reload E2E case here too (quit and relaunch really is
a browser-level concern, not just a logic one).

---

## Phase 5 — Content & Narrative Pass

**Scope:**

- Weave in *The Hollow Crown* story per
  [02-setting-and-story.md](02-setting-and-story.md): lore items, 1-2 NPC
  encounters, a mid-dungeon reveal, a boss fight tied to the plot. Per
  the teaching-ladder idea in
  [05-combat.md](05-combat.md#a-teaching-ladder-illustrative-not-final-content),
  the boss should combine mechanics from 2-3 earlier monster types rather
  than introduce an unrelated new gimmick — it reads as "everything
  you've learned, at once" rather than one more new thing to learn cold.
- Environmental art pass: pixel art textures and sprites replacing the
  flat wall/floor/ceiling colors and the low-res-render + nearest-filter
  pipeline, both per
  [10-visual-style-guide.md](10-visual-style-guide.md), plus varied
  lighting per room instead of just the carried torch.
- Audio: footsteps, combat SFX, ambient loop(s).
- Minimap (top-down render sourced from the same level data as the 3D
  geometry).
- Fully-unidentified items and cursed gear, if still wanted — the
  level-2 stretch tier in
  [06-items-and-equipment.md](06-items-and-equipment.md#discovery-not-explanation).
  Note this is on top of, not instead of, the no-tooltip-explanations
  discovery principle in that doc, which has already been true since
  items first existed.

**New tech:** texture/material pipeline, audio manager, minimap renderer,
simple lore/dialogue text UI.

**Playable when:** A vertical slice that feels tonally like *the game*,
not a systems demo — a full descent through one act, story beats landing
in the first-person view itself, ending in a boss fight, with sound and
lighting doing real atmospheric work.

**Automated verification:** the boss fight's combined mechanics get the
same combat unit/scripted-playthrough coverage as any other monster (per
[05-combat.md](05-combat.md#a-teaching-ladder-illustrative-not-final-content),
it's assembled from 2-3 already-tested mechanics, so most of this is
composition, not new logic) — and a unit test on the minimap's data
mapping (does it place rooms/corridors where the source level data says
they are). Per the non-goals in
[11-testing-strategy.md](11-testing-strategy.md#non-goals), the art,
audio, and narrative content itself is **not** automatically verified —
only the underlying logic and data are. "Does this feel tonally right"
stays a human judgment call.

---

## Phase 6 — Full Campaign & Release Polish

**Scope:**

- Remaining acts/levels through to a real ending (see the four acts in
  [02-setting-and-story.md](02-setting-and-story.md#structure) — exact
  count to ship in v1 is decided once Phase 5's pacing is known).
- Full monster/item roster, balancing pass across the whole campaign.
- Options menu (key rebinding, volume), any accessibility basics.
- Performance profiling (see
  [07-technical-architecture.md](07-technical-architecture.md#performance)).
- Packaging for distribution (static web build at minimum; itch.io
  and/or an Electron desktop wrap are options, not requirements).

**Playable when:** A start-to-finish playthrough of the complete game at
shippable quality — this phase's gate *is* the release.

**Automated verification:** a full-campaign headless scripted playthrough
(and, if Playwright's overhead is worth it by now, a real-browser
equivalent) as the release smoke test, plus balance sanity checks that
are cheap to assert automatically and easy to accidentally break by hand
(XP/level curves stay monotonic, no stat or resistance value produces
negative HP or a division by zero, every item/ability referenced by a
level actually exists in the data tables). This is the last phase before
release — from here on, changes are regression-only maintenance against
an existing test suite, not new coverage to write, which is exactly why
every earlier phase's tests needed to actually get written on schedule
rather than deferred to "eventually."

---

## Notes on sequencing

- Phases are ordered so each new system has the smallest possible
  playable level to prove itself in before the next system stacks on
  top — combat (Phase 2) doesn't need to wait for full character depth
  (Phase 3), and multi-level persistence (Phase 4) doesn't need to wait
  for art (Phase 5).
- If a phase turns out bigger than expected once we're in it, split it
  into sub-phases with their own gates rather than quietly widen the
  scope of the phase in place — update this doc when that happens so it
  stays a true description of the plan.
