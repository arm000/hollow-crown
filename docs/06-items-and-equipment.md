# Items & Equipment

## Inventory model

A single **shared party inventory** (not per-character bags) — one list
of item stacks, capacity-limited by a simple slot count rather than a
spatial Tetris-grid (Grimrock's inventory grid is a nice touch but is
pure polish scope; a slotted list is enough to make items and equipment
matter and is far cheaper to build and test). Revisit a spatial grid only
as a post-v1 polish item if it's still wanted.

## Equipment slots

Per character, kept small on purpose:

| Slot | Notes |
| --- | --- |
| **Weapon** | Main-hand; determines attack type (melee/ranged) and base damage |
| **Off-hand** | Shield (defense), a second weapon (dual-wield), or a focus item for casters |
| **Armor** | Single body-armor slot; light/medium/heavy affects Grace-based effects (evasion, initiative) by weight |
| **Accessory** | One ring/amulet-type slot with a stat or resistance bonus |

Additional slots (helmet, boots, gloves) are an explicit stretch item for
later content phases, not v1 — see
[Phase 3](08-roadmap-phases.md#phase-3--character-depth--equipment).

## Item categories

- **Weapons** — dagger, sword, mace, spear (reach), bow, staff (caster
  focus + minor melee).
- **Armor** — light (Rogue/caster-friendly), medium, heavy
  (Warrior-friendly), trading defense for Grace penalties.
- **Consumables** — healing/mana potions, food (only relevant if a
  hunger system is ever added — not currently planned), thrown
  utility items (usable as a combat Item action).
- **Key items** — quest-critical, non-droppable, non-sellable (level
  keys, crown fragments, plot tokens).
- **Currency** — deferred until we decide whether a hub/shop exists at
  all (see open question in
  [02-setting-and-story.md](02-setting-and-story.md#open-questions)); no
  currency system in Phases 0–4.

## Identification & curses

Nice-to-have texture from the genre (unidentified potions, cursed gear
you can't remove) but explicitly **not** in scope before
[Phase 5](08-roadmap-phases.md#phase-5--content--narrative-pass) — it
adds UI and risk-management complexity that doesn't help prove out any
earlier phase's playability gate.

## Acquisition

- Found on the ground or in containers while exploring.
- Dropped by defeated monsters.
- No shops/vendors planned for v1 (follows from no currency system
  above) — if that changes, revisit this doc.
