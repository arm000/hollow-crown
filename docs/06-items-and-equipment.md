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
  utility items (usable as a combat Item action; a cure item is also
  usable from the Inventory screen while exploring, docs/08-roadmap-phases.md
  Phase 7 — a damage item stays combat-only, since there's no monster
  to throw it at otherwise). This is also where a chunk of pillar 3's
  "every monster is a lesson" gets its answer for parties without the
  right class on hand — see
  [Combat-countering consumables](#combat-countering-consumables) below.
- **Key items** — quest-critical, non-droppable, non-sellable (level
  keys, crown fragments, plot tokens).
- **Currency** — deferred until we decide whether a hub/shop exists at
  all (see open question in
  [02-setting-and-story.md](02-setting-and-story.md#open-questions)); no
  currency system in Phases 0–4.

## Discovery, not explanation

**Core principle, not a Phase 5 polish pass: the game never tells the
player what an item does *ahead of time*.** No tooltip stating a
mechanical effect, no "cures Poison" label, no numeric readout on
pickup. An item's true effect is learned by using it and reading the
*consequence* — the combat log narrates what happened ("the bleeding
stops," "the flask bursts into flame on impact") — never by the UI
narrating the item itself ahead of time. This holds from the moment
items exist at all (Phase 1 pickups onward), not just once a full
identification system is built.

**Once that consequence has actually been read at least once, the
principle stops applying** (docs/08-roadmap-phases.md Phase 7, on a
player request that an item's properties, once "activated in combat,"
become learnable "from then on"): a consumable's carried-item entry in
the Inventory screen (`InventoryUI`, reading `Inventory.isIdentified`)
shows its real mechanical effect as plain, always-visible text right
under it — not a hover tooltip, which doesn't exist as a concept on a
touch screen at all (a later player report: "The tooltips don't work
on mobile touch screen because I can't hover over") — but only after
the player has already discovered it firsthand, the same moment the
mystery name itself resolves to the true one. This isn't the UI
explaining the item ahead of the player; it's not making them re-derive
or memorize what the log already told them once, every single time
after.

A later player request extended the exact same rule to equipment:
"I want non consumable inventory items to show their effect once
identified also." Gear has no mystery *name* to resolve — only
consumables ship unidentified (`Inventory.ts`'s `UNIDENTIFIED_NAMES`)
— so "identified" means something narrower there, but still true to
"learned by using it": `InventoryUI` shows
`Equipment.describeEquipmentEffect`'s plain-English rendering of an
item's real `statBonus`/`resistanceBonus`/`cursed` data once
`Inventory.isIdentified` is true — computed from that data directly,
unlike a consumable's hand-written `description`, so it can never
drift from what equipping the item actually does.

That description follows the item wherever it's currently sitting —
its slot row while worn, its `Carried` entry once taken back off —
not just one or the other. The first cut of this only handled
`Carried`, which meant equipping something and never unequipping it
again left its description with nowhere to show up at all (player
report, after using a Rusted Sword: "it's effect still doesn't show" —
a worn item has no `Carried` row left to attach one to).

**Merely equipping something is not the identification moment either**
— a later player report: "The items are showing their effects as soon
as they are equipped. I only want to show the effect of the item once
it has been triggered in combat." Wearing a Rusted Sword doesn't teach
a player it adds Might; landing a hit with it while it does does.
`CombatEngine` is what identifies gear now, the instant its bonus
actually factors into a fight: a `statBonus` the moment it lands a hit
or lands on a caster's spell, a `resistanceBonus` the moment it
actually blocks part of an incoming hit — `GameLogic.equipItem` no
longer identifies anything itself. Grace is the one stat with no
damage number of its own (it only ever affects initiative order,
docs/05-combat.md#initiative) — its gear still identifies, just at the
next initiative roll rather than a hit landing, since there's no
"blocked/bonused" log line for it to piggyback on. The same request
asked for the reverse to be true too: **the combat log now says what
the effect actually was**, not just that gear is equipped somewhere —
"Bram attacks for 7 damage (+2 from a Rusted Sword)" on the dealing
side, "Bram takes 4 damage (3 blocked by Hardened Leather) — 26/30 HP
left" on the taking side, computed by comparing what the hit would
have done with none of the wearer's equipment resistance factored in
against what it actually did, so only equipment's own share of the
mitigation is named (a character's base resistance, if any exists
later, wouldn't be included).

This changes how to read the rest of this document, including the table
below: **every mechanical mapping here is our internal design
vocabulary for building the systems consistently — none of it is text
the player ever sees verbatim in-game.** What the player sees is a name,
maybe a line of flavor text, and the outcome of trying it; what we track
internally, for our own consistency, is the mechanical mapping.

Two levels, cheapest to build first:

1. **Named but unexplained (the default, from whenever items exist).**
   An item's name can be plainly true ("Oil Flask") — we're not hiding
   *identity* — but its description never states its mechanical effect
   or what it counters. A player figures out "this is the thing that
   beats the fire-weak enemy" by trying it, or by piecing it together
   from lore, not by reading it off the item.
2. **Fully unidentified (stretch, still a Phase 5+ decision).** Random
   flavor names per playthrough ("bubbling amber potion") that don't
   reveal even the item's *category* until identified by use, a found
   scroll, or a class skill. This is meaningfully more UI and
   risk-management scope (an unidentified potion might be harmful) —
   worth adding only once level 1 is proven and there's real appetite
   for the extra friction. Cursed gear (can't be unequipped once worn)
   sits at this same stretch tier.

### Combat-countering consumables

Our internal mapping (see above — never shown to the player as such),
tied to the damage types and status effects defined in
[05-combat.md](05-combat.md#monster-design-every-type-is-a-lesson). The
point is that a party missing the "right" class for a given monster can
still solve the fight by carrying the right item, discovered through
play rather than read off a label:

| Item | Counters |
| --- | --- |
| **Antidote** | Cures Poison/Blight |
| **Bandages** | Cures Bleed |
| **Smelling Salts** | Cures Fear |
| **Holy Water** | Bonus Holy damage / cures Silence when thrown at an undead-aligned enemy |
| **Oil Flask** | Converts the next attack's damage to Fire — the item-based answer to a Physical-resistant enemy when there's no Mage in the party |

Exact effects/numbers are a
[Phase 3](08-roadmap-phases.md#phase-3--character-depth--equipment)
concern (this is when the Item combat action and real consumable effects
go live) — this table exists to keep item design and monster design
built from the same vocabulary from the start, not reconciled after the
fact.

## Acquisition

- Found on the ground or in containers while exploring.
- Dropped by defeated monsters.
- No shops/vendors planned for v1 (follows from no currency system
  above) — if that changes, revisit this doc.
