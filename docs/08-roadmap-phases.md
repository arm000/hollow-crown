# Roadmap: Phased Implementation

**Rule for every phase below: it isn't done until it's playable.** Each
phase has an explicit "Playable when" gate — a real start-to-finish loop
a person can sit down and complete. If a phase's scope doesn't reduce to
something playable, split it rather than skip the gate. Don't start the
next phase's systems until the current phase's gate is met.

Phases are additive: each one keeps everything the previous phase made
playable working, and layers new systems on top.

---

## Phase 0 — Walking Skeleton ✅ Complete

**Scope:** Grid-locked first-person movement and rendering. One small
hand-authored level. No interactables, no entities, no UI beyond static
HUD text.

**Built:** `DungeonMap`, `DungeonMesh`, `Player`, `InputManager`, `Game`.

**Playable when:** Launch the game, walk a full lap of the level, turn,
strafe, hit walls without breaking anything. No crashes, no dead ends
that shouldn't be dead ends.

**Status:** Done — this is the current state of the repo.

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

---

## Phase 2 — Party & Turn-Based Combat

**Scope:**

- Hardcoded 4-character party (one pre-built character per class:
  Warrior/Rogue/Mage/Cleric), front/back rank.
- `WorldClock`: the world-turn tick described in
  [04-exploration-and-world.md](04-exploration-and-world.md#world-turns).
- One monster type ("aggressive melee" AI per
  [05-combat.md](05-combat.md#monster-ai-v1-scope)) that patrols and
  detects the party on the shared tick.
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
correctly either way (recommend adding Vitest here per
[07-technical-architecture.md](07-technical-architecture.md#testing) to
lock down initiative/damage math as it's written).

---

## Phase 3 — Character Depth & Equipment

**Scope:**

- Full class definitions: each of the 4 classes gets 1-2 real abilities
  (Ability combat action goes live), a level table, and stat growth
  (leveling per [03-party-and-characters.md](03-party-and-characters.md#leveling)).
- Equipment slots (Weapon/Off-hand/Armor/Accessory) with real stat
  effects; a slotted shared inventory UI (not spatial-grid — see
  [06-items-and-equipment.md](06-items-and-equipment.md#inventory-model)).
- Minimal party-creation/naming screen (pick class + portrait per slot;
  full point-buy attribute creation is a stretch goal, not required).
- At least one puzzle or encounter in the level whose outcome visibly
  depends on a class ability or a piece of found gear (e.g., a locked
  gate only Rogue lockpicking opens, or a chasm only a Mage spell
  crosses).

**New tech:** class/ability data tables, equipment stat-modifier system,
inventory UI, skill-check gating on interactables.

**Playable when:** Build and level a party across a slightly larger
level, equip gear found along the way, and see a specific build choice
(a class ability, a piece of gear) materially change how a specific
puzzle or fight plays out — not just bigger numbers in the same fights.

---

## Phase 4 — Multi-Level Descent & Persistence

**Scope:**

- Stairs/level-transition entity linking 2-3 authored levels into one
  small descent.
- Save/load via `localStorage`
  ([07-technical-architecture.md](07-technical-architecture.md#save-system)):
  party state, current level, position/facing.
- Monster roster expansion to 2-3 types with distinct AI (cautious
  ranged, support, per
  [05-combat.md](05-combat.md#monster-ai-v1-scope)).
- A real difficulty curve across the levels, tuned by hand.

**New tech:** level-transition manager, save/load serialization, monster
AI variety.

**Playable when:** Descend through the full small multi-level dungeon,
quit mid-session, relaunch, resume from the save, and finish the
descent — with a difficulty curve that's noticeably harder at the bottom
than the top.

---

## Phase 5 — Content & Narrative Pass

**Scope:**

- Weave in *The Hollow Crown* story per
  [02-setting-and-story.md](02-setting-and-story.md): lore items, 1-2 NPC
  encounters, a mid-dungeon reveal, a boss fight tied to the plot.
- Environmental art pass: real textures replacing flat wall/floor/ceiling
  colors, varied lighting per room instead of just the carried torch.
- Audio: footsteps, combat SFX, ambient loop(s).
- Minimap (top-down render sourced from the same level data as the 3D
  geometry).
- Identification/cursed-item texture if still wanted
  ([06-items-and-equipment.md](06-items-and-equipment.md#identification--curses)).

**New tech:** texture/material pipeline, audio manager, minimap renderer,
simple lore/dialogue text UI.

**Playable when:** A vertical slice that feels tonally like *the game*,
not a systems demo — a full descent through one act, story beats landing
in the first-person view itself, ending in a boss fight, with sound and
lighting doing real atmospheric work.

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
