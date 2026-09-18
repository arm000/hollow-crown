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
Inventory/Bestiary as one of three cross-linked menu screens — any one
reachable directly from any other, and each with its own always-visible
HUD button so none of the three requires opening Inventory first (Level
Up is a fourth always-visible HUD button, but opens that same Inventory
screen with its "Level Up" editing controls already toggled on, rather
than being a fourth distinct screen). The game bundle is split so Three.js loads in the
background instead of blocking the party-creation screen's first paint
(see "Performance" below), and `npm run package:web` produces an
itch.io-ready zip alongside the primary GitHub Pages deploy. Since v1,
Phase 7 turned the original design doc's always-deferred "stat points
to allocate" into a real level-up screen: every level grants skill
points spent by hand, either +1 to a stat or toward one of a class's
**two mutually exclusive** second (tier-2) skills — a real build fork
per class, not a single yes/no unlock (choosing either side permanently
rules out the other). Warrior: a self-heal vs. a party-wide heal that
clears Fear. Rogue: a guaranteed escape vs. a much harder hit while the
target is still undamaged. Mage: a stun vs. a bigger raw-damage nuke.
Cleric: its strongest offensive spell vs. shielding an ally's next hit
without spending their turn. Every class now has a matching tier-1
fork too, chosen for free at character creation instead of via
leveling — an offense-leaning option vs. a defense/utility-leaning one
(Warrior: draw-and-halve an attack vs. a harder physical hit; Rogue:
resistance-piercing damage vs. a good-odds immediate flee; Mage:
Firebolt vs. a self-only shield; Cleric: status cleansing vs. a first,
modest taste of Holy damage). Full breakdown in
[13-skill-system.md](docs/13-skill-system.md); the general combat rules
every skill plays inside of are in
[12-combat-system.md](docs/12-combat-system.md). A new asset manifest
(`src/game/assets/asset-manifest.yaml` — plain YAML, readable by any
external tool, not just this codebase; see
[14-asset-inventory.md](docs/14-asset-inventory.md)) is the single
source of truth for every real art/VFX asset the game will need once it
moves off today's procedural placeholders — every skill, monster,
class, and item is cross-checked against it by a test, so a new one
shipping with no art entry fails loudly instead of quietly falling
through the cracks. Character creation shrank from four
slots to one: the run now starts with a single player-built character
(name, class, color-swatch portrait), and the other three classic
roster members (Bram/Ysolde/Corvin/Maren, minus whichever class was
just picked) are found and recruited on the way down instead — one
guaranteed, unmissable rescue per level on levels 1-3, a strict upgrade
every time so there's no accept/decline choice to make of it, growing
the party from 1 to 4 by level 4's boss fight if every offer is taken.
Which companion shows up where isn't hardcoded per level; it's resolved
live against whichever class the player started as, so the same three
level spawns work correctly no matter what was picked at creation. That
same creation screen gained the "full point-buy attribute creation" its
own docs used to flag as a stretch goal (a small one): 5 bonus
attribute points to freely allocate on top of the chosen class's base
stats — the exact +1-per-point mechanic the character sheet's Level Up
mode already uses — plus the new tier-1 skill fork above, picked right
there rather than defaulted, with every stat and skill in both that
screen and the character sheet explaining what it actually does as always-visible text
(originally a hover tooltip, fixed once that turned out not to work on
a touch screen at all). Descend
stays disabled, naming how many points are left, until every one of
those 5 is actually spent — nothing used to stop starting a run having
never touched the allocator at all. Every skill — tier-1 and tier-2,
mana-gated or not — also has a cooldown now (2 rounds for tier 1, 3 for
tier 2), so a skill that used to be strictly better than a plain Attack
with nothing to weigh against it (Power Strike, say) is no longer just
the obvious pick every single turn; Attack itself still has no cooldown
at all, staying the reliable fallback while something recharges. A
skill still cooling down shows exactly how many turns are left, right
on its button. The on-screen move/turn pads hide for the duration of a
fight (they never did anything mid-combat anyway, and used to sit
right where the log/action buttons are also pinned on a small phone
screen), and every stat/skill/item description switched from a hover
tooltip to always-visible text once it turned out hovering isn't a
thing a touch screen can even do. That same always-visible treatment
then reached equipment too: a piece of gear shows its real effect
(computed straight from its stat/resistance data, so it can never
drift out of sync) on its Inventory/character-sheet row once
identified — the same "learned by using it" moment a consumable's own
description was already keyed to. The Inventory and Level Up screens
also merged into one character sheet per party member (tabs switch
between them, the shared carried-item pool shows on every tab), so a
player can see exactly what a stat point, a skill unlock, or a piece
of gear actually does to that character's numbers without bouncing
between two separate screens to check; the Level Up HUD button opens
that same sheet with its `+1`/`Unlock` controls already toggled on
instead of a screen of its own. Gear also stopped
identifying itself the moment it's worn at all — a player report that
this was too early, since wearing something and it actually mattering
in a fight aren't the same moment — and the combat log started saying
exactly what an identified item's effect was doing, hit by hit: a
weapon's bonus damage ("Bram attacks for 7 damage (+2 from a Rusted
Sword)"), or how much of an incoming hit a piece of armor blocked
("Bram takes 4 damage (3 blocked by Hardened Leather)"), the same
moment the item actually identifies. Playable now: a
one-time party-creation screen (name
your character, pick a class, allocate every bonus attribute point, choose
a starting skill, and pick a color-swatch portrait — placeholder art,
real pixel art is still ahead), then grid movement (keyboard or touch)
through a 4-level descent, all of it Act 1 ("The Sunken Wards"), every
level a hand-authored, exactly-10×10 map, fully connected (level 1's
own hidden pocket only reachable through a secret passage) and each
harder than the last: level 1's puzzle box (a mandatory key-and-door
gate, an optional lever/plate/block bonus alcove, a secret wall, and a
passage that only opens for a party with a Rogue along) plus a first,
gentle trap; level 2 doubles the mandatory fights on its one corridor
and debuts a rune-sequence puzzle — three unmarked floor sigils that
only unlock their vault once trodden in the order a nearby inscription
actually spells out, any wrong tile resetting the whole sequence; level
3 is a no-branch gauntlet of three fights back to back plus a second,
shorter rune puzzle; level 4 is the final open boss arena, its own
strongest trap waiting right at the threshold. A `StairsDown` tile
carries the party to the next level's own start tile between them all.
Two sparse, non-recruitable NPC encounters (a steward, a sentry naming
the boss ahead) punctuate the corridors alongside the three rescue
encounters above, and the current level's name shows in the HUD.
Seven monster types along the way, all with real turn-based combat: a
Rot-thing (telegraphed heavy strike), a Bound Servant (that same
telegraph turned up — ignore "Defend" and the heavy strike actually
hurts), a Cinder Wretch (resistant to Physical, weak to Fire — melee
alone goes badly, the Mage's Firebolt turns it around), a Screeching
Wraith (its heavy strike inflicts Fear, forcing a Defend next turn —
the Resolve stat and Cleric's Cleanse finally have something to
answer), a Court Alchemist (heals itself instead of attacking on its
telegraphed turn — burst it down or watch it undo your work), an
Armored Sentinel (a reach weapon that hits the back rank even while the
front rank stands — rank alone doesn't guarantee safety), and Steward
Marrow, Act 1's boss — a "final exam" combining the Rot-thing's
telegraph, the Wraith's Fear, and a Cinder-Wretch-shaped resistance
profile (Physical-resistant, Holy-weak this time — Holy Water is the
answer). Traps are scattered across every level too, invisible until
they fire and each one harder than the last (small physical hits at
first, then ones that also inflict Poison or Bleed, then the boss
level's own strongest one, which also inflicts Fear) — a living Rogue
disarms any of them outright, no roll, the same deterministic "handles
trap disarm out of combat" job the class has always had on paper.
Attack/Defend/Ability/Flee/Item,
status effects (Bleed, Fear, and Stun — the Mage's Frost Lance, a Phase
7 skill — are all live now; Poison/Silence are mechanically real but
still await a source), victory/defeat/flee all handled. The monster
itself animates now — a quick lunge toward the party on its own
attack, a scale-punch-plus-flash when the party's hit lands — instead
of sitting dead still through the whole fight, and every skill has its
own placeholder VFX on top of that: a colored bolt streaking from the
camera to the monster for the ranged/magic skills, a recolored hit
flash for close-range ones, or a brief tint across the whole screen for
a skill that targets the caster or party instead (there's no character
mesh to show an effect on in this first-person view). An initiative
tracker above the monster's HP line shows the
whole round's turn order at a glance — dimmed for who's already acted,
highlighted for whoever's turn it is, struck through for anyone downed
— so the party can see the monster's turn coming and plan around it.
Ten equipment pickups are spread across the descent, getting
strictly stronger the deeper the run goes: level 1 has a sword, a ring
behind its class-gated passage, and a Focus-boosting talisman in a
one-tile pocket a pushable block sits on top of until it's shoved onto
its pressure plate; level 2 has a Grace-boosting buckler right at the
entrance, a fire-resisting charm guarding an optional fight, and the
first tier-2 item, a sturdier Steel Cuirass, behind its rune puzzle;
level 3 has a Physical-resisting armor breather between two of its
three finale fights and the first item to bonus two stats at once, a
Crown Shard Pendant, behind its own rune puzzle; level 4 has a cursed
ring with a real Might bonus and no way to take it back off, plus the
descent's single strongest piece of defensive gear, a Reinforced Kite
Shield, guarded by a monster rather than a lock in the boss arena's
open far corner. Every piece of equipment also has a minimum attribute
requirement now, thematic to what it is (Might for a weapon or a heavy
shield, Grace for a light one, Vitality for body armor, an accessory's
own boosted stat or Focus for an elemental charm) — a tier-2 item
always demands more than its tier-1 counterpart in the same slot, and
the cursed ring carries the single highest requirement of anything, a
last real cost on top of the curse itself. Two
consumables (an Oil Flask, an Antidote) are findable in level 1 — shown
under a mystery name (e.g. "a bubbling amber vial") until actually used
once in combat, per the "discovery, not explanation" principle taken to
its stretch tier. Gear
lands in the shared inventory unequipped — tap the always-visible
"Inventory" button (or press `I`) to open a real inventory screen and
choose who wears what, swapping gear freely between party members.
Consumables are usable mid-fight via the Item action, curing a status or
dealing resistance-adjusted damage — a party without a Mage can still
answer a Fire-weak monster by throwing the flask. A cure item (Antidote,
Bandages, Smelling Salts) is also usable straight from the Inventory
screen while exploring — select it, then tap whichever party member
should drink it — so a status picked up in a fight the party won or
fled doesn't have to wait for the next fight to shake off; a damage
item stays combat-only, since there's nothing to throw it at otherwise.
Defeating a monster or
finding a secret for the first time awards XP, and enough of it levels a
character up (a class-flavored flat HP/Mana bump plus skill points to
spend by hand, shown in the HUD and inventory screen as `Lv2`, etc.).
Inventory, Bestiary, and Options are three full-screen menus, each with
its own always-visible HUD button (top-center: Bestiary/Options, next
to Inventory/Mute up in the corner) so none of them requires opening
another first — and each also shows the same navigation row in its own
header — Save, then every other one of the three, then Close — so any
of them is one tap from any other too. A fourth HUD button, Level Up,
opens Inventory too, but with that character's sheet already switched
into its stat/skill "Level Up" editing mode rather than opening a
separate screen. Save
is a single slot capturing the party,
inventory, current level, and exact position; relaunching the game
offers a "Continue" button on the party-creation screen when a save
exists, skipping straight back into the run. Level Up is where those
skill points actually get spent, on any of the five stats or toward
one side of a class's two-skill fork. Bestiary
opens a codex of every monster type encountered so far (win, lose, or
flee all count), listing its resistances/weaknesses, any status effect
its heavy strike inflicts, whether it heals instead of attacking, and
whether its reach lets it strike the back rank — so a repeat fight can
be won on memory, not luck. A small minimap in
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
— a "🔊"/"🔇" button next to Inventory mutes it all. The
whole Act 1 descent then got a full content pass: every level resized
to a true 10×10 and re-laid-out around its existing puzzle vocabulary
plus a genuinely new one (an unmarked floor-rune sequence, its solve
order readable only from a nearby inscription, wrong guesses resetting
the whole thing), two new monster types drawn straight from the
long-standing "teaching ladder" design doc (a heavier telegraph-only
fight, and the first monster whose reach can hit the back rank), a
trap mechanic that had been speced but never built (invisible until it
fires, a living Rogue disarming it outright, no roll), and four
strictly-stronger tier-2 equipment items woven into the deeper levels
so gear keeps escalating alongside the monsters guarding it. Most
recently, every one of those items — old and new — gained a minimum
attribute requirement to actually put on, thematic to what the item is
(a weapon or a heavy shield wants Might, body armor wants Vitality, an
accessory wants whichever stat it boosts or Focus for a resistance
charm), refused with a plain "isn't ready for it yet" message rather
than stated up front, and scaled the same way the loot itself already
was — a tier-2 item always demands more than its tier-1 counterpart in
the same slot, and the one cursed ring in the game carries the single
highest requirement of anything. A player report that a failed equip
attempt "doesn't tell me why" turned up a real bug: the HUD's message
line had no stacking order of its own, so it painted silently *behind*
whichever full-screen menu happened to be open — Inventory included,
which is exactly where an equip attempt happens. A follow-up report on
that fix itself ("the help text writes over the inventory if there are
too many items... or the screen is too small vertically") caught the
first cut's own overcorrection: raising the whole HUD to fix the
message dragged its permanent, ever-present text (the control hints,
the carried-item line) up with it, now permanently overlapping the
inventory screen's own content instead. The real fix only elevates the
HUD, and hides everything in it except the message itself, while a
menu screen is actually open — synced every frame, so exploration is
completely unaffected either way. Most recently, the character sheet's
own stat numbers learned the same "only once identified" rule
everything else on that screen already follows: a stat an equipped
item actually boosts now shows its real, current total — base plus
every identified item's contribution — in a highlighted color the
instant it's equipped, not the flat base number the sheet always used
to show regardless of what was worn. An unidentified item's bonus
still applies in a fight the moment it's worn, same as it's always
been, but the number on the sheet only moves once that's actually been
discovered.

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
