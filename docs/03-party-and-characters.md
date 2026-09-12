# Party & Characters

## Party structure

The player controls a **party of 4**, moving and facing as a single unit
on the dungeon grid (one `Player`/party position + facing, per
[04-exploration-and-world.md](04-exploration-and-world.md)). Individual
characters only become separately relevant in combat and on the
character/inventory screens.

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

Class design (specific abilities, numbers) is a
[Phase 3](08-roadmap-phases.md#phase-3--character-depth--equipment)
concern — Phases 0–2 can hardcode 1-2 placeholder classes to get combat
working before the full roster is built out.

## Leveling

- XP awarded for combat victories and for first-time discovery of secrets
  (rewards exploration, not just grinding fights).
- Level-up grants a flat HP/Mana increase plus stat points to allocate,
  and unlocks class abilities at fixed levels (no skill tree in v1 — a
  fixed per-class progression table, expandable later).
- No level cap defined yet; tune once Act 1 content exists to pace against.

## Party creation vs. pre-generated

To avoid blocking early combat/UI work on a full character creator:

- **Phases 0–2**: party is hardcoded (4 pre-built characters, one per
  class), no creation UI.
- **Phase 3+**: a minimal creation/naming screen — pick a class and a
  portrait per slot, assign a name. Full attribute-point-buy creation is
  a stretch goal, not required for v1.

## Death & recovery

- A character reduced to 0 HP is **downed**, not permanently dead —
  removed from turn order, can be revived by a Cleric ability or an
  item.
- A full party wipe (all 4 downed) ends the run and reloads from the last
  save. Permadeath is a possible optional difficulty toggle for later,
  not a default.
