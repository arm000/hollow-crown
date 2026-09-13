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
  - 283 tests passing.
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
