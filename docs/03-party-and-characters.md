# Party & Characters

## Party structure

The player controls a party of **up to 4**, moving and facing as a
single unit on the dungeon grid (one `Player`/party position + facing,
per [04-exploration-and-world.md](04-exploration-and-world.md)). A run
starts with just one character, created at the game's opening screen,
and grows toward 4 through mid-run recruitment — see
[Party creation vs. pre-generated](#party-creation-vs-pre-generated)
below. Individual characters only become separately relevant in combat
and on the character/inventory screens.

The party has a fixed **rank**, front and back:

```
[ Front-Left ][ Front-Right ]
[ Back-Left  ][ Back-Right  ]
```

- **Front rank** can be targeted by, and can use, melee attacks.
- **Back rank** is safe from melee (barring a monster/weapon with
  "reach") and is where you want squishy casters.
- Ranks can be swapped between fights (not mid-combat, to start) from the
  party management screen.

## Core stats

Kept deliberately small — five stats, not a full simulationist attribute
list:

| Stat | Drives |
| --- | --- |
| **Might** | Melee damage, carry capacity |
| **Grace** | Initiative order, ranged accuracy, evasion |
| **Vitality** | Max HP |
| **Focus** | Max Mana, spell/ability effect strength |
| **Resolve** | Resistance to debuffs/fear effects, flee chance |

Derived values: **HP** (from Vitality + class/level), **Mana** (from
Focus + class/level, 0 for classes with no spells).

## Classes

Four starting classes, one clear job each — no hybrid/multiclass system
in v1:

| Class | Role | Rank | Signature idea |
| --- | --- | --- | --- |
| **Warrior** | Tank / melee damage | Front | Highest HP, best armor use, an ability that forces enemy attacks onto itself |
| **Rogue** | Skirmisher / utility | Front or back | Bonus damage from the back rank via thrown/ranged weapons, handles lockpicking & trap disarm out of combat |
| **Mage** | Offense caster | Back | Area-effect and single-target damage spells, fragile |
| **Cleric** | Support caster | Back | Healing and buff/debuff spells, some melee competence as a fallback |

This maps directly onto pillar 2 ("combat is a puzzle") — four classes
with non-overlapping jobs means party composition and turn order are
where the tactics live, not raw numbers.

**Ability design principle:** each class's kit should exist to answer
specific entries in the monster design system in
[05-combat.md](05-combat.md#monster-design-every-type-is-a-lesson), not
just deal damage in a different flavor. Concretely (illustrative, not
final numbers): the Mage's fire spell is the answer to a
Physical-resistant enemy; the Cleric's cleanse is the answer to
Fear/Poison/Silence; a Rogue precision attack is the answer to an
enemy that otherwise just eats hits with no counter; the Warrior's
taunt/guard is the answer to a reach attack that would otherwise hit
the back rank. A class with no monster type it's specifically *needed*
for is missing its half of the "every monster is a lesson" pillar.

Class design (specific abilities, numbers) is a
[Phase 3](08-roadmap-phases.md#phase-3--character-depth--equipment)
concern — Phases 0–2 can hardcode 1-2 placeholder classes to get combat
working before the full roster is built out.

## Leveling

- XP awarded for combat victories and for first-time discovery of secrets
  (rewards exploration, not just grinding fights).
- Level-up grants a flat HP/Mana increase (per-class, automatic) plus
  skill points the player spends by hand — either +1 to a stat, or
  toward unlocking one of a class's two alternative second skills. See
  [08-roadmap-phases.md](08-roadmap-phases.md#phase-7--post-v1-enhancements)
  Phase 7 for how this actually shipped (`LevelUpUI.ts`,
  `party/Skills.ts`) — v1 itself shipped the simpler "grows
  automatically" version this section originally asked for, before two
  rounds of post-release player feedback built the real allocation
  screen and then turned its one optional skill into a real fork.
- Three skills per class, not a sprawling tree: each class's original
  signature ability, known from level 1, plus **two** mutually
  exclusive alternatives bought with skill points — choosing one
  permanently rules out the other, a real build decision rather than a
  checklist. Full breakdown of every class's exact skills, and which
  gap each one answers, in
  [13-skill-system.md](13-skill-system.md).
- No level cap defined yet; tune once Act 1 content exists to pace against.

## Party creation vs. pre-generated

To avoid blocking early combat/UI work on a full character creator:

- **Phases 0–2**: party is hardcoded (4 pre-built characters, one per
  class), no creation UI.
- **Phase 3**: a minimal creation/naming screen for all 4 slots at
  once — pick a class and a portrait per slot, assign a name. Full
  attribute-point-buy creation is a stretch goal, not required for v1.
- **Phase 7**: creation shrank to a single slot. The run now starts
  with just the one character built there, and the other three classic
  roster members (Bram/warrior, Ysolde/rogue, Corvin/mage, Maren/cleric
  — whichever three the player didn't just build) are found and
  recruited over the course of the descent instead of chosen up front.

### Recruitment (Phase 7)

`RescueEncounter` (`src/game/interactables/RescueEncounter.ts`) places
one guaranteed, unmissable companion on each of levels 1–3 — a strict
upgrade every time (another class's kit, more HP, no cost), so
interacting *is* the whole offer; there's no accept/decline dialogue
to build a branching-choice UI for, matching this game's existing
"sparse encounter, not a dialogue tree" storytelling shape
([02-setting-and-story.md#how-story-is-delivered](02-setting-and-story.md#how-story-is-delivered)).

Which of the three companions shows up at a given `RescueEncounter`
isn't baked into level data — it's resolved live, the moment the
player interacts, against the starting character's class:
`roster.recruitableCompanions(startingClassId)` returns the other
three classic roster members in a fixed order (warrior, rogue, mage,
cleric, skipping whichever the player picked), and each encounter
recruits the first one not already in the party. That's what lets the
same three level-1/2/3 spawns correctly offer the right three
companions regardless of which class was chosen at creation, with the
three level files needing no knowledge of each other or of the
player's choice.

Accepting every offer grows the party from 1 to 4 by the time it
reaches level 4's boss fight. Declining isn't a real option in the
current design (there's nothing to decline — no cost, no downside),
so the "up to 4" ceiling in practice means "4, unless the player
chooses to skip a rescue tile entirely."

## Death & recovery

- A character reduced to 0 HP is **downed**, not permanently dead —
  removed from turn order, can be revived by a Cleric ability or an
  item.
- A full party wipe (every current member downed, whatever the party's
  size at the time) ends the run and reloads from the last save.
  Permadeath is a possible optional difficulty toggle for later, not a
  default.
