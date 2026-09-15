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

**Follow-up fix (found via user report during Phase 3):** a secret
wall's cell is `#` in the raw grid, so it was never treated as a "floor
cell" during `DungeonMesh` generation — meaning its *other* two sides
(the genuine solid walls perpendicular to the passage) never got any
geometry built for them at all. Once revealed and walkable, those sides
were invisible but still solid: never built, not merely hidden — "I can
walk through them, but I can see through them" was actually the
opposite tile's problem reported from inside the passage. `DungeonMesh`
now takes the level's secret-wall coordinates and builds their other
sides as permanent, always-visible faces, kept deliberately separate
from `hideWallFace`'s hideable set. `DungeonMesh.test.ts` (new — this
class of Three.js object was previously untested, though nothing stops
it running headlessly like `Player.test.ts` does) proves the fix
directly: declaring a cell secret adds exactly its genuine-wall
neighbors' faces, and revealing it hides only the passage-direction
faces, never the sides. 168 tests passing.

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

**Status:** Complete, shipped in batches (each pushed and deployed
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
- ✅ Batch 2 — Equipment slots + stat modifiers:
  - `Equipment.ts`: the four slots (Weapon/Off-hand/Armor/Accessory),
    `EQUIPMENT_ITEMS` as plain data (a sword, a buckler, armor, a
    charm). `Character` gained `equip`/`unequip`/`equippedIn`/
    `listEquipment`, plus `effectiveStats`/`effectiveResistances`
    getters that merge base stats/resistances with everything
    equipped — base `stats`/`resistances` never mutate.
  - `CombatEngine` now reads `effectiveStats`/`effectiveResistances`
    everywhere it used to read the raw fields (Attack, Precision
    Strike, Firebolt, flee chance, initiative, incoming damage) — an
    integration test confirms equipment changes real combat damage,
    not just the `Character` unit in isolation.
  - Two findable pickups: a sword for Bram, and — pointedly — a
    fire-resisting charm for Corvin sitting in the room the Cinder
    Wretch patrols, so finding it means passing through the exact
    monster its resistance answers.
  - **Deliberate simplification, not the full roadmap ask**: gear
    auto-equips onto a level-designated character on pickup
    (`EquipmentPickup`). There's no slot-management/inventory UI yet
    to let the player choose who wears what or swap gear later — that
    UI is still open roadmap scope, not done here.
  - 164 tests passing.
- ✅ Batch 3 — Item combat action + combat-countering consumables:
  - `Inventory.ts` gained count tracking (`add(id, name, count)` stacks
    instead of duplicating, `consume(id)` decrements-and-removes,
    `entries()` for anything that needs to list what's held) — needed
    so a consumable can be picked up more than once and actually run
    out.
  - `Consumable.ts` + `CONSUMABLE_ITEMS`: Oil Flask (Fire damage —
    a deliberate simplification of the design doc's "convert your next
    attack to Fire" into a direct throw, needing no extra engine state
    to answer "no Mage, Physical-resistant enemy"), Antidote/Bandages/
    Smelling Salts (cure Poison/Bleed/Fear), Holy Water (Holy damage).
  - `CombatEngine` gained the `"item"` action: consumes from
    `Inventory`, applies its cure or resistance-adjusted damage effect,
    logs a graceful no-op if the item or inventory is missing. Cure
    items target the user only — no ally-targeting UI yet.
  - `CombatUI` grew a second button row, rebuilt every render, listing
    only consumable ids actually held (with a live count) — unlike the
    four fixed actions, what's offered here changes turn to turn.
  - Two pickups placed in `Level.ts` (an Oil Flask in the entry
    corridor, an Antidote along the lever spur) so this is reachable in
    the actual game, not just in unit tests — reusing the existing
    generic `"keyItem"` spawn type rather than a new one, since
    `KeyItem.onEnter` already just adds whatever id/name it's given.
    Neither pickup's message names its mechanical effect, per
    [06-items-and-equipment.md](06-items-and-equipment.md#discovery-not-explanation).
  - 178 tests passing.
- ✅ Batch 4 — A real inventory UI:
  - `GameLogic.ts` gained `equipItem`/`unequipItem`: pure functions
    (no DOM) that move an item between the shared `Inventory` and a
    named character's slot, swapping whatever was already worn back
    into the inventory rather than discarding it — freely reversible,
    not a one-way commitment. Directly unit tested in the new
    `GameLogic.test.ts`.
  - `InventoryUI.ts` (new, same DOM-overlay family as `CombatUI`): a
    "Carried" list of everything held, and a per-character card showing
    all four slots. Tap an equippable item to select it, then tap a
    slot to equip it there (a mismatched slot tap is a no-op); tap a
    filled slot with nothing selected to unequip it. Never states an
    item's mechanical effect, only its name, matching the "Discovery,
    not explanation" principle already followed by `CombatUI`'s item
    row.
  - Opened via an always-visible "Inventory" button (top-left, works by
    mouse click or touch tap — unlike the touch move/turn pads, this
    needed to be reachable on both desktop and mobile without relying
    on a keyboard) or the `I` key; `Escape` or the button again closes
    it. Only available from exploration, same gate as movement — not
    mid-combat or after the run has ended.
  - `EquipmentPickup` no longer auto-equips onto a level-designated
    character (Batch 2's stopgap): it now adds the item to the shared
    inventory unequipped, same as `KeyItem`, and the player chooses who
    wears it via the new screen.
  - No test coverage of `InventoryUI.ts` itself, deliberately — it's a
    DOM-rendering class in the same untested-by-design category as
    `CombatUI` (no unit test exists for that one either), the kind of
    thing [11-testing-strategy.md](11-testing-strategy.md#3-browser-end-to-end-smoke-tests--playwright-real-headless-browser)
    earmarks for the still-deferred Playwright layer; the equip/unequip
    logic it calls into (`GameLogic.ts`) is what's actually unit tested.
  - **Follow-up fix (found via user report):** closing the inventory
    screen left movement frozen, then all of it fired at once on the
    next keypress. Cause: `InputManager` captures keydowns
    unconditionally into a FIFO queue with no idea what mode `Game` is
    in, so movement keys pressed while the menu was open (or during
    combat — the same gap, just not yet reported there) sat queued and
    all played back, one per animation frame, as soon as exploration
    resumed. Fixed with `InputManager.clear()`, called by `Game` on
    every transition into or out of "explore" mode (opening/closing the
    inventory, starting/ending combat) — the mode-aware side owns
    discarding stale input, not the dumb queue itself.
  - **Second follow-up fix (found via user report, same symptom via a
    different door):** the fix above didn't cover the screen's own
    Close button, which called `InventoryUI.hide()` directly — the DOM
    half of closing only, leaving `Game.mode` stuck on "inventory" and
    movement still dead until Escape (which *did* go through `Game`)
    bailed it out. `InventoryUI` now takes an `onClose` callback and the
    Close button calls that instead of hiding itself; `Game.closeInventory()`
    is now the one place that does the mode flip + queue clear, reached
    by the "I" key, the toggle button, and the Close button alike.
  - 184 tests passing.
- ✅ Batch 5 — Leveling (XP curve, level-up):
  - `party/Leveling.ts` (new, plain functions over a `Character` — same
    style as `GameLogic.ts`'s `equipItem`, not a `Character` method):
    `xpToNextLevel(level)` is a fresh, linear, per-level threshold (no
    level cap or difficulty curve exists yet to tune a real curve
    against); `gainXp` applies every level-up a large XP award
    triggers, each one via a fixed class-flavored growth table (stat
    bonus + HP/Mana bonus) rather than a level-up-screen point-buy —
    the doc's "stat points to allocate" is a deliberate simplification
    here, same spirit as "no skill tree in v1"; `awardPartyXp` applies
    it to every *living* member of the party and returns one
    announcement per level gained.
  - `Character` gained `xp`/`level` fields; `maxHp`/`maxMana` are no
    longer `readonly` now that leveling grows them.
  - `Monster` gained `xpReward` (defaults to 0), set per-type in
    `bestiary.ts` (Rot-thing 15, Cinder Wretch 25 — worth more since
    the resistance/weakness makes it the harder, more instructive
    fight). `Game.checkCombatEnd` awards it on victory.
  - `SecretWall` awards a flat 15 XP the *first* time it's found (per
    docs/03-party-and-characters.md#leveling's "first-time discovery of
    secrets" — re-searching an already-found wall grants nothing more),
    which needed `interact` to start taking the `InteractionContext` it
    always could (nothing used it before).
  - HUD party line and the inventory screen's character cards both
    gained a level readout (`Lv2`, etc.).
  - 194 tests passing.
- ✅ Batch 6 — A minimal party-creation/naming screen:
  - `roster.ts` refactored around a `CLASS_BASE_STATS` table (the exact
    numbers the old hardcoded four always used, per class) and a new
    `createParty(specs: PartyMemberSpec[])`, so any class can now go in
    any slot instead of one fixed character per class.
    `createStartingParty()` still exists, now just `createParty(DEFAULT_PARTY_SPEC)`
    — every existing test that calls it is unaffected. Each character
    gets its own copy of the class's stats object; a unit test in the
    new `roster.test.ts` specifically guards against two same-class
    slots silently sharing one mutable stats reference.
  - `Character` gained a `portrait` field — a plain color-swatch emoji
    (`PORTRAIT_OPTIONS`), not real character art (still
    [10-visual-style-guide.md](10-visual-style-guide.md)'s job ahead),
    just enough for a slot and later the HUD/inventory screen to be
    visually distinguishable at a glance. Both now show it next to the
    name.
  - `PartyCreationUI.ts` (new): shown once, before `Game` (and its
    WebGL context) even exists — see `main.ts`. Four slots, each
    prefilled with `DEFAULT_PARTY_SPEC`, a name field, and buttons for
    class and portrait; confirming builds the actual `Party` from
    whatever was chosen. A class's ability description is shown as a
    tooltip (the same text `CombatUI` already surfaces mid-fight) since
    a class's role is public information — unlike an item's mechanical
    effect, which [06-items-and-equipment.md](06-items-and-equipment.md#discovery-not-explanation)
    keeps hidden, this was never in scope for that principle.
  - No test coverage of `PartyCreationUI.ts` itself, same
    deliberately-untested-DOM-class category as `CombatUI`/`InventoryUI`;
    `createParty`'s actual party-building logic is what's unit tested.
  - 198 tests passing.
- ✅ Batch 7 — A non-combat puzzle gated by a class ability:
  - `ClassGate.ts` (new `Interactable`, same shape as `Door` but with
    no key or lever — opens for whoever interacts with it only if a
    living member of a given class is present). Generic over which
    class rather than Rogue-specific, so a later level can reuse it for
    a different class without a new type. Makes literal
    docs/03-party-and-characters.md's class table entry for Rogue,
    "handles lockpicking & trap disarm out of combat" — the first time
    that line has actually done anything.
  - Placed off the lever room, gating one more equipment pickup (a
    Shadow Ring, `+2 Grace`) behind it — optional and bypassable, like
    everything past the main corridor, and reachable via 2 new columns
    added to `STARTING_LEVEL`'s grid (verified for connectivity the
    same way the existing secret-wall pocket is).
  - Two new headless playthrough tests in `StartingLevel.playthrough.test.ts`
    prove it both ways with the actual level data: the default roster
    (which includes Ysolde the Rogue) opens it and reaches the ring; a
    custom Warrior/Mage/Cleric-only party is refused and stays blocked
    — the automated form of "a specific build choice materially changes
    how a puzzle plays out" from this phase's "Playable when" gate.
  - No item's mechanical effect is stated anywhere in this batch, per
    "Discovery, not explanation" — but a class's role already is public
    information (the same ability description `CombatUI` shows mid-fight
    doubles as this screen's tooltip), so crediting "Ysolde" by name in
    the open message is a fair, in-bounds hint, not a spoiler.
  - 205 tests passing.

**Phase 3 is now complete** — every scope item above has shipped and
been deployed. Phase 4 (multi-level descent & persistence) is next.

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

**Status:** Complete, shipped in batches (each pushed and deployed
independently):

- ✅ Batch 1 — Multi-level descent (stairs/level-transition entity
  linking 3 authored levels):
  - `interactables/StairsDown.ts` (new): shaped like `ExitTile` (fires
    on `onEnter`, no explicit interact needed) but carries a
    `stairsToLevelId` instead of ending the run. `Interactable` gained
    that field, `InteractableManager.handleEnter`/`GameLogic.MoveOutcome`
    both thread it through as `levelTransition`, mirroring exactly how
    `isExit`/`won` already worked — same pattern, new field, not a
    parallel code path.
  - `monster/bestiary.ts` gained `MonsterSpawn` (mirrors `EntitySpawn`)
    and `buildMonsters()`, so a level's monster placements are data
    (`MonsterTypeId` + position + patrol points), not code hardcoded
    per-level in `Game.ts` — level 1's Rot-thing/Cinder Wretch spawns
    moved into `Level.ts`'s new `STARTING_LEVEL_MONSTERS` unchanged,
    proving the generalization didn't change level 1's behavior.
  - `levels/LevelDef.ts` bundles a level's dungeon + entities + monsters;
    `levels/level2.ts` and `levels/level3.ts` are two new small, more
    linear levels (level 1 already showcased puzzle *variety* — lever,
    plate, secret wall, class gate — so these two are where the descent
    mechanic and difficulty curve are what's actually being proven,
    reusing level 1's existing monster types rather than introducing new
    ones, which is this phase's separate "monster roster expansion"
    scope item). `levels/index.ts`'s `LEVELS`/`getLevel` assemble all
    three, level 1 included, into the registry `Game` reads from.
    Level 1's old `ExitTile` became a `StairsDown` to level 2; the real,
    run-ending exit now lives on level 3 alone.
  - `Player` gained `teleportTo` — an instant, unanimated reposition
    (unlike `tryMove`/`turn`, which only take one validated step within
    a single dungeon at a time) for landing on a new level's start tile.
    `WorldClock` gained `clear()` to unregister a level's monsters at
    once rather than one at a time.
  - `Game.ts`'s constructor and its new `enterLevel`/`transitionToLevel`
    methods replace the old "build level 1 inline" logic: `enterLevel`
    tears down the previous level's dungeon/entity/monster meshes (skipped
    on the very first call, since there's nothing yet to tear down),
    builds the new level's geometry and monsters, and registers them;
    `transitionToLevel` swaps `world.dungeon`/`interactables`/`monsters`
    and calls `teleportTo` on the new level's start tile. `WorldState`'s
    `dungeon`/`interactables`/`monsters` are no longer `readonly` — they
    now change out from under a run, unlike `player`/`inventory`/`party`.
  - `MultiLevelDescent.playthrough.test.ts` (new): the phase's specific
    "headless scripted playthrough of the full multi-level descent end
    to end" ask — drives the exact same `attemptMove`/`attemptInteract`
    through all 3 levels to the real exit, swapping dungeon/interactables
    on each transition the same way `Game.transitionToLevel` does.
    Deliberately monster-free, same choice `StartingLevel.playthrough.test.ts`
    already made for level 1 — this test's job is proving the *descent*
    mechanic, not re-proving combat resolution.
  - 222 tests passing.
- ✅ Batch 2 — Save/load via `localStorage`:
  - `SaveGame.ts` (new): `serialize(world, levelId)` snapshots exactly
    what the design doc asks for — party state (stats, HP/Mana, level/
    XP, portrait, equipped item ids per slot), the shared inventory
    (id/name/count), current level id, and the party's exact grid
    position/facing. Deliberately *not* saved: per-level interactable
    state (unlocked doors, found secrets) or monster state — reloading
    re-enters the saved level fresh, the same design simplification the
    doc's save-system scope implies by only listing those three things.
    `deserializeParty`/`deserializeInventory` rebuild real `Character`/
    `Inventory` instances from that snapshot; `saveToStorage`/
    `loadFromStorage`/`hasSave` wrap `localStorage` (injectable, same
    pattern as `Hud`/`InputManager` taking a `Document`/`Window`, so
    tests never touch a real browser storage).
  - `Game`'s constructor gained an optional `saveData` parameter that
    wins over `partySpecs` entirely: restores the saved party/inventory,
    loads the saved level instead of level 1, and calls `teleportTo`
    with the saved position/facing after the level's own start tile is
    set up.
  - A "Save" button now lives in the inventory screen's header, next to
    Close — already the one place exploration fully stops, so no
    separate always-visible corner button was needed for it.
  - `PartyCreationUI` gained an optional `onContinue` callback: when
    `main.ts` finds a save via `hasSave()`, a "Continue" button appears
    above the usual creation flow and bypasses it entirely, loading
    `Game` with the saved data instead of a fresh party.
  - `SaveGame.test.ts` is the phase's specific "save/load round-trip"
    ask: serializes a party with custom stats/level/XP/equipped gear
    and a stocked inventory, round-trips it through a real
    `JSON.stringify`/`parse` (via an in-memory fake `Storage`, this
    project's Vitest environment is plain Node), and asserts the
    reloaded data is `toEqual` the original — plus corrupted-JSON and
    empty-storage cases returning `undefined` rather than throwing.
  - 232 tests passing.
- ✅ Batch 3 — Monster roster expansion:
  - `Monster` generalized to support both new lessons without a
    per-type branch inside the class itself: `MonsterOptions` gained
    `flavor` (overridable combat-log text — a spellcaster shouldn't
    "claw"), `heavyStatusEffect` (applied when the telegraphed strike
    lands), and `healsOnHeavyTurn` (the telegraphed turn heals the
    monster instead of attacking). `CombatEngine.runMonsterTurn` now
    applies a landed heavy strike's status effect and skips damage
    resolution entirely for a zero-damage (self-heal) turn.
  - Screeching Wraith: `heavyStatusEffect` is Fear (2 turns), teaching
    the Resolve stat and the Cleric's Cleanse — the first real in-game
    source for a mechanic that's been fully wired since Phase 3 but had
    nothing to trigger it. `ScreechingWraithEncounter.playthrough.test.ts`
    proves Fear actually forces a Defend on the feared character's next
    turn through a real `CombatEngine` fight, not just the `Monster`
    method in isolation.
  - Court Alchemist: `healsOnHeavyTurn` heals itself instead of
    attacking on its telegraphed turn — the single-monster analogue to
    "kill the healer first" (`CombatEngine` doesn't support more than
    one monster in an encounter yet; see the doc comment on
    `healsOnHeavyTurn` for why that's a deliberate scope line, not an
    oversight). `CourtAlchemistEncounter.playthrough.test.ts` proves
    both halves of the lesson with the same monster and the same
    attacker, differing only in damage per hit: a weak attacker
    actually sees a heal land mid-fight, a strong one bursts it down
    before its heal-turn ever comes around.
  - Both are now placed in the actual descent, not just tests: the
    Screeching Wraith replaces level 2's Rot-thing (already taught in
    level 1, no need to repeat it), and the Court Alchemist joins level
    3 alongside the Cinder Wretch, replacing its own Rot-thing repeat.
  - 241 tests passing.
- ✅ Batch 4 — Bestiary/codex UI:
  - `Monster` gained public `heavyStatusEffect`/`healsOnHeavyTurn`
    getters (previously private) and `monster/BestiaryEntry.ts`'s
    `describeMonster()` reads them straight off an encountered
    instance — no separate, hand-maintained data table duplicating
    what the monster factories already encode; a Cinder Wretch's entry
    is generated from the same `resistances` object its factory built,
    for instance, not a second copy of "physical 0.5, fire 2" that
    could drift out of sync.
  - `Game` records a monster's name into `encounteredMonsters` the
    moment `startCombat` runs, per docs/05-combat.md#the-bestiary's
    "win, lose, or flee" all counting as an encounter — not persisted
    across save/load, the same simplification `SaveGame.ts` already
    makes for per-level interactable/monster state.
  - `BestiaryUI.ts` (new, same DOM-overlay family as `CombatUI`/
    `InventoryUI`): a list + detail view — each encountered type's
    card shows its non-neutral resistances, any status effect its
    heavy strike inflicts, and whether it heals instead of attacking.
    Opened via a "Bestiary" button added to the inventory screen's
    header (alongside Save/Close) rather than a fourth always-visible
    corner button, replacing that screen rather than layering on top
    of it.
  - `BestiaryEntry.test.ts` covers `describeMonster` for all four
    current types, including that a Rot-thing's entry is genuinely
    empty (no resistances, no status, no self-heal) and a Cinder
    Wretch's lists *only* its two non-neutral resistances, not four
    entries with two neutral 1× multipliers padded in.
  - 245 tests passing.
- ✅ Batch 5 — A real difficulty curve across the 3 levels, tuned by
  hand:
  - Found and fixed a real gap while reviewing what each level actually
    offers: `old-buckler` and `hardened-leather` had existed in
    `Equipment.ts` since Phase 3 but were never placed in *any* level's
    entity list — completely unreachable in the real game. Placed
    `old-buckler` (Grace, helping against the Wraith's Fear via more
    initiative) right at level 2's entrance, unmissable ahead of that
    level's one fight; placed `hardened-leather` (Physical resistance)
    in a new third alcove added to level 3's corridor, positioned
    between its two back-to-back fights as a breather resource exactly
    where the run needs it most. Without this, levels 2 and 3 escalated
    in monster difficulty while offering the player zero new power to
    answer it — a curve that only went up on one side.
  - The fight structure itself already escalated correctly from the
    Batch 1/3 level designs, so no changes were needed there: level 1's
    one mandatory fight (plus an optional harder one) teaches the
    baseline; level 2's one fight adds a status-effect mechanic; level
    3's two mandatory fights land back-to-back with no recovery between
    them, the most demanding arrangement in the descent.
  - `DifficultyCurve.test.ts` (new): a data-driven regression guard
    pinning the XP-pacing claim itself, computed from `LEVELS`' actual
    monster data rather than asserted in prose — a full clear (every
    monster, plus level 1's one secret) reaches at least level 4 by the
    run's end; skipping every optional fight and secret still reaches
    level 3. Either number drifting on a future tuning pass would fail
    this test, not just go unnoticed.
  - 247 tests passing.
  - **Follow-up fix (found via user report: "I can no longer move
    forward/back, only turn"):** `Game`'s constructor built the first
    level's geometry via `enterLevel` but never actually called
    `teleportTo` on a fresh game (only `transitionToLevel`, used for
    *later* level changes, did that) — the player was left standing on
    the untouched `(0, 0)` placeholder, a wall tile in every level.
    Every forward/backward/strafe attempt was correctly refused as
    blocked; turning has no wall check, so it alone kept working,
    which is what made the symptom read as "movement is broken" rather
    than an obvious crash. Fixed by pulling the "which tile, which
    facing" decision out into `GameLogic.ts`'s `resolveStartPosition` —
    zero rendering dependency, so unlike `Game` itself it's directly
    unit-testable — and calling it (plus `teleportTo`) unconditionally
    right after `enterLevel`, both in the constructor and in
    `transitionToLevel`, replacing what had been two separate,
    diverging copies of this logic with one. A new regression test
    asserts `resolveStartPosition` never resolves to a wall tile for
    any level in `LEVELS`, pinning the exact invariant that broke.
    250 tests passing.

**Phase 4 is now complete** — every scope item above has shipped and
been deployed. Phase 5 (content & narrative pass) is next.

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

**Status:** Complete, shipped in batches (each pushed and deployed
independently):

- ✅ Batch 1 — Story integration + boss fight:
  - The existing 3-level descent is now explicitly Act 1, "The Sunken
    Wards," per [02-setting-and-story.md](02-setting-and-story.md#structure)
    — `LevelDef` gained `name` (shown in a small HUD line) and
    `introMessage` (shown the moment the party arrives, via the initial
    load and every `StairsDown`), giving every level a place-name and
    an environmental-storytelling beat without a separate dialogue/text
    system.
  - `interactables/NpcEncounter.ts` (new): a "sparse NPC encounter"
    (docs/02-setting-and-story.md#how-story-is-delivered) — mechanically
    almost identical to `LoreItem` (interact -> a fixed, re-readable
    line) but its own `kind`, so a figure reads distinctly from an inert
    page and could later gain conditional hostility without conflating
    the two. Two placed: a steward in level 1's main corridor, a sentry
    in level 3's, the latter naming the boss ahead by name.
  - `monster/bestiary.ts` gained `createStewardMarrow`: Act 1's boss,
    assembled entirely from mechanics already taught rather than a new
    gimmick, per
    [05-combat.md](05-combat.md#a-teaching-ladder-illustrative-not-final-content) —
    the Rot-thing's telegraphed heavy strike, the Screeching Wraith's
    Fear on that strike, and a Cinder-Wretch-shaped resistance profile
    (resistant to Physical, but weak to Holy rather than Fire, so the
    answer isn't just the same trick again — Holy Water is currently
    the only in-game Holy source, there's no Holy spell yet). Higher
    HP/Might than anything before it.
    `StewardMarrowEncounter.playthrough.test.ts` proves all three
    mechanics through a real `CombatEngine` fight, matching the
    per-encounter coverage every earlier monster type got.
  - `levels/level4.ts` (new): Act 1's boss arena — deliberately a real
    open room rather than another one-tile corridor, since the "no full
    cutscenes... a boss standing where you expected an empty hall" beat
    (docs/02-setting-and-story.md) needs somewhere to actually see
    before the fight starts. Its `introMessage` delivers that reveal and
    the boss's entrance in the same line, per that doc's "environmental
    storytelling first" — not a separate reveal system. Level 3's old
    run-ending `ExitTile` became a `StairsDown` to level 4; the real
    exit now lives there alone.
  - `MultiLevelDescent.playthrough.test.ts` and `DifficultyCurve.test.ts`
    extended to the new level 4 and its boss — the full-descent
    playthrough now ends by crossing the boss arena to the real exit,
    and the XP-pacing regression guard now expects a full clear (Steward
    Marrow's 50 XP included) to reach at least level 4, and a
    mandatory-only run (the boss counted as mandatory — technically
    walkable-around in that open room, but not content a real
    playthrough skips) to reach level 4 as well.
  - 258 tests passing.
- ✅ Batch 2 — Minimap:
  - `Minimap.ts` (new, pure data): `buildMinimapGrid(dungeon, visitedFloors)`
    reads straight from the same `DungeonMap` the 3D geometry does — not
    a separately authored asset, per the roadmap doc's own framing. Fog
    of war: a tile is revealed once actually stood on, or once it's a
    wall adjacent to a visited floor (so corridor walls show up around
    a walked path without exposing what's past them) — a deliberate fit
    for pillar 3's "the dungeon is the character," the map earns itself
    rather than being handed over. `Minimap.test.ts` is the phase's
    specific "unit test on the minimap's data mapping" ask: an unvisited
    grid is all-unknown, a visited floor tile and its adjacent walls
    resolve correctly, tiles two steps away don't, and every *revealed*
    cell matches the source `DungeonMap` exactly once fully explored
    (an isolated wall corner with no orthogonal floor neighbor
    legitimately never reveals — that's a real invariant of the fog-of-
    war rule, not a bug the test papers over).
  - `MinimapUI.ts` (new, same DOM-overlay family as the rest of the UI
    layer per docs/07-technical-architecture.md#ui-layer): a small
    `<canvas>`, always mounted top-left, `image-rendering: pixelated`
    for crisp blocky cells at CSS-scaled size — the same nearest-
    neighbor look the eventual texture pass wants, already true here
    for free. No toggle: small enough in a corner that hiding it was
    never actually necessary, and every other screen corner was already
    spoken for by existing touch/HUD elements.
  - `Game.ts` tracks `visitedTiles` per level (reset on every
    `transitionToLevel`, never persisted across save/load — the same
    simplification `SaveGame.ts` already makes for per-level
    interactable/monster state), marking a tile visited whenever a move
    actually enters it and re-rendering the minimap after every
    move/turn/level-load.
  - **Follow-up fix (found via user report):** the original version
    only revealed tiles actually stood on, plus their adjacent walls —
    "I can see there's a wall two tiles ahead, but the corridor beyond a
    junction I'm looking straight down stays blank until I walk there,"
    which read as a bug more than a design choice. Reworked around a
    real line-of-sight sweep: every visited tile now casts a ray in all
    four cardinal directions, revealing whatever it can actually see —
    "tiles in front of you you've seen, not just ones you've walked
    on" — stopping at exactly the same things that block movement (a
    wall, a closed door, an unrevealed secret wall, an unopened class
    gate, a pushable block). Doors gained their own `MinimapCell` type
    (`"door"`, a distinct color in `MinimapUI.ts`) instead of reading as
    plain floor, per the same report — seen once, a door's location
    stays legible on the map whether it's later open or closed, but a
    *closed* one still stops the sightline from reaching past it. A
    revealed secret wall correctly stops blocking sight and switches
    from "wall" to "floor" once opened, matching what `DungeonMesh.ts`
    already does visually in the 3D view. `Game.ts` now also refreshes
    the minimap after every interact, not just move/turn, since
    unlocking a door (directly, or via a lever/plate elsewhere) changes
    what's visible without necessarily moving the party at all.
  - **Second follow-up fix (found via user report):** each sightline ray
    still only revealed the tiles directly along it, not the corridor
    walls actually visible on screen flanking them — looking straight
    down a hallway only showed its far end, not its sides the whole way
    there. `castSight` now also reveals the two tiles perpendicular to
    travel at every step along the ray (the left/right corridor walls a
    first-person view of that hallway would actually show), not just
    the tile dead ahead — without extending the ray through them, so a
    side passage's entrance shows up without seeing further into it
    until that passage gets its own sightline.
  - **Third follow-up fix (found via user report):** combat locks every
    input for the whole fight, turning included (`tick()`'s `mode`
    gate) — but a monster can become adjacent from any side, not just
    whichever way the party happened to be facing, so a fight could
    start with the party staring at a wall while the combat log
    described a monster they couldn't see. `Game.startCombat` now
    snaps the party to face the monster the instant combat starts, via
    a new `GameLogic.facingToward(fromX, fromZ, toX, toZ)` — pulled out
    into its own pure function, same reasoning as `resolveStartPosition`
    after the earlier movement bug: `Game` itself has no test coverage
    (it's the DOM/render shell), so the actual *decision* — which way
    to face — needed to live somewhere testable, not buried in the
    untestable glue that calls `player.teleportTo`.
  - **Fourth follow-up fix (found via user report):** a pushable block
    or an unopened class gate sits on an ordinary floor tile in the raw
    grid — only the entity on top of it, not the tile itself, currently
    blocks movement — but `cellType` only special-cased *walls* that
    turn out passable (a revealed secret wall) and *doors*; anything
    else blocking a floor tile just fell through to plain "floor." A
    player walking south from level 1's start room hit exactly this:
    the map showed an open hallway right up to the unpushed block, with
    no visual reason for the dead end that stopped them there. `Minimap`
    gained a fourth `MinimapCell`, `"obstacle"` (its own color in
    `MinimapUI.ts`), for any non-door entity currently blocking a floor
    tile; it reverts to "floor" the moment that entity stops blocking
    (block pushed elsewhere, gate opened), same as a door already does.
  - 303 tests passing.
- ✅ Batch 3 — Procedural pixel art textures + the low-res rendering
  pipeline:
  - `Textures.ts` (new): `buildActOneMaterials(dungeon)` procedurally
    draws 32×32 wall/floor/ceiling textures on an offscreen `<canvas>`
    (this project has no art-authoring pipeline or image-generation
    tool, so code-drawn stands in for hand-painted) — a base color with
    seeded, deterministic per-"chunky pixel" brightness jitter, mortar
    lines, and occasional moss-colored flecks for Act 1's "damp stone"
    palette, per [10-visual-style-guide.md](10-visual-style-guide.md#palette).
    Deliberately leans into that doc's "bold silhouettes and flat color
    blocks over fine texture noise" pillar rather than fighting it with
    a smooth gradient. Every texture gets `NearestFilter` on both
    filters and `generateMipmaps = false`, per that doc's texture-
    filtering section, with no exceptions. Floor/ceiling get
    `RepeatWrapping` sized to the level's own grid dimensions, matching
    `DungeonMesh.ts`'s existing single plane per level exactly.
  - `DungeonMesh.ts`'s `buildDungeonMesh` gained an optional `materials`
    parameter (real ones from `Textures.ts` in actual play) that falls
    back to the original flat-color `MeshStandardMaterial` placeholders
    when omitted — keeping `DungeonMesh.test.ts` (headless, no
    `document`/canvas available) passing completely unchanged, since
    that suite only needs to prove the geometry logic, not exercise
    real textures. `Textures.ts` itself has no unit tests, the same
    deliberately-untested-DOM/canvas-dependent category as `Game.ts`
    and every DOM-overlay UI class, per
    [11-testing-strategy.md](11-testing-strategy.md#non-goals).
  - Dungeon materials switched from `MeshStandardMaterial` to
    `MeshLambertMaterial` (diffuse-only, no PBR specular/roughness
    response — both the correct look for flat pixel art and cheaper to
    shade on mobile, per that doc's "Materials" section). Monster/NPC/
    interactable placeholder shapes keep their existing
    `MeshStandardMaterial` for now — converting them to billboarded
    sprites per the asset-specs table is real additional scope, not
    done in this batch.
  - `Game.ts`'s renderer now targets the actual "pixel art, whole-frame"
    technique: renders to a small fixed internal resolution (~180px on
    the shorter screen dimension, aspect-derived on the other —
    deliberately not always fixing height, since a portrait phone would
    otherwise derive an illegibly thin width) via
    `renderer.setSize(w, h, false)`, with `antialias: false` and
    `pixelRatio` pinned to 1 regardless of device pixel density; CSS
    (`image-rendering: pixelated` on the canvas) does the upscale to
    fill the actual screen. A level transition's teardown now also
    disposes the previous level's geometry/material/texture resources
    (`disposeObject3D`), since a texture per level visited is a more
    expensive thing to quietly leak than the old flat colors were.
  - **A note on risk, not just a changelog entry**: this project has a
    real history with lighting/material changes that read fine in code
    but wrong on screen (see this doc's Phase 1 status entry on the
    near-black lighting bug) — none of this batch's rendering output
    can be verified from here, only reasoned about. Flagged for a
    real-browser check once deployed, same as every visual change
    before it that couldn't be unit tested.
  - 263 tests passing (unchanged in count — this batch is genuinely
    render-only, no new logic to test beyond what already existed).
- ✅ Batch 4 — Procedural audio:
  - `AudioManager.ts` (new): footsteps, combat SFX (an encounter
    stinger, a generic hit sound on any resolved combat action, and
    distinct victory/defeat/flee stings), and a two-oscillator ambient
    drone, all synthesized live via the Web Audio API (oscillators +
    a generated noise buffer) — no external sound files, same "no
    asset-authoring tool available" situation as `Textures.ts`. Same
    deliberately-untested category as that module and `Game.ts` itself,
    per [11-testing-strategy.md](11-testing-strategy.md#non-goals) —
    `AudioContext` doesn't exist in this project's Vitest environment,
    and "does this sound right" is a human judgment call regardless.
  - Browsers refuse actual sound from an `AudioContext` until a real
    user gesture occurs; `ensureContext` (called by every sound method)
    retries the resume every time it's called, so the very first
    footstep — itself triggered by the player's first move — is what
    wakes audio up, with no separate "click to enable sound" step.
  - A "🔊"/"🔇" mute button joins the always-visible "Inventory" button
    top-left (same reasoning: has to be reachable without a keyboard,
    and every other screen corner is already spoken for).
  - 263 tests passing (unchanged — audio, like the texture batch before
    it, is genuinely render/sound-only, no new testable logic).
- ✅ Batch 5 (stretch) — fully-unidentified items and cursed gear, the
  level-2 discovery tier from
  [06-items-and-equipment.md](06-items-and-equipment.md#discovery-not-explanation):
  - `Inventory.ts` gained a fixed `UNIDENTIFIED_NAMES` mapping for the 5
    existing consumables (an Oil Flask shows as "a bubbling amber vial"
    until identified, etc.) — a **deliberate scope reduction** from the
    design doc's "random flavor names per playthrough": true per-run
    randomization needs a seeded shuffle threaded through `SaveGame.ts`
    too, a further stretch beyond this one, not built here. Identified
    "by use" (the simplest of the doc's three routes) — `CombatEngine.resolveItem`
    calls the new `Inventory.identify()` the moment an item actually
    resolves in combat, after which every remaining unit of that id
    shows its true name everywhere (HUD, inventory screen, combat item
    buttons) without further wiring, since they all already just read
    `entries()`.
  - **Found and fixed a real bug while wiring this in**: `SaveGame.serialize`
    was calling `Inventory.entries()` (the *display* names) instead of
    the true stored ones — saving and reloading an unidentified item
    would have permanently baked its mystery name in as if it were real,
    surviving even a later identification. Fixed with a new
    `Inventory.rawEntries()` (always true names) and `identifiedIds()`,
    both threaded through `SaveData`, so identification state itself now
    round-trips correctly too. Caught by `SaveGame.test.ts` failing the
    moment `oil-flask` (a real unidentified id) replaced a placeholder
    id in an existing round-trip test — exactly the kind of thing that
    test exists to catch.
  - `EquipmentItem` gained a `cursed` flag; a new `ambition-ring` (+3
    Might, cursed) sits in level 4's boss arena — a tempting reward with
    a real cost, never announced ahead of time. `GameLogic.unequipItem`
    refuses to remove cursed gear, and `equipItem` refuses to swap
    something else into a slot a cursed item already occupies (the
    latter needed its own guard — `Character.equip` would otherwise
    happily hand the "stuck" item back to the inventory as part of a
    normal swap, defeating the curse entirely).
  - 271 tests passing.

**Phase 5 is now complete** — every scope item above, including the
stretch batch, has shipped and been deployed.

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

**Status:** In progress, shipped in batches (each pushed and deployed
independently):

- ✅ Batch 1 — v1 scope decision + narrative ending:
  - The exact-level-count call this phase's own scope explicitly deferred
    is now made: **v1 ships only Act 1** ("The Sunken Wards," 4 levels).
    Acts 2–4 stay canon for a possible future expansion but are not
    built. [02-setting-and-story.md](02-setting-and-story.md#structure)
    updated to say so directly, replacing its old "deferred to the
    roadmap" placeholder paragraph.
  - The win screen (`Hud.showWinScreen`) changed from a single static
    "YOU ESCAPED" string to a real title + multi-paragraph epilogue
    (`Hud.ts`'s `WIN_EPILOGUE`), so the ending reads as a genuine,
    self-contained conclusion rather than a mid-campaign checkpoint —
    Steward Marrow's defeat resolves, but the crown and the Long Court
    stay deliberately unresolved, per the setting's own "horror is
    absence" tone rather than an obvious sequel hook.
- ✅ Batch 2 — Full-campaign smoke test + balance sanity checks:
  - `FullCampaign.playthrough.test.ts` (new): the release smoke test
    this phase's own scope calls for — unlike the earlier
    `MultiLevelDescent.playthrough.test.ts` (deliberately monster-free),
    this one drives the entire level 1→4 descent with real monsters and
    real `CombatEngine` resolution, reactively resolving every triggered
    fight (leading with a class ability against a known elemental
    weakness, else a plain attack) and asserting victory, an undefeated
    party, and a real win at the end.
  - Writing that test's fight-resolution logic surfaced a real content
    bug: Holy Water — the explicitly-intended counter to Steward
    Marrow's Holy weakness per his own design doc comment — was never
    actually placed as a pickup anywhere. Fixed by adding it to
    `levels/level3.ts`, positioned on the main corridor between that
    level's two mandatory fights, the same "breather resource exactly
    where it's needed" placement already used for that level's armor
    pickups.
  - `BalanceSanity.test.ts` (new): the balance sanity checks this
    phase's scope calls for — the XP curve stays strictly increasing and
    always positive; `applyResistance` never produces negative/NaN/
    non-finite damage across a matrix of damage types, multipliers, and
    raw damage values; every real monster's resistance map (built from
    actual level spawn data, not a hand-copied list) uses only valid
    damage-type keys with positive finite multipliers; every equipment
    spawn across all levels resolves to a real item; every lever/plate's
    target door falls within its own level's map bounds.
- ✅ Batch 3 — Options menu (volume + key rebinding):
  - `InputManager` rewritten from a fixed module-level key map to an
    instance-level, rebindable one: `rebind(action, key)` (clears every
    key currently mapped to that action first, including both keys of a
    default pair, so a rebound action always resolves to exactly the
    chosen key) and `keyFor(action)` for the options screen to display.
  - `AudioManager` gained an independent `volume` (0-1, multiplicative
    with `muted`) with `setVolume`/`volumePercent`.
  - `Settings.ts` (new): a small `localStorage`-backed store for
    volume/mute/key-bindings, deliberately separate from `SaveGame.ts`
    — these are device preferences that persist across "New Game," not
    part of a save.
  - `OptionsUI.ts` (new): a DOM overlay in the same family as
    `InventoryUI`/`BestiaryUI` — a volume slider, a mute checkbox, and
    dropdown-based (not live "press any key" capture) rebinding for
    every action, chosen specifically to avoid any global
    keydown-interception ordering games with the rest of the input
    pipeline. Reachable via a new "Options" button on the inventory
    screen's header, alongside Save/Bestiary/Close — continuing that
    screen's role as the de facto pause menu.
  - `Game.ts` loads `Settings` on construction, before `InputManager`/
    `AudioManager` exist, so a returning player's rebinds and volume
    apply from the first frame; every options-screen change applies to
    the live systems immediately and re-persists the whole settings
    blob.
  - 299 tests passing.
- ✅ Batch 4 — Level 1's block puzzle actually pays off (found via user
  report): after the minimap's "obstacle" fix (Phase 5 batch 2's fourth
  follow-up) made the pushable block visible as a real obstacle, the
  next question was the obvious one — solving it only unlocked a door
  the lever already opens for free, so it gave nothing back for the
  trouble. The block itself now sits on the *only* tile leading to a
  one-tile pocket at `(1, 4)`, carrying a new equipment reward (a
  Focus-boosting talisman) — pushing the block onto the plate still
  arms the shared bonus door as before, but standing where the block
  used to be also opens up ground that was physically unreachable until
  then, not just a second route to existing content.
  `DungeonMap.ts`/`Level.ts` doc comments updated to match, and
  `StartingLevel.playthrough.test.ts`'s block/plate test now asserts
  the pocket is unreachable before the push and holds the talisman
  after.
  - 303 tests passing.
- ✅ Batch 5 — Level 2-4 audit for the same bug class: with the level 1
  block puzzle fixed, the natural next question was whether the same
  "content placed, nothing can reach it" mistake existed anywhere else.
  Levels 2-4 turned out to use none of level 1's gating mechanisms
  (lever, plate, block, secret wall, class gate) at all — by design,
  per their own doc comments, they're deliberately simpler levels
  testing the descent mechanic and difficulty curve rather than puzzle
  variety — so there was nothing equivalent to find by hand. Instead of
  leaving it at a one-time manual check, `BalanceSanity.test.ts` gained
  three permanent, general checks covering all four levels at once:
  - Every floor tile and every entity spawn is reachable from the
    level's own start tile (a raw wall/floor BFS, generalized from
    `DungeonMap.test.ts`'s existing level 1-only version) — the general
    form of the exact bug a player found by hand in batch 4. Secret
    walls are the one deliberate exception, accounted for the same way
    that existing test already does.
  - Every lever/plate spawn's target actually resolves to a real door
    (`InteractableManager.fromSpawns` doesn't throw) — the existing
    bounds check only proved a doorX/doorZ was in range, not that a
    door was actually spawned there.
  - Every locked door's `keyId` has a matching `keyItem` spawn
    somewhere in the same level — an orphaned key requirement would be
    a mandatory-path dead end, not just a missed optional pickup.
  - All four levels pass every one of these on the first run; the value
    is in catching a regression the next time someone edits a level's
    entity list by hand.
  - 306 tests passing.
- ✅ Batch 6 — Performance pass + packaging:
  - **Performance:** reviewed the actual render/update loop before
    changing anything — combat and monster AI run on `WorldClock`,
    which only advances once per player action (a step, turn, or
    combat action), never per rendered frame, and `Player.update()`
    returns immediately the instant it isn't mid-animation, so a
    typical frame does almost no work beyond one low-resolution
    `WebGLRenderer.render()` call. Nothing there needed fixing. The
    real cost was in what blocked the *first* paint: `main.ts` used a
    top-level `import` of `Game.ts` (Three.js and everything under it,
    ~570 KB), so every player waited on the whole game bundle before
    the party-creation screen — which has zero Three.js in its own
    import graph — could even appear. `Game.ts` is now a dynamic
    `import()`, kicked off immediately in the background rather than
    inside the "Start"/"Continue" callback, so `import()`'s built-in
    request de-duplication means the callback's `await` almost always
    resolves against an already-finished fetch. Confirmed via the
    actual build output: the entry chunk dropped from 147 KB gzipped to
    4 KB, with the ~144 KB Three.js/`Game` chunk now loading in
    parallel while a player is still naming characters, not blocking
    that screen at all. `vite.config.ts`'s `chunkSizeWarningLimit`
    raised to fit that chunk deliberately, rather than suppressing the
    warning outright.
  - **Packaging:** the GitHub Pages static deploy already satisfies
    this phase's "static web build at minimum" requirement and stays
    the primary release. Added `npm run package:web` as the optional
    itch.io channel the scope item names: builds, then zips `dist/`
    with `index.html` at the zip's own root (not nested under `dist/`),
    matching itch.io's HTML5 upload format exactly — verified by
    actually unzipping the output and confirming that layout, and by
    serving the built `dist/` through `vite preview` and confirming
    every asset the page references resolves via its relative path (no
    root-absolute URLs, which would 404 under itch.io's subpath
    hosting). `hollow-crown-web.zip` is git-ignored, generated on
    demand rather than committed.
  - 306 tests passing (unchanged — this batch touched build tooling
    and one bootstrap file, not game logic).
- ✅ Batch 7 — Initiative order tracker (player request: "let me plan
  ahead"): `CombatEngine` already tracked a real `turnQueue` internally
  (rolled once per round, party members plus the monster, by
  `initiativeStat + 1d6`) but never exposed where the party currently
  stood in it beyond the single `currentActor`. Added a
  `currentTurnIndex` getter alongside the existing `turnQueue` one, so
  a UI can show the whole round at a glance rather than only "whose
  turn is it right now."
  - `CombatUI` gained a row of small pills above the monster's HP line,
    one per `turnQueue` entry in order: dimmed for whoever already
    acted this round, highlighted for the current turn, plain for
    what's still to come, and struck through for anyone who's gone down
    — read live off the combatant each render, not a snapshot, so a
    mid-round knockout updates immediately rather than lagging behind.
    Seeing the monster's slot coming up is what actually answers "plan
    ahead": a party can now choose to Defend a turn early instead of
    finding out reactively that the monster went first.
  - `CombatEngine.test.ts` covers the new getters directly: `turnQueue[currentTurnIndex]`
    always equals `currentActor`, the queue always matches exactly the
    party's living members plus the monster, and the index resets to 0
    on every fresh round.
  - 309 tests passing.

---

## Phase 7 — Post-v1 Enhancements

Phase 6 shipped v1 as a complete, self-contained release. This phase is
where player-requested improvements land afterward — each entry below
is its own self-contained addition, not a coordinated scope like
Phases 0-6 were, so there's no single "playable when" gate for the
phase as a whole; each batch's own scope note says what it needed to be
true before shipping.

**Status:**

- ✅ Batch 1 — Stats and skills to allocate on level-up (player
  request: "character should have stats and skills and get skill
  points that have to be assigned on level up"): the original design
  doc ([03-party-and-characters.md](03-party-and-characters.md#leveling))
  always asked for "a flat HP/Mana increase plus stat points to
  allocate," but `Leveling.ts` shipped a simplification instead — every
  stat grew automatically on a fixed per-class table, flagged in its own
  doc comment as "revisit once a level-up screen is worth building."
  That screen now exists, and the scope grew further on request to
  cover skills too, not just stats:
  - `Character` gains `skillPoints` (spent, never auto-applied) and a
    `knownSkillIds` set, seeded with the class's original signature
    skill from construction — every class's first skill has always
    been unconditionally available since Phase 3, so nothing about
    existing behavior changes for a character who never opens the new
    screen. `spendPointOnStat`/`unlockSkill` are the only ways either
    field changes; a point on Vitality or Focus also nudges max
    HP/Mana (topping up current HP/Mana by the same amount) since
    those two stats' whole documented job is driving those maximums —
    otherwise the level-up screen would offer a choice that's secretly
    a trap for two of five options.
  - `party/Skills.ts` (replaces `party/classes.ts`): two skills per
    class now, not one — each class's original ability unchanged
    (`unlockCost: 0`, known from level 1) plus a new skill bought with
    skill points (`unlockCost: 8`, `SKILL_POINTS_PER_LEVEL = 3` granted
    per level). Each new skill answers something the class's kit
    genuinely lacked, the same "every ability answers something
    specific" principle the original four already followed: Warrior's
    **Second Wind** (self-heal, answering attrition Guard alone can't);
    Rogue's **Smoke Bomb** (a guaranteed escape, unlike ordinary Flee's
    resolve-scaled coin flip); Mage's **Frost Lance** (modest damage
    plus a guaranteed Stun — the first actual source for a status
    effect the engine has fully implemented since Phase 4 but nothing
    had ever inflicted); Cleric's **Smite** (Holy damage — Cleric's
    first offense of any kind, and a second, repeatable source of the
    exact damage type Steward Marrow is weak to, alongside the
    single-use Holy Water pickup).
  - `CombatEngine.resolveAbility` now dispatches by skill id (falling
    back to a class's default skill when the caller omits one, so
    every existing `submitAction("ability")` call across the whole test
    suite kept working unmodified) rather than a hardcoded switch on
    `classId` — enforced against `actor.knownSkillIds` so a stale id
    can never run a skill that isn't actually unlocked.
  - `CombatUI`'s single "Ability" button became a row of one-or-two
    skill buttons (same pattern `renderItems` already used for
    consumables), since a character can now know more than one.
  - `LevelUpUI.ts` (new): reachable from the inventory screen's header
    (now five buttons: Save/Bestiary/**Level Up**/Options/Close, the
    last showing an unspent-point count once there is one) — one card
    per party member, a `+1` button per stat, and an `Unlock` button
    for the class's second skill once enough points are saved.
  - `SaveGame.ts` round-trips `skillPoints`/`knownSkillIds`; a save
    written before this batch existed just falls back to the class's
    always-known default, per the same "absent, not empty" convention
    `identifiedItemIds` already established.
  - 335 tests passing.
- ✅ Batch 2 — Menu screens are siblings, not nested (player report:
  "it's weird that all these screens like options and levelup require
  going through the inventory screen first"): Options/Bestiary/Level Up
  only ever had a lone Close button, so reaching one from another meant
  closing all the way back to exploration and re-opening Inventory
  first, even though Inventory's own header already had direct buttons
  to all three.
  - `MenuNav.ts` (new): a shared `buildMenuNav` builder used by all
    four screens now (`InventoryUI`/`BestiaryUI`/`OptionsUI`/
    `LevelUpUI`), replacing each one's own ad hoc header. Every screen
    shows the same row — Save, then every other screen, then Close
    (this screen's own destination left out) — so any one of the four
    is one tap from any other. The one deliberate exception to this
    project's usual per-screen-id CSS convention: the row and its
    buttons are shared classes (`.menu-nav-actions`/`.menu-nav-btn`),
    not duplicated per-screen ids, since the alternative was copying
    the same block four times over.
  - `Game.ts` gained `hideAllMenus`/`closeCurrentMenu`: every `open*`
    method now hides whichever of the four was showing (not just
    Inventory specifically) before showing its own screen, and the
    shared Close button/Escape both close whichever one is actually
    open by reading `this.mode` at the moment they're pressed, rather
    than each screen assuming it was reached from Inventory. The
    always-visible HUD button/`I` key still only opens Inventory
    directly from exploration, unchanged — this only flattens
    navigation *between* the four menu screens once already in one.
  - 335 tests passing (unchanged — this batch is DOM wiring in the
    untested UI layer, per docs/11-testing-strategy.md's non-goals;
    `MenuNav.ts` itself has no logic beyond building DOM nodes).
- ✅ Batch 3 — Options/Bestiary/Level Up reachable straight from
  exploration (player follow-up: batch 2's cross-navigation still
  meant opening Inventory was the *only* door in from actual gameplay
  — "There's still no way to enter options or level up unless I go
  through inventory first" was still true, just one tap shorter than
  before). The real fix batch 2 was missing: three more always-visible
  HUD buttons (`#quick-menu` in index.html — Bestiary/Level Up/Options,
  top-center, deliberately away from the already-crowded top-left
  corner Inventory/Mute/Minimap share and the top-right party status),
  each wired the same way Inventory's own toggle button always has
  been. `Game.ts`'s `toggleInventory` became a thin wrapper around a
  new shared `toggleMenu(targetMode, open)` — closes back to
  exploration if that screen's already open, opens it fresh from
  exploring (refusing mid-combat/after the run ends, same guard
  Inventory's toggle always had), reused for all four now. `Hud.ts`
  gained `onBestiaryToggle`/`onLevelUpToggle`/`onOptionsToggle`,
  mirroring `onInventoryToggle`/`onMuteToggle` exactly.
  - 335 tests passing (unchanged — same untested-UI-layer reasoning as
    batch 2).
- ✅ Batch 4 — Attack animations (player request: "there should be
  attack animations"): the monster capsule mesh sat dead still through
  an entire fight, win or lose, with only the combat log and HP numbers
  saying anything happened.
  - `MonsterAnimator.ts` (new): pure animation math for two beats —
    "attack" (a short lunge toward the party, world-space, along
    whatever direction the monster actually is from them) and "hit" (a
    quick scale punch plus an emissive flash). No Three.js scene access
    of its own; `Game.ts` reads `positionOffset`/`scale`/`flashIntensity`
    every frame and applies them to the real mesh — the same
    "pure state, dumb renderer applies it" split `Player.ts`'s own
    move/turn animation already uses, and why this is a real,
    unit-tested class rather than inline state in `Game.ts`. `play()`
    queues instead of overwriting: a party hit and the monster's own
    automatic counter-attack can both resolve within one
    `CombatEngine.submitAction` call, and playing them as two beats in
    a row (hit flash, then the counter's lunge) reads far better than
    the second instantly cutting the first off.
  - `Game.ts`'s `handleCombatAction` snapshots the monster's HP and the
    party's total HP before calling `submitAction`, comparing after to
    decide which animation(s) to queue — no `CombatEngine` changes
    needed, since a `Monster`'s own `hp` already is the fact this reads.
    `checkCombatEnd` resets the animator and force-resyncs the mesh to
    a clean base pose the instant a fight ends, regardless of which one
    of victory/defeat/fled it was — otherwise a monster that fled
    mid-animation would keep walking its patrol visibly frozen
    mid-lunge until the next unrelated mesh resync.
  - 343 tests passing.
- ✅ Batch 5 — Real build forks per class, plus as-built reference docs
  (player request: "Make each class have a unique feel to it that can
  be customized by skill selection that has a real impact on gameplay,"
  alongside a request for dedicated combat/skill-system documents).
  Directly follows from feedback on Batch 1: one optional second skill
  per class was a checklist item, not a choice — nothing to actually
  *select between*.
  - `Skills.ts`: every class now has **two** mutually exclusive tier-2
    skills instead of one, via a new `exclusiveWith` field on
    `SkillDef` — unlocking either side permanently rules out the other
    (no respec). Warrior: Second Wind (self-heal) vs. Rally Cry
    (party-wide heal + clears Fear). Rogue: Smoke Bomb (guaranteed
    escape) vs. Ambush (bonus damage only against a still-full-HP
    target). Mage: Frost Lance (control, guaranteed Stun) vs. Cinder
    Nova (bigger fire hit, no control). Cleric: Smite (Holy damage) vs.
    Ward (shields an ally's next hit without spending their turn).
  - `GameLogic.unlockSkill` enforces the exclusivity, refusing (and
    spending nothing) the moment either side of a fork is already
    known. `LevelUpUI.ts`'s skill rows show the locked-out option as
    "unavailable (chose the other one)" rather than a dead button.
  - Ward surfaced a real bug during implementation: it initially reused
    the same `defending` set Defend/Guard write to, which clears the
    instant *its owner's own next turn* starts — fine for a
    self-cast Defend, wrong for a buff cast on someone else, since the
    warded ally's own turn often comes up before the monster's does,
    silently clearing the ward before it ever blocks anything. Fixed
    with a separate `warded` set in `CombatEngine`, consumed only when
    the monster's attack actually lands on that target.
  - [12-combat-system.md](12-combat-system.md) and
    [13-skill-system.md](13-skill-system.md) (new): as-built reference
    docs with every real formula/number, explicitly distinct from
    [05-combat.md](05-combat.md)'s design-rationale framing — cross-linked
    from it, from
    [03-party-and-characters.md](03-party-and-characters.md#leveling),
    and from the docs index.
  - 353 tests passing.
- ✅ Batch 6 — Fix: fleeing didn't actually get you away (player report:
  "smoke bomb doesn't really work well because the monster just
  re-engages into combat again"). True of any successful flee, not just
  Smoke Bomb — `Monster.disengage()` only ever cleared alert state, but
  fleeing never relocates the party, so they're left standing exactly
  adjacent to a monster that's trivially still within its own detection
  radius (adjacent is distance 1 by definition). The very next
  world-turn — even just turning in place — let it re-notice and, per
  `GameLogic.advanceWorldTurn`'s plain adjacency check (no alert-state
  condition at all), re-trigger combat immediately: a successful flee
  was functionally indistinguishable from just continuing the fight.
  Smoke Bomb's 100% reliability is just what made the underlying bug
  impossible to miss.
  - `Monster` gained a `disengageCooldown` (5 world-turns): `disengage()`
    now starts it, and while it's counting down `tick()` skips
    re-alerting entirely and just patrols, regardless of proximity.
    `advanceWorldTurn` skips a monster whose new `isDisengaged` getter
    is true, no matter how close the party still is.
  - `FleeReengagement.test.ts` (new): drives the real
    `attemptMove`/`attemptTurn` functions `Game.ts` calls, proving the
    actual end-to-end symptom is gone (turning in place, standing still
    for several turns, and actually walking away all stay clear of the
    monster the party just fled from) — `Monster.test.ts` covers the
    cooldown mechanism itself in isolation.
  - 360 tests passing.
- ✅ Batch 7 — Asset manifest: a single source of truth for art/VFX
  assets (player request: an inventory of the art assets still needed
  once the game moves off procedural placeholders, an inventory of the
  VFX needed for attack animations/skills, and "a framework such that
  there is a single source of truth for game assets and actions/skills
  that link to art assets so that we can deterministically find if any
  are missing with tests").
  - `assets/AssetManifest.ts` (new): every real art/VFX asset the game
    will need — environment tiles, monster sprites, character
    portraits, equipment/consumable icons, status-effect icons, and
    skill/combat VFX (46 entries) — each with a `status`
    (`"procedural"`: a code-generated placeholder already stands in;
    `"needed"`: nothing does), a description of intent, and one or
    more `links` pointing at the real game entity id it belongs to.
    Deliberately self-contained rather than adding an `assetId` field
    to `Skills.ts`/`Equipment.ts`/`Consumable.ts`/`bestiary.ts`/
    `StatusEffect.ts` — none of those changed at all; only this one
    file needs to change as art gets made or new content ships.
  - `assets/AssetManifest.test.ts` (new): the actual "deterministically
    find if any are missing" check, both directions — every `links`
    entry resolves to something real (catches a stale/typo'd id in the
    manifest), and every real skill/monster/class/equipment item/
    consumable/status effect has at least one asset covering it
    (catches new content shipping with no manifest entry for it).
    Verified against a deliberately broken manifest mid-implementation
    to confirm it actually fails, by name, before trusting it.
  - `Character.ts`/`StatusEffect.ts`/`bestiary.ts` each gained a small
    `ALL_*_IDS` export (`ALL_CLASS_IDS`, `ALL_STATUS_EFFECT_TYPES`,
    `ALL_MONSTER_TYPE_IDS`) the completeness test needed to iterate
    every real id rather than hardcode a union type — `PartyCreationUI.ts`
    now reuses `ALL_CLASS_IDS` too, instead of its own local copy of
    the same list.
  - [14-asset-inventory.md](14-asset-inventory.md) (new): explains the
    system and how to extend it; deliberately doesn't restate the
    manifest's actual contents in prose (the code is the single source
    of truth, not a second copy of it) — see
    [10-visual-style-guide.md](10-visual-style-guide.md#asset-specs),
    updated to point at it.
  - 376 tests passing.
  - **Follow-up (player request):** "The manifest should be in some
    language neutral structure like yaml so that external tools can use
    it." The 46 entries moved out of `AssetManifest.ts`'s object
    literal and into `assets/asset-manifest.yaml` — a plain YAML file
    any external tool (an art tracker, an asset-pipeline script,
    anything that isn't TypeScript) can read directly, without going
    through this codebase's build at all. `AssetManifest.ts` is now
    just a thin loader (`js-yaml` + `node:fs`, read once at import
    time) handing back the exact same typed `ASSET_MANIFEST` shape as
    before, so `AssetManifest.test.ts` needed zero changes. Verified
    the round-trip two ways: the full test suite still passes
    unchanged against the YAML-backed data, and the file was parsed
    independently with Python's `pyyaml` (a completely different
    language's YAML library, not just the `js-yaml` this project
    happens to use) to actually confirm the "language neutral" claim
    rather than assume it. `node:fs`-based loading never reaches the
    browser bundle either way (nothing in `Game.ts` imports the
    manifest), confirmed by grepping the built output.
  - **Follow-up (player request): "Add placeholder animations for spell
    effects."** Directly filled twelve of the manifest's own `"needed"`
    `skill-vfx` entries — every skill now has a real, if placeholder,
    visual, flipped to `"procedural"` in `asset-manifest.yaml` with a
    `placeholderNotes` entry describing exactly what stands in (and
    what still doesn't, versus the entry's own described intent).
    - `Projectile.ts`/`ScreenFlash.ts` (new): two more pure animation
      classes alongside `MonsterAnimator.ts`, same "pure state, dumb
      renderer applies it" split and same reason each is real,
      unit-tested code rather than inline state in `Game.ts`. A
      projectile is a straight-line position lerp from wherever it's
      fired to wherever it's aimed; a screen flash is a color plus a
      linear fade-out, applied to a new `#combat-flash` full-screen DOM
      overlay via `Hud.setScreenFlash` — the placeholder for a
      self/party-targeted skill, since the party has no mesh of its own
      in this first-person view for an effect to land on.
    - `Game.ts` gained a `SKILL_VFX` table (every real `SkillDef.id` ->
      a kind — `"projectile"`, `"melee"`, or `"screen"` — plus a color)
      and looks it up by the `skillId` `handleCombatAction` already
      receives directly, rather than inferring which skill ran from
      HP deltas the way the hit/attack animation *triggers* already do
      — those two concerns are separate: HP deltas decide *whether* to
      animate, `SKILL_VFX` decides *which color/kind*.
      `MonsterAnimator.play("hit", color)` gained an optional color
      parameter for exactly this — a Firebolt hit flashes orange, Smite
      flashes gold, a plain Attack still defaults to white.
    - 390 tests passing.
- ✅ Batch 8 — Character creation shrinks to one, recruit the rest
  (player request: "Add character creation at the start of the game.
  We start the game with only a single character and as you rescue
  NPCs sometimes you get the offer to have them join your party up to
  the 4 party slots"). Scoped by two follow-up answers: the three
  recruitable companions are the other three classic roster members
  (whichever the player didn't build), and pacing is one guaranteed
  rescue per level, on levels 1-3.
  - `PartyCreationUI.ts`: four slots became one. The player still picks
    a class/name/portrait, same as before, just for the single
    character the run now starts with — `onConfirm` still hands back a
    `PartyMemberSpec[]` (length 1), so `Game`'s constructor and
    `roster.createParty` needed no change, both already generic over
    party size. A one-line hint under the slot ("You descend alone.
    Others wait to be found — and freed — below.") replaces the old
    "Assemble your party" framing so a returning player isn't left
    wondering where the other three slots went.
  - `roster.ts` gained `createCharacterFromSpec` (pulled out of
    `createParty`'s map body so `RescueEncounter` can build one
    character the same way) and `recruitableCompanions(startingClassId)`
    — the other three `DEFAULT_PARTY_SPEC` entries, in fixed roster
    order (warrior, rogue, mage, cleric), skipping whichever class the
    player started as.
  - `interactables/RescueEncounter.ts` (new): one placed on each of
    levels 1-3, unmissable in the main corridor like `NpcEncounter`.
    Deliberately no accept/decline choice — every recruit is a strict
    upgrade (another class's kit, more HP, no cost), so interacting
    *is* the offer, matching this game's existing "sparse encounter,
    not a dialogue tree" shape rather than adding new branching-choice
    UI for a decision with only one sane answer. Which companion
    actually shows up isn't baked into level data at all: `interact`
    resolves it live against `party.members[0]`'s class (the starting
    character never moves in the array — only `addMember` ever
    appends) via `recruitableCompanions`, filtered to whoever isn't
    already recruited, and takes the first one left. That's what lets
    the same three static level spawns correctly offer the right three
    companions regardless of which class was picked at creation, with
    zero coordination between the three level files. Idempotent on a
    repeat interact, and degrades to a plain message instead of
    crashing if the party's already full or (shouldn't happen given
    the pacing) already has every companion.
  - `Party.ts` gained `addMember` (a `MAX_PARTY_SIZE = 4` no-op past
    the cap) and a doc-comment update — every existing method already
    iterated `members` rather than assuming length 4, so growing the
    array mid-run needed no other change here.
  - One rescue spawn added to each of `Level.ts` (level 1, at (2,2) —
    reachable straight from the entrance, before the level's first
    fight), `levels/level2.ts` (level 2, also pre-fight), and
    `levels/level3.ts` (level 3, at (8,1) — the only free tile in that
    level's single-corridor layout, which places it after that level's
    two mandatory fights rather than before; consistent with level 3
    already being the hardest pre-boss content, and the party having
    had two recruitment chances by the time it's reached). No monster
    stats changed: level 1's fights were already the game's gentlest
    (Phase 2's teaching-ladder baseline), placing its rescue before
    either fight is what actually addresses a solo start rather than
    re-tuning numbers tuned for a very different concern.
  - `docs/02-setting-and-story.md` and
    [Party creation vs. pre-generated](03-party-and-characters.md#party-creation-vs-pre-generated)
    above updated for the new solo-start-then-recruit structure; the
    old "exact number/identity of starting party members" open
    question is resolved, not open anymore.
  - 401 tests passing.
  - **Follow-up (player report): "there were no companions on level 1
    that I saw."** `InteractableMesh.ts`'s `createInteractableMesh`
    switch had no case for `"rescue"`, so it fell through to `default:
    undefined` — every `RescueEncounter` was mechanically real
    (reachable, interactable, correctly resolved) but completely
    invisible in the 3D view, indistinguishable from empty floor. Added
    `buildRescue`: a crouched, warmly-glowing cylinder, deliberately
    shorter and differently lit than `buildNpc`'s standing cone so a
    rescue reads as "someone here, come find them" rather than
    blending into ordinary NPC flavor dressing.
  - **Follow-up (player question): "After the companion joins the
    party, shouldn't their interactable disappear?"** It didn't —
    `RescueEncounter` had no `isConsumed`, so its (now-visible) mesh
    and tile sat there forever after recruiting, unlike every other
    one-time pickup (`KeyItem`, `EquipmentPickup`). Added `isConsumed`,
    true once `resolved` — the same convention those already use, read
    by `InteractableManager.handleInteract` to drop the entity from the
    level and by `Game.refreshEntityVisual` to remove its mesh. Set on
    a successful recruit and on the "every companion already found"
    edge case; deliberately left `false` on the "party's already full"
    decline, so a companion that genuinely couldn't join yet stays
    findable rather than silently vanishing.
  - 404 tests passing.
  - **Follow-up (player report): "when a new companion joins the party
    they don't show up in the status on the top right until the next
    combat starts."** `Game.ts`'s `handleInteract` never called
    `hud.updateParty` — only `startCombat`/`checkCombatEnd`/level-up/
    etc. did, none of which run on an ordinary interact, so a freshly
    recruited companion was invisible in the HUD until something
    unrelated happened to refresh it. Added `hud.updateParty` to
    `handleInteract`, right alongside the `hud.updateInventory` call
    that already ran unconditionally on every interact for the same
    reason (cheap, and there's no cheaper way to know which interact
    just changed the party). `Game.ts` has no test file (untested
    DOM/rendering glue per docs/11-testing-strategy.md); the party
    mutation this surfaces was already covered by
    `RescueEncounter.test.ts`.
  - **Follow-up (player report): "When new companions join the party
    they may have the same color as already existing party members."**
    Real gap: a companion always recruited wearing their fixed
    `DEFAULT_PARTY_SPEC` portrait, but the player's own starting
    character is a free portrait choice in `PartyCreationUI` — nothing
    stopped them picking, say, Bram's usual 🔴 for themself, and
    recruiting Bram later handed him that exact same swatch, two party
    members indistinguishable in the HUD's party status.
    `roster.pickAvailablePortrait(usedPortraits, preferred)` (new):
    keeps a recruit's usual color when it's actually free, otherwise
    picks whatever's left from `PORTRAIT_OPTIONS` — with up to 4
    members sharing 6 colors there's always at least one free by the
    time a 2nd-4th member joins. `RescueEncounter.interact` calls it
    with the current party's portraits before building the recruit.
  - 409 tests passing.
- ✅ Batch 9 — Attribute points and a starting skill at character
  creation (player request: "There should be a character creation
  screen at the beginning of the game where the user can assign
  attribute points and pick a starting skill"). Scoped by two
  follow-up answers: attributes are bonus points on top of the class's
  existing base stats (not a from-scratch point-buy), and "a starting
  skill" means a brand-new second tier-1 option per class — a real
  choice at level 1 — rather than moving the existing tier-2 fork
  earlier.
  - `Skills.ts`: every class gains a second free (`unlockCost: 0`)
    tier-1 skill, exclusive with the class's original one via the same
    `exclusiveWith` mechanism the tier-2 fork already uses — an
    offense-leaning option paired with a defense/utility-leaning one,
    same "everything answers something specific" principle as every
    fork before it: Warrior's **Power Strike** (harder physical hit, no
    downside) vs. Guard (defense); Rogue's **Feint** (an immediate,
    better-than-usual but not guaranteed flee attempt) vs. Precision
    Strike (offense); Mage's **Arcane Barrier** (self-Ward, reusing
    `CombatEngine`'s `warded` set) vs. Firebolt (offense); Cleric's
    **Radiant Spark** (modest Holy damage, deliberately weaker than
    Smite) vs. Cleanse (utility). `defaultSkillId` stays index 0 of
    each class's array (the class's *original* signature skill), so
    every existing caller that never chooses — `createStartingParty`,
    `RescueEncounter`'s recruits, the whole pre-Batch-9 test suite —
    keeps behaving exactly as before.
  - `Character.ts`'s constructor gained an optional `startingSkillId`
    param (defaults to `defaultSkillId`), seeding `knownSkillIds` with
    whichever tier-1 option was actually chosen instead of always the
    class default. `LevelUpUI.buildSkillRow` needed **no changes at
    all** — its existing "known" / "unavailable (chose the other one)"
    / "Unlock" branching, written for the tier-2 fork, already
    generalizes correctly to a second exclusive pair for free, since it
    keys off `exclusiveWith` + `knowsSkill` rather than anything
    tier-specific.
  - `roster.ts`: `PartyMemberSpec` gained `statBonuses` (bonus points
    per stat) and `startingSkillId`; a new `CREATION_ATTRIBUTE_POINTS`
    constant (5); `createCharacterFromSpec` applies `statBonuses`
    through the real `Character.spendPointOnStat` (not a hand-rolled
    copy of its Vitality/Focus max-HP/Mana logic), granting exactly
    `CREATION_ATTRIBUTE_POINTS` worth of `skillPoints` first so
    anything left unallocated at creation carries over as ordinary
    unspent points, spendable at the first Level Up screen instead of
    being forced or lost. Both fields are `undefined` for
    `DEFAULT_PARTY_SPEC`'s four classic members and anything built from
    them (`RescueEncounter`'s recruits), so only the player's own
    created character ever gets bonus points or a real tier-1 choice.
  - `PartyCreationUI.ts`: two new sections per character, rebuilt
    whenever the class selection changes (base stats and the tier-1
    pair both depend on it) — an attribute allocator (same +1-per-point
    mechanic `LevelUpUI` already uses for leveling) and a starting-skill
    picker between the class's two tier-1 options, each with its own
    description shown live.
  - `CombatEngine.resolveAbility` gained the four new skills' execution
    logic. Two needed care to test correctly: Feint's success case
    can't be told apart from Smoke Bomb's own `this.result = "fled"`
    pattern by inspection alone, so its test found a real seed rather
    than assuming one; Arcane Barrier's self-halving test discovered
    that neither "defend" (self-defending never actually clears before
    a 1v1 monster turn, contaminating the baseline — the exact class of
    bug the real Cleric Ward fix already fixed once) nor "attack"
    (consumes an RNG roll the ability branch doesn't, desyncing the two
    runs) works as a baseline action with only one party member; a
    zero-roll, non-defending `"item"` no-op (no matching item, no
    inventory attached) is what actually isolates the halving.
  - 4 new skill-VFX manifest entries, one per new skill
    (`asset-manifest.yaml` + `Game.ts`'s `SKILL_VFX`, now 16 total) —
    `AssetManifest.test.ts`'s completeness check requires one per real
    skill, tier-1 alternatives included.
  - 420 tests passing.
  - **Follow-up (player request): "Add tooltips to the attributes and
    skills in both the character creation and levelup screens so users
    know what they do."** `LevelUpUI.buildSkillRow` already set a
    tooltip for skills (`label.title = skill.description`, from the
    original Phase 7 build) but nothing set one for stats, on either
    screen, and `PartyCreationUI`'s new skill-picker buttons (Batch 9)
    had none either — the skill's description was only ever visible as
    static text once selected, not on hover, and never for the
    unselected option without clicking it.
    - `Character.ts` gained `STAT_DESCRIPTIONS` (one line per stat,
      exactly matching docs/03-party-and-characters.md#core-stats'
      "Drives" column) — a single source of truth both
      `PartyCreationUI` and `LevelUpUI` import, so the two screens
      explain the same five stats with the same wording rather than
      risking two copies drifting apart.
    - Both screens' stat rows now set the tooltip on the whole row, not
      just the label text — hovering the actual `+1` button shows it
      too, not just the number next to it. `LevelUpUI`'s skill rows got
      the same "whole row" treatment for consistency with its own stat
      rows. `PartyCreationUI`'s skill-picker buttons gained
      `title = skill.description` directly.
  - 421 tests passing.
  - **Follow-up (player request): "The character creation screen should
    show hp and mana points so the user can evaluate the attribute
    changes."** The attribute allocator showed the five raw stats
    changing live, but not the two numbers a Vitality/Focus point
    actually buys — a player had to do the arithmetic themselves (or
    just guess) to see what a point spent there was really worth.
    - `Character.ts`'s `VITALITY_HP_PER_POINT`/`FOCUS_MANA_PER_POINT`
      (previously private, the exact constants `spendPointOnStat`
      itself uses) are now exported, so `PartyCreationUI` previews the
      real number rather than a hand-rolled copy that could drift out
      of sync with the actual mechanic.
    - `PartyCreationUI.buildDerivedRow` (new): a read-only `HP: X
      Mana: Y` line at the top of the attributes section, recomputed
      on every `renderCustomize` (so it updates live as points are
      spent, or the class changes) from `CLASS_BASE_STATS` plus
      whatever's currently allocated to Vitality/Focus. Read-only
      because neither is itself an allocatable stat — there's no "+1
      HP" button, only "+1 Vitality."
  - 421 tests passing (unchanged — `PartyCreationUI` has no test file,
    untested DOM glue per docs/11-testing-strategy.md, and the
    exported constants' values didn't change, just their visibility).
- ✅ Batch 10 — Skill cooldowns (player report: "Skills should have a
  cooldown. For example Power Strike is strictly better than a regular
  attack, so why wouldn't a Warrior use it every turn?" — true of
  every 0-mana skill with no built-in drawback, not just that one, and
  really of Precision Strike since Phase 3). Scoped by a follow-up
  answer: every skill gets a cooldown, not just the free offense ones
  that most obviously outclass Attack.
  - `Skills.ts`: every `SkillDef` gained a `cooldown` (rounds before
    reuse). Both sides of a fork always share the same value, so a
    build choice stays about the effect, never about recharge speed —
    every tier-1 skill sits at 2 rounds, every tier-2 skill at 3,
    mana-gated or not (mana cost and cooldown are separate throttles,
    not substitutes for one another).
  - `Character.ts` gained `skillCooldowns` (a `Map<skillId, roundsLeft>`)
    and four methods: `cooldownRemaining`/`isSkillReady` (read),
    `startCooldown` (write, called only by `CombatEngine` the instant a
    skill actually resolves), and `tickCooldowns` (decrements every
    active entry by one, dropping any that reach zero). Not
    round-tripped by `SaveGame.ts` — same "no scumming prevention
    chased" acceptance v1 already applies elsewhere, and saving
    mid-combat isn't possible anyway.
  - `CombatEngine.resolveAbility` checks `isSkillReady` right after the
    known-skill check (before silence/mana), refusing with a "can't
    use X again yet (N turns left)" log line and spending nothing if
    it fails; `startCooldown` fires right after the mana deduction, so
    only a skill that actually resolves ever starts recharging.
    `rollInitiative(true)` — the same round boundary that already
    ticks status-effect durations — now also calls `tickCooldowns` on
    every living party member.
  - A real implementation trap surfaced during testing, not just
    design: a cooldown of exactly 1 has **no effect at all** in this
    turn-based engine. A character only ever acts once per round, so
    their own next possible attempt at a skill is already the *next*
    round — and a cooldown of 1 ticks down to 0 during that exact
    round transition, before the character could ever attempt a
    repeat. Four skills shipped with `cooldown: 1` initially (the
    mana-gated tier-1 caster skills) and a test written to prove the
    mechanic caught it immediately — corrected to 2, the smallest
    value that does anything, and `Skills.test.ts` now asserts every
    skill is at least 2 directly so this can't silently regress.
  - `CombatUI.renderSkills`: a skill still on cooldown shows its
    remaining turns right on the button (`Name (N↻)` instead of its
    mana cost) and in its tooltip, and is disabled the same way an
    unaffordable skill already was.
  - `CombatEngine.test.ts`'s existing Guard test had to change, not
    just gain new tests alongside it: it previously re-cast Guard every
    round across a whole fight to prove the monster always retargeted
    onto the Warrior, which is no longer true now that Guard has a
    cooldown — narrowed to proving what a *single* successful cast
    does, which is still exactly true.
  - 433 tests passing.
  - **Follow-up (player request): "The player should not be allowed to
    enter the dungeon until they have allocated all unspent attribute
    points."** Nothing previously stopped a player from hitting
    Descend having never touched the allocator at all —
    `roster.createCharacterFromSpec`'s own "anything left unspent
    banks as ordinary `skillPoints` for the first Level Up screen"
    fallback (by design, so a partial allocation was never *lost*)
    also meant a *complete* non-allocation silently worked the same
    way, which wasn't the intent.
    - `PartyCreationUI.confirmButton` is now disabled
      (`refreshConfirmButton`, called from `renderCustomize` on every
      state change — a class swap, a stat spent, a skill picked) while
      any of `CREATION_ATTRIBUTE_POINTS` remain unspent. A new
      `#party-creation-confirm-hint` line names exactly how many are
      left, since a disabled button alone has no touch-friendly
      explanation (no hover tooltip on a phone).
    - `roster.createCharacterFromSpec`'s "banks unspent points"
      fallback is untouched — still exactly right for a save written
      before this screen ever offered points — it's just no longer
      reachable from a *fresh* character this screen builds.
  - 433 tests passing (unchanged — `PartyCreationUI` has no test file,
    untested DOM glue per docs/11-testing-strategy.md).
- ✅ Batch 11 — Fix: the combat log disappeared the instant the party
  died (player report: "When the party dies I can't read the combat
  log to see what happened"). `Game.checkCombatEnd` calls
  `combatUI.hide()` unconditionally, for every fight outcome, before
  even checking which one it was — the whole combat overlay, log
  included, was already gone by the time `hud.showDefeatScreen()` drew
  the defeat screen over it, whether or not that overlay would have
  still been visible underneath anyway (it wouldn't have been: `#defeat-screen`
  is a near-opaque full-screen layer).
  - `Game.checkCombatEnd` now grabs `this.combatEngine.log.slice(-14)`
    before clearing `combatEngine`/hiding the combat overlay, and hands
    it to `hud.showDefeatScreen(finalLog)` on the defeat branch only —
    victory and flee don't need it, both already show their own
    one-line summary via `hud.showMessage`.
  - `Hud.showDefeatScreen` gained an optional `finalLog` param, written
    into a new `#defeat-screen-log` element added directly to the
    defeat screen's own markup — shown on the screen itself rather
    than depending on anything still being visible underneath it,
    scrollable (`max-height: 40vh`) so a long fight's tail never pushes
    the title off a short phone screen.
  - 433 tests passing (unchanged — `Game.ts`/`Hud.ts` are untested DOM/
    rendering glue per docs/11-testing-strategy.md; `CombatEngine.log`
    itself, the data being surfaced, was already covered everywhere
    else it's used).
- ✅ Batch 12 — Use consumables outside combat (player request: "I need
  to be able to use consumables outside of combat"). Previously the
  only way to reach a cure item's effect was the Item action mid-fight
  — a party that won or fled a fight still carrying Bleed/Poison/Fear
  had no way to shake it off before whatever came next.
  - `GameLogic.useConsumable(world, characterName, itemId)` (new): the
    same cure logic `CombatEngine.resolveItem`'s cure branch already
    has (consume, identify, remove the status, report whether there
    was anything to cure), reachable from exploration instead of a
    fight. A damage consumable (Holy Water, Oil Flask) is refused with
    a message rather than silently doing nothing — there's no monster
    to throw it at outside combat. Works on a downed party member too:
    curing a status isn't reviving anyone, but there's no reason a
    status should be un-curable just because its owner is at 0 HP.
  - `InventoryUI`: a cure consumable is now selectable from `Carried`
    the same way a piece of gear is; selecting one shows a "Use
    [item]" button on every character card (a damage consumable, or a
    plain key item, stays reference-only, same as before). Unlike
    mid-combat use — which always targets whoever uses it, per
    docs/12-combat-system.md's "no ally-targeting for cure items yet"
    — this path *does* let the player choose the target, since there's
    no single "acting character" to default to outside a turn.
  - 440 tests passing (7 new, all headless coverage of
    `GameLogic.useConsumable` — `InventoryUI`/`Game.ts` themselves stay
    untested DOM glue per docs/11-testing-strategy.md).
- ✅ Batch 13 — Current HP in the combat log (player request: "In the
  combat log when a character takes damage, list how much current HP
  they have left"). Every log line where a party member takes damage —
  a monster's hit landing (`runMonsterTurn`) or a DoT tick (`rollInitiative`'s
  Bleed/Poison resolution) — now names their current/max HP right in
  the line (`"... — 14/22 HP left."`), not just as a number elsewhere
  on screen. Deliberately *not* added to the monster's own HP in either
  of those same log lines — `CombatUI.statusEl` already shows it
  persistently, so repeating it on every hit would just be noise.
  443 tests passing (3 new).

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
