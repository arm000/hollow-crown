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
    DungeonMesh.ts       builds floor/ceiling/wall geometry for a level
    Level.ts             level 1's entity/monster spawns (key, door, stairs, ...)
    levels/              LevelDef.ts, level2.ts, level3.ts, index.ts (the LEVELS registry)
    Player.ts            grid position, facing, move/turn animation, teleportTo (level transitions)
    InputManager.ts      keyboard/touch -> discrete action queue
    TouchControls.ts     on-screen movement/turn/interact buttons
    Inventory.ts         shared party inventory (id -> name/count)
    Hud.ts               DOM message line, party/inventory status, win/defeat screens
    InventoryUI.ts       DOM overlay: view carried items, equip/unequip gear across the party
    BestiaryUI.ts        DOM overlay: encountered monsters' resistances/status/mechanics
    Lighting.ts          light color/intensity constants — headlessly testable
    Rng.ts               seedable RNG (mulberry32) for testable combat/AI randomness
    WorldClock.ts        one player action -> every registered entity ticks once
    GameLogic.ts         pure move/interact/turn/equip resolution (no rendering) — headlessly testable
    SaveGame.ts          localStorage save/load: serialize/deserialize party+inventory+level+position
    interactables/       Door, Lever, PressurePlate, PushableBlock,
                         SecretWall, ClassGate, StairsDown, KeyItem,
                         LoreItem, ExitTile, EquipmentPickup, InteractableManager
    party/               Character, Party, roster.ts, PartyCreationUI.ts,
                         classes.ts (abilities), Equipment.ts, Leveling.ts
    monster/             Monster (patrol/detection AI + its combat turn),
                         bestiary.ts (monster types + MonsterSpawn/buildMonsters)
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
E2E layer left), Phase 2 complete, Phase 3 complete, Phase 4 in progress
(see the roadmap doc above). Playable now: a one-time party-creation
screen (name each of the four slots, pick a class and a color-swatch
portrait — placeholder art, real pixel art is still ahead — or accept
the defaults to get the original Bram/Ysolde/Corvin/Maren party), then
grid movement (keyboard or touch) through a 3-level descent: level 1's
hand-authored puzzle box (a mandatory key-and-door gate, an optional
lever/plate/block bonus alcove, a secret wall, and a passage that only
opens for a party with a Rogue along), then two smaller, more linear
levels proving the descent mechanic itself — a `StairsDown` tile carries
the party to the next level's own start tile, and only the final level's
exit actually ends the run — with four monster types along the way with
real turn-based combat: a Rot-thing (telegraphed heavy strike), a Cinder
Wretch (resistant to Physical, weak to Fire — melee alone goes badly,
the Mage's Firebolt turns it around), a Screeching Wraith (its heavy
strike inflicts Fear, forcing a Defend next turn — the Resolve stat and
Cleric's Cleanse finally have something to answer), and a Court
Alchemist (heals itself instead of attacking on its telegraphed turn —
burst it down or watch it undo your work). Attack/Defend/Ability/Flee/Item,
status effects (Bleed and Fear are both live now; Poison/Silence are
mechanically real but still await a source), victory/defeat/flee all
handled. Two equipment pickups (a sword, a fire-resisting charm) and two
consumables (an Oil Flask, an Antidote) are findable in the level. Gear
lands in the shared inventory unequipped — tap the always-visible
"Inventory" button (or press `I`) to open a real inventory screen and
choose who wears what, swapping gear freely between party members.
Consumables are usable mid-fight via the Item action, curing a status or
dealing resistance-adjusted damage — a party without a Mage can still
answer a Fire-weak monster by throwing the flask. Defeating a monster or
finding a secret for the first time awards XP, and enough of it levels a
character up (a class-flavored stat/HP/Mana bump, shown in the HUD and
inventory screen as `Lv2`, etc.). The inventory screen's header also has
a "Save" button — a single save slot capturing the party, inventory,
current level, and exact position; relaunching the game offers a
"Continue" button on the party-creation screen when a save exists,
skipping straight back into the run. A "Bestiary" button there too
opens a codex of every monster type encountered so far (win, lose, or
flee all count), listing its resistances/weaknesses, any status effect
its heavy strike inflicts, and whether it heals instead of attacking —
so a repeat fight can be won on memory, not luck. A hand-tuned
difficulty curve is the rest of Phase 4.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build a production bundle to `dist/`
- `npm run preview` — preview the production build locally
- `npm run typecheck` — run the TypeScript compiler without emitting
