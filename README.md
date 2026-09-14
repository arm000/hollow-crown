# The Hollow Crown

A first-person, grid-based dungeon crawler in the tradition of *Legend of
Grimrock*: tile-locked movement, 90-degree turns, no mouse look, and a
first-person view into hand-authored levels.

Built with [Three.js](https://threejs.org/), TypeScript, and
[Vite](https://vitejs.dev/).

**Play the current build:** https://arm000.github.io/hollow-crown/
(auto-deployed from `main` on every push — see
[docs/09-deployment.md](docs/09-deployment.md))

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL in a browser.

## Controls

| Key            | Action        |
| -------------- | ------------- |
| `W` / `S`      | Walk forward / backward |
| `A` / `D`      | Strafe left / right |
| `Q` / `E`      | Turn left / right |
| `←` / `→`      | Turn left / right |
| `Space`        | Interact (doors, levers, items, ...) |
| `1` / `2` / `3` / `4` | In combat: Attack / Defend / Ability / Flee |
| `I` / Escape   | Open / close the inventory screen |

On a touchscreen device, on-screen pads (move, bottom-left; turn,
bottom-right) replace the keyboard automatically — no setup needed, and
no keyboard/mouse required to play. Combat's Attack/Defend/Flee buttons
work the same way on both. The inventory screen opens from its own
always-visible button (top-left) instead, since that one needs to work
identically with no keyboard at all. The game targets touch and desktop as
equally first-class from the start; see
[docs/01-vision.md](docs/01-vision.md#platform--scope).

Movement and turning are locked to the dungeon grid, animated smoothly
between tiles.

## Project layout

```
src/
  main.ts               entry point
  game/
    DungeonMap.ts        ASCII level data + tile queries
    DungeonMesh.ts       builds floor/ceiling/wall geometry for a level (optional real materials, else flat-color placeholders)
    Textures.ts          procedurally-drawn pixel-art wall/floor/ceiling textures (Act 1's palette)
    Level.ts             level 1's entity/monster spawns (key, door, stairs, ...)
    levels/              LevelDef.ts, level2.ts, level3.ts, level4.ts (boss arena), index.ts (the LEVELS registry)
    Player.ts            grid position, facing, move/turn animation, teleportTo (level transitions)
    InputManager.ts      keyboard/touch -> discrete action queue
    TouchControls.ts     on-screen movement/turn/interact buttons
    Inventory.ts         shared party inventory (id -> name/count); unidentified-item mystery names
    AudioManager.ts      procedural SFX/ambience via the Web Audio API (oscillators + noise)
    Hud.ts               DOM message line, party/inventory status, win/defeat screens
    InventoryUI.ts       DOM overlay: view carried items, equip/unequip gear across the party
    BestiaryUI.ts        DOM overlay: encountered monsters' resistances/status/mechanics
    Minimap.ts           pure data: dungeon -> revealed wall/floor/unknown grid, fog of war
    MinimapUI.ts         <canvas> overlay rendering Minimap.ts's grid + player position/facing
    Lighting.ts          light color/intensity constants — headlessly testable
    Rng.ts               seedable RNG (mulberry32) for testable combat/AI randomness
    WorldClock.ts        one player action -> every registered entity ticks once
    GameLogic.ts         pure move/interact/turn/equip resolution (no rendering) — headlessly testable
    SaveGame.ts          localStorage save/load: serialize/deserialize party+inventory+level+position
    interactables/       Door, Lever, PressurePlate, PushableBlock,
                         SecretWall, ClassGate, StairsDown, KeyItem,
                         LoreItem, NpcEncounter, ExitTile,
                         EquipmentPickup, InteractableManager
    party/               Character, Party, roster.ts, PartyCreationUI.ts,
                         classes.ts (abilities), Equipment.ts, Leveling.ts
    monster/             Monster (patrol/detection AI + its combat turn),
                         bestiary.ts (monster types + MonsterSpawn/buildMonsters),
                         BestiaryEntry.ts (describeMonster for the codex screen)
    combat/              CombatEngine (pure), CombatUI (DOM overlay),
                         DamageType.ts, StatusEffect.ts
    Game.ts              wires scene, renderer, input, and world state together
```

## Design docs

The full design — vision/pillars, setting, party & combat systems, and
the phased build plan — lives in [`docs/`](docs/README.md). Start there
before picking up any new feature work; every phase in
[`docs/08-roadmap-phases.md`](docs/08-roadmap-phases.md) has to end in a
playable build before the next one starts.

## Status

Phase 0 complete, Phase 1 nearly complete (only a deferred Playwright
E2E layer left), Phase 2 complete, Phase 3 complete, Phase 4 complete,
Phase 5 complete, **Phase 6 complete — v1 shipped**, **Phase 7 (post-v1
enhancements) in progress** (see the roadmap doc above). Phase 6's own
scope explicitly deferred v1's exact content count to that phase; the
call made there: **v1 ships Act 1 only** (the 4-level descent below),
with Acts 2–4 staying canon for a possible future expansion but not
built, and the ending rewritten as a real, self-contained epilogue
rather than a mid-campaign checkpoint. A full-campaign headless
playthrough test exercises the whole descent with real combat as a
release smoke test, alongside balance sanity checks (XP curve,
resistance math, level data integrity, and a reachability audit across
all four levels). An Options screen (volume, mute, and per-action key
rebinding, all persisted independently of a save) sits alongside
Inventory/Bestiary/Level Up as one of four cross-linked menu screens —
any one reachable directly from any other, and each with its own
always-visible HUD button so none of the four requires opening
Inventory first. The game bundle is split so Three.js loads in the
background instead of blocking the party-creation screen's first paint
(see "Performance" below), and `npm run package:web` produces an
itch.io-ready zip alongside the primary GitHub Pages deploy. Since v1,
Phase 7 turned the original design doc's always-deferred "stat points
to allocate" into a real level-up screen: every level grants skill
points spent by hand, either +1 to a stat or toward one of a class's
**two mutually exclusive** second skills — a real build fork per class,
not a single yes/no unlock (choosing either side permanently rules out
the other). Warrior: a self-heal vs. a party-wide heal that clears
Fear. Rogue: a guaranteed escape vs. a much harder hit while the target
is still undamaged. Mage: a stun vs. a bigger raw-damage nuke. Cleric:
its first offensive spell vs. shielding an ally's next hit without
spending their turn. Full breakdown in
[13-skill-system.md](docs/13-skill-system.md); the general combat rules
every skill plays inside of are in
[12-combat-system.md](docs/12-combat-system.md). A new asset manifest
(`src/game/assets/AssetManifest.ts`,
[14-asset-inventory.md](docs/14-asset-inventory.md)) is the single
source of truth for every real art/VFX asset the game will need once it
moves off today's procedural placeholders — every skill, monster,
class, and item is cross-checked against it by a test, so a new one
shipping with no art entry fails loudly instead of quietly falling
through the cracks. Playable now: a
one-time party-creation screen (name each of the four slots, pick a
class and a color-swatch portrait — placeholder art, real pixel art is
still ahead — or accept the defaults to get the original
Bram/Ysolde/Corvin/Maren party), then grid movement (keyboard or touch)
through a 4-level descent, all of it Act 1 ("The Sunken Wards"): level
1's hand-authored puzzle box (a mandatory key-and-door gate, an optional
lever/plate/block bonus alcove, a secret wall, and a passage that only
opens for a party with a Rogue along), two smaller, more linear levels
proving the descent mechanic itself — a `StairsDown` tile carries the
party to the next level's own start tile — and a final open boss arena.
Two sparse NPC encounters (a steward, a sentry naming the boss ahead)
punctuate the corridors, and the current level's name shows in the HUD.
Five monster types along the way, all with real turn-based combat: a
Rot-thing (telegraphed heavy strike), a Cinder Wretch (resistant to
Physical, weak to Fire — melee alone goes badly, the Mage's Firebolt
turns it around), a Screeching Wraith (its heavy strike inflicts Fear,
forcing a Defend next turn — the Resolve stat and Cleric's Cleanse
finally have something to answer), a Court Alchemist (heals itself
instead of attacking on its telegraphed turn — burst it down or watch it
undo your work), and Steward Marrow, Act 1's boss — a "final exam"
combining the Rot-thing's telegraph, the Wraith's Fear, and a
Cinder-Wretch-shaped resistance profile (Physical-resistant, Holy-weak
this time — Holy Water is the answer). Attack/Defend/Ability/Flee/Item,
status effects (Bleed, Fear, and Stun — the Mage's Frost Lance, a Phase
7 skill — are all live now; Poison/Silence are mechanically real but
still await a source), victory/defeat/flee all handled. The monster
itself animates now — a quick lunge toward the party on its own
attack, a scale-punch-plus-flash when the party's hit lands — instead
of sitting dead still through the whole fight. An initiative
tracker above the monster's HP line shows the
whole round's turn order at a glance — dimmed for who's already acted,
highlighted for whoever's turn it is, struck through for anyone downed
— so the party can see the monster's turn coming and plan around it.
Six equipment pickups are spread across the descent (a sword,
a fire-resisting charm, a ring behind level 1's class-gated passage, and
a Focus-boosting talisman in a one-tile pocket a pushable block sits on
top of until it's shoved onto its pressure plate; a Grace-boosting
buckler right at level 2's entrance; Physical-resisting armor in a
breather alcove between level 3's two finale fights) and two
consumables (an Oil Flask, an Antidote) are findable in level 1 — shown
under a mystery name (e.g. "a bubbling amber vial") until actually used
once in combat, per the "discovery, not explanation" principle taken to
its stretch tier. A cursed ring (a real Might bonus, and no way to take
it back off) waits in the boss arena too. Gear
lands in the shared inventory unequipped — tap the always-visible
"Inventory" button (or press `I`) to open a real inventory screen and
choose who wears what, swapping gear freely between party members.
Consumables are usable mid-fight via the Item action, curing a status or
dealing resistance-adjusted damage — a party without a Mage can still
answer a Fire-weak monster by throwing the flask. Defeating a monster or
finding a secret for the first time awards XP, and enough of it levels a
character up (a class-flavored flat HP/Mana bump plus skill points to
spend by hand, shown in the HUD and inventory screen as `Lv2`, etc.).
Inventory, Bestiary, Level Up, and Options are four full-screen menus,
each with its own always-visible HUD button (top-center: Bestiary/
Level Up/Options, next to Inventory/Mute up in the corner) so none of
them requires opening another first — and each also shows the same
navigation row in its own header — Save, then every other one of the
four, then Close — so any of them is one tap from any other too. Save
is a single slot capturing the party,
inventory, current level, and exact position; relaunching the game
offers a "Continue" button on the party-creation screen when a save
exists, skipping straight back into the run. Level Up is where those
skill points actually get spent, on any of the five stats or toward
one side of a class's two-skill fork. Bestiary
opens a codex of every monster type encountered so far (win, lose, or
flee all count), listing its resistances/weaknesses, any status effect
its heavy strike inflicts, and whether it heals instead of attacking —
so a repeat fight can be won on memory, not luck. A small minimap in
the top-left corner fills in via real line of sight — a corridor you can
see straight down is revealed even before you've walked it, stopping at
whatever actually blocks sight (a wall, a closed door, an unrevealed
secret) — sourced from the same level data the 3D geometry reads, not a
separate hand-drawn map. Doors show up on it as their own color, seen or
not yet opened. The dungeon itself now wears procedurally-drawn pixel
art (no art tool or asset files — a canvas-drawn stone/moss pattern
stands in for hand-painted textures) rendered through an actual
low-resolution, nearest-neighbor-upscaled pipeline rather than full-
screen-resolution flat colors, per the pixel-art style guide. Footsteps,
combat hits, encounter/victory/defeat stings, and a low ambient drone
are all synthesized live via the Web Audio API (no sound files either)
— a "🔊"/"🔇" button next to Inventory mutes it all.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build a production bundle to `dist/`
- `npm run preview` — preview the production build locally
- `npm run typecheck` — run the TypeScript compiler without emitting
- `npm test` — run the test suite once
- `npm run test:watch` — run the test suite in watch mode
- `npm run package:web` — build, then zip `dist/` into
  `hollow-crown-web.zip` (git-ignored) with `index.html` at the zip's
  own root — ready to upload as-is to itch.io's HTML5 embed (check "This
  file will be played in the browser" on `index.html` there). The
  GitHub Pages deploy is the primary release; this is an optional
  second distribution channel per
  [08-roadmap-phases.md](docs/08-roadmap-phases.md#phase-6--full-campaign--release-polish),
  not a replacement for it.

## Performance

Phase 6's performance pass (docs/08-roadmap-phases.md) found the render/
update loop itself has nothing to fix — combat and monster AI are
turn-based (`WorldClock.advance()` only runs once per player action, not
per frame) and `Player.update()` no-ops immediately once it isn't
mid-animation, so a rendered frame does almost no work beyond one
low-resolution `WebGLRenderer.render()` call. The real cost was in what
blocked the very first paint: `main.ts` used to `import` `Game.ts` (Three.js
and everything under it) at the top level, so every player — including
on the slow mobile connections this project treats as first-class —
waited on the whole ~570 KB bundle before the party-creation screen
could even appear. `Game.ts` is now a dynamic `import()`, kicked off in
the background the instant the page loads rather than inside the
"Start"/"Continue" callback, so the party-creation screen's own chunk
(~10 KB) paints immediately while the heavy chunk loads in parallel —
by the time a player finishes naming their party, it's almost always
already there.
