# Combat

> This doc is the *design* rationale, written phase-by-phase as combat
> was still being built — exact numbers are deliberately left
> "illustrative, not final" throughout. For the real, current formulas
> and numbers, see [12-combat-system.md](12-combat-system.md) (combat)
> and [13-skill-system.md](13-skill-system.md) (skills).

Turn-based, initiative-order combat (Wizardry/Might & Magic lineage),
resolved **in the same first-person viewport as exploration** — no
separate battle scene or camera cut. The corridor you were just walking
becomes the battlefield; a combat UI overlays the same view.

## Triggering combat

- Monsters are entities placed in the level that patrol/idle using the
  same [world-turn](04-exploration-and-world.md#world-turns) tick as
  everything else — they take one action per player action, so their
  movement reads as turn-based too, not real-time.
- A monster that notices the party (simple radius + facing check, no
  vision cones in v1) begins approaching. Combat begins the turn a
  hostile monster and the party end up in the same or an adjacent cell.
- Combat cannot be entered accidentally mid-puzzle — only hostile,
  aware monsters trigger it.

## Initiative

- At the start of each **round**, every combatant (all 4 party members +
  all monsters in the encounter) rolls initiative: `Grace stat + random
  roll`, re-rolled each round rather than fixed for the whole fight. This
  keeps later rounds from being fully predictable without turning combat
  into a reflex test — it's still a discrete, visible-in-advance turn
  order once rolled, per pillar 2.
- Turn order is displayed in the combat UI before the player has to act,
  so choices are informed, not blind.

## Actions

Each combatant gets one action on their turn:

| Action | Notes |
| --- | --- |
| **Attack** | Basic weapon attack; melee can only reach the enemy front rank (unless the weapon has "reach"); ranged/spells can reach any rank |
| **Ability / Spell** | Class-specific, costs Mana or a per-combat use limit; unlocked per the class's level table ([03](03-party-and-characters.md)) |
| **Item** | Use a consumable (potion, thrown item) from the shared inventory |
| **Defend** | Reduces incoming damage this round; simple, always-available fallback action |
| **Flee** | Resolve-based chance to end combat immediately if it succeeds; on failure, the attempt consumes the turn |

## Targeting & rank

- Melee attacks (player or monster) can only target the opposing front
  rank while any front-rank member is still standing.
- Ranged attacks and spells can target any rank, front or back, on
  either side.
- This is the main lever for party-building tactics: a Warrior in front
  absorbs melee targeting so the back-rank Mage/Cleric stay safe, until
  the front rank is downed and the back rank becomes exposed.

## Resolution

- Damage: attacker's relevant stat (Might for melee, Focus for spells,
  Grace for ranged) modified by weapon/spell base value, then scaled by
  the target's resistance/weakness to that attack's
  [damage type](#damage-types) (see the monster design section below —
  this is the actual mechanism behind "every monster is a lesson," not
  just flavor text). Exact formula is a
  [Phase 2](08-roadmap-phases.md#phase-2--party--turn-based-combat)
  implementation detail to tune against real numbers, not fixed here.
- A downed (0 HP) combatant is removed from turn order for the rest of
  the encounter; see [03-party-and-characters.md](03-party-and-characters.md#death--recovery)
  for revival rules.
- Combat ends when one side has no combatants left able to act, or a
  flee succeeds. Victory grants XP and possible item drops; defeat (full
  party downed) ends the run per the death rules.

## Monster design: every type is a lesson

Pillar 3 in [01-vision.md](01-vision.md#pillars): a new monster type has
to earn its place by requiring a genuinely different response, not by
being a reskinned stat block with a bigger multiplier. Concretely, that
means every monster type gets **at least one** of:

- A **resistance or weakness** to a damage type, making the party's
  default plan (whoever's turn it is, hit the thing) actively wrong.
- A **status effect** it inflicts or is vulnerable to, that only certain
  classes/items handle.
- A **signature mechanic** — a telegraphed attack, a positioning trick
  (reach past the front rank, splitting when hit, shielding an ally) —
  that has one specific correct response, not "attack more."

If a new monster doesn't clear that bar, it's not a new monster — it's a
recolor of an existing one, which is fine for set-dressing variety but
shouldn't be counted as roster progress in the roadmap.

### Damage types

Kept to four, not a full elemental wheel — enough to make itemization
and class choice matter without turning the inventory into a spreadsheet:

| Type | Typical source |
| --- | --- |
| **Physical** | Default weapon damage (Warrior, Rogue melee, most weapons) |
| **Fire** | Mage spells, oil/alchemical items |
| **Blight** | Poison/decay damage — thematically the crown's corruption; Rogue poison, some traps |
| **Holy** | Cleric spells, blessed weapons — strong against undead-aligned monsters |

Each monster type defines a resistance and/or a weakness among these
(not both required, and most have just one) — that's the whole point:
knowing a monster's type should change which character or item you lead
with.

### Status effects

| Effect | Does | Typically cured/applied by |
| --- | --- | --- |
| **Poison/Blight (DoT)** | Damage each turn until cured | Applied by Blight sources; cured by Cleric or an Antidote item |
| **Stun** | Skips the target's next turn | Applied by heavy weapons/abilities; wears off after one turn |
| **Bleed (DoT)** | Damage each turn, scales with the bleeding target's Might | Rogue precision attacks; cured by Bandages |
| **Fear** | Resolve check or the target is forced to Defend instead of acting | Applied by horror-type monsters; cured by Cleric or Smelling Salts |
| **Silence** | Blocks the Ability/Spell action for a turn | Applied by specific monsters; wears off after one turn, or cured |

Full item list tying into this table is in
[06-items-and-equipment.md](06-items-and-equipment.md).

### Telegraphing (the "hard but fair" rule)

Difficulty comes from requiring the right answer, not from hiding the
question. Any monster mechanic capable of doing serious damage (a big
hit, an instant status application, anything that can swing a fight in
one action) must be **visibly telegraphed one turn before it resolves**
in the combat UI turn order/log — e.g., "the Bound Servant raises its
mace" before the heavy strike lands next round. A player who has never
seen the monster before should still be able to react correctly to a
telegraphed attack; only *optimizing* the response (knowing the exact
resistance/cure ahead of time) should require having met the monster
before. This is what keeps pillar 2's "hard" from becoming pillar 2's
non-goal, "cheap."

### The bestiary

Once the party has encountered a monster type at least once (win, lose,
or flee), its known damage resistance/weakness, status effects, and
signature mechanic become visible in an in-game codex/bestiary entry —
introduced alongside monster-roster growth in
[Phase 4](08-roadmap-phases.md#phase-4--multi-level-descent--persistence).
The first encounter with any given type is where the "lesson" is
actually taught (via a fair, telegraphed fight); every encounter after
that is where the *skill* pillar 2 promises actually gets exercised —
walking in already knowing the counter and choosing to use it.

### A teaching ladder (illustrative, not final content)

Each entry below is meant to demonstrate the principle, not lock in
final bestiary content — exact monsters are an
[Act](02-setting-and-story.md#structure)-by-Act content decision made
when those levels are actually built. The shape to keep, though: each
new type teaches one specific new thing.

| Monster (example) | New lesson it teaches |
| --- | --- |
| Rot-thing | Baseline: front/back rank targeting, Attack/Defend fundamentals |
| Bound Servant | Heavy telegraphed strike — must Defend or kill it before the charge lands |
| Cinder Wretch | Resistant to Physical, weak to Fire — the fight is wrong without the Mage or a fire item |
| Screeching Wraith | Inflicts Fear — teaches the Resolve stat and the Cleric's cleanse |
| Court Alchemist | A support caster that heals/buffs allies — teaches focus-fire target priority (kill the healer first) |
| Armored Sentinel | Reach weapon hits the back rank — rank alone doesn't guarantee safety, forces a debuff/counter-positioning answer |
| (Act boss) | Combines several of the above mechanics in one fight — the "final exam" for everything taught before it |

## Monster AI (v1 scope)

AI behavior is kept intentionally simple — a small number of legible
behaviors, not a general behavior-tree system — but is always paired
with the design rule above: a behavior tag describes *how a monster
acts*, the resistance/status/mechanic describes *why fighting it is
different*. A monster needs both, not just an AI tag, to count as a new
lesson.

- **Aggressive melee** — closes distance, always attacks the front rank.
- **Cautious ranged** — keeps distance if possible, attacks from range.
- **Support** — prioritizes buffing/healing allied monsters over
  attacking.

[Phase 2](08-roadmap-phases.md#phase-2--party--turn-based-combat) only
needs the first behavior to prove the combat loop end to end — but that
first monster should still ship with a real telegraphed mechanic (see
the Bound Servant example above), not a plain damage sponge, so the
"every monster is a lesson" pillar is true from the first fight rather
than retrofitted later. Ranged/support behaviors, and the
resistance/status variety they're usually paired with, arrive with
monster-roster expansion in
[Phase 4](08-roadmap-phases.md#phase-4--multi-level-descent--persistence).

## Explicit non-goals

- No real-time component to combat at any point (see pillar 2 in
  [01-vision.md](01-vision.md)) — if a fight ever needs a fast reaction
  instead of a considered choice, that's a design bug, not a feature.
- No positioning grid within combat beyond the front/back rank
  abstraction — we are not simulating a tactics-game battle map.
