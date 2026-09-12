# Combat

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
  Grace for ranged) modified by weapon/spell base value, reduced by
  target's armor/resistance. Exact formula is a
  [Phase 2](08-roadmap-phases.md#phase-2--party--turn-based-combat)
  implementation detail to tune against real numbers, not fixed here.
- A downed (0 HP) combatant is removed from turn order for the rest of
  the encounter; see [03-party-and-characters.md](03-party-and-characters.md#death--recovery)
  for revival rules.
- Combat ends when one side has no combatants left able to act, or a
  flee succeeds. Victory grants XP and possible item drops; defeat (full
  party downed) ends the run per the death rules.

## Monster AI (v1 scope)

Kept intentionally simple — a small number of legible behaviors rather
than a general behavior-tree system:

- **Aggressive melee** — closes distance, always attacks the front rank.
- **Cautious ranged** — keeps distance if possible, attacks from range.
- **Support** — prioritizes buffing/healing allied monsters over
  attacking.

[Phase 2](08-roadmap-phases.md#phase-2--party--turn-based-combat) only
needs the first behavior to prove the combat loop end to end; the other
two arrive with monster-roster expansion in
[Phase 4](08-roadmap-phases.md#phase-4--multi-level-descent--persistence).

## Explicit non-goals

- No real-time component to combat at any point (see pillar 2 in
  [01-vision.md](01-vision.md)) — if a fight ever needs a fast reaction
  instead of a considered choice, that's a design bug, not a feature.
- No positioning grid within combat beyond the front/back rank
  abstraction — we are not simulating a tactics-game battle map.
