# Asset Inventory & the Asset Manifest

Every procedural placeholder in the game — canvas-drawn wall textures,
solid-color monster capsules, emoji portraits, a generic hit-flash —
stands in for a real art or VFX asset that hasn't been made yet. This
doc explains the system that tracks exactly which ones, so that gap
never has to be rediscovered by memory or by grepping the codebase.

**The YAML file is the actual inventory, not this doc.** The single
source of truth is
[`src/game/assets/asset-manifest.yaml`](../src/game/assets/asset-manifest.yaml) —
read that file directly for the current, authoritative, up-to-date list
of every asset, its status, and what it's for. This doc explains the
*system* (why it's shaped this way, how to use it, how to extend it) —
restating the manifest's contents here in prose would just be a second
copy that goes stale the first time someone updates one without the
other, which is exactly the problem a "single source of truth" is
supposed to prevent.

## Why YAML, not a TypeScript data file

The manifest started as a plain TypeScript object literal, but moved to
YAML on request, specifically so tools outside this codebase — an art
tracker, an asset-pipeline script, anything that isn't TypeScript — can
read it without going through this project's build at all: a plain-text
structure any standard YAML library in any language can parse. It's
verified against a *second*, unrelated parser (Python's `pyyaml`, not
just the `js-yaml` this project happens to use) precisely to keep that
claim honest rather than assumed.
[`AssetManifest.ts`](../src/game/assets/AssetManifest.ts) is now just a
thin loader — it reads and parses the YAML once at import time and
hands back a typed view of it for the rest of the TypeScript codebase
(and `AssetManifest.test.ts`) to consume, but it owns none of the
actual data. Edit the `.yaml` file, never the `.ts` one, to change an
entry.

## What's in the manifest

Every entry (`AssetSpec`) has:

- An **id** and a **category** (`environment-tile`, `monster-sprite`,
  `character-portrait`, `item-icon`, `status-effect-icon`, `skill-vfx`).
- A **status**: `"procedural"` (a code-generated placeholder already
  stands in — not blocking, but wants real art eventually) or
  `"needed"` (nothing stands in for it at all, not even a placeholder —
  the actual gaps).
- A **description** of what it's for and, for VFX especially, what it
  should look and feel like — there's no separate design doc for that
  yet, so the manifest entry is where that intent lives.
- One or more **links**, each pointing at the id of a real game entity
  (a `SkillDef`, a `MonsterTypeId`, a `ClassId`, an `EquipmentItem`, a
  `ConsumableItem`, a `StatusEffectType`, or one of a handful of base
  combat actions) — this is the actual "actions/skills that link to art
  assets" half of the system.

## Why the linking lives in one file, not scattered across the game data

`Skills.ts`, `Equipment.ts`, `Consumable.ts`, `bestiary.ts`, and
`StatusEffect.ts` each stay exactly what they already were — pure
gameplay-data tables, with zero art-pipeline concerns mixed in. None of
them gained an `assetId` field. Instead, `asset-manifest.yaml` points
*at* their ids from the outside. Two things fall out of that choice:

- **Only one file changes as art actually gets made.** Flipping a
  `status` from `"needed"` to `"procedural"` (or, eventually, to a real
  loaded asset once there's a pipeline for that) never touches gameplay
  logic.
- **Only one file changes as new content ships.** A new skill, monster,
  or item needs exactly one new `links` entry here — the completeness
  test below is what makes forgetting that loud instead of silent.

## The completeness tests

[`AssetManifest.test.ts`](../src/game/assets/AssetManifest.test.ts)
checks the crossref in both directions, so "deterministically find if
any are missing" is actually true in both senses of "missing":

1. **Every link resolves to something real** — a `links` entry naming
   a skill id that doesn't exist in `SKILLS` (a typo, or a skill that
   got renamed/removed) fails immediately, naming exactly which entry
   and which id.
2. **Every real game entity is covered by at least one asset** — every
   skill, monster type, class, equipment item, consumable, and status
   effect type is walked from its own real data table, and the test
   fails by name if nothing in the manifest links back to it. This is
   the check that actually catches "we shipped a new skill and forgot
   the art manifest entry."

Both directions run automatically in `npm test`, the same as every
other test in the project — there's no separate "check assets" step to
remember to run.

## Adding a new asset

1. Add an entry to `asset-manifest.yaml` (matching the `AssetSpec`
   shape in `AssetManifest.ts`) with a `links` entry pointing at the
   real game entity id it belongs to.
2. Run `npm test`. If the entity already existed and this is its first
   asset entry, `AssetManifest.test.ts`'s "every real game entity is
   covered" check should now pass where it didn't before (for a
   pre-existing gap) or stay passing (for new content shipped in the
   same change as its manifest entry).

## Adding a new game entity (a skill, monster, item, ...)

Add the `asset-manifest.yaml` entry in the same change.
`AssetManifest.test.ts`'s "every real game entity is covered" checks
will fail, by name, if you don't — that's the whole point of the
system.

## What "procedural" actually means per category

- **Environment tiles** — `Textures.ts` draws these on an offscreen
  canvas (seeded jitter, mortar lines, moss flecks), matching the real
  32×32 px spec in
  [10-visual-style-guide.md](10-visual-style-guide.md#asset-specs)
  exactly, just code-generated instead of hand-painted.
- **Monster sprites** — `Game.ts`'s `MONSTER_COLORS` map plus a plain
  capsule mesh. No sprite, no billboarding, no animation frames — real
  art here is a bigger jump than the other procedural categories, not
  a straightforward "swap the fill color for a texture."
- **Character portraits** — `roster.ts`'s `PORTRAIT_OPTIONS`, a
  player-chosen color-swatch emoji, not class-specific art at all.
- **The two generic combat VFX** (`vfx-monster-attack`,
  `vfx-monster-hit-reaction`) — `MonsterAnimator.ts`'s lunge/punch-flash,
  pure mesh transform + material property, no particles or sprites.
- **Every one of the twelve skill-specific VFX entries** — `Game.ts`'s
  `SKILL_VFX` table picks, per skill, one of three placeholder kinds:
  a small colored bolt traveling from the camera to the monster
  (`Projectile.ts`, for the ranged/magic-feeling skills), the same
  hit-punch/flash `vfx-monster-hit-reaction` already used but recolored
  per skill (for close-range skills), or a brief colored tint across
  the whole view (`ScreenFlash.ts`, via `Hud.setScreenFlash`) for a
  skill that targets the caster or the party rather than the monster —
  there's no character mesh to show an effect on in this first-person
  game, so a screen tint stands in. Each skill gets its own color (see
  `SKILL_VFX` for the exact hex values) so two different skills never
  read as visually identical, even sharing a placeholder mechanism.
  Still real gaps versus the actual described intent per entry — a
  "small fire projectile with an impact burst" is, today, a plain
  unlit sphere and a flash, not a burst — the manifest's own
  `placeholderNotes` on each entry say exactly what stands in and what
  doesn't yet.

Everything else — every item icon, every status-effect icon, the base
Attack/Defend/Flee actions' own VFX (distinct from a skill's) — is
still `"needed"`: there's no placeholder standing in for any of them
today, procedural or otherwise.
