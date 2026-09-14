# Skill System (as built)

The exact, current reference for how skills and skill points work —
what each class can learn, what each skill actually does, and how a
build is chosen. Companion to [12-combat-system.md](12-combat-system.md)
(the general combat rules every skill plays inside of) and
[03-party-and-characters.md](03-party-and-characters.md#leveling) (the
original design ask this system fulfills). Code lives in
`party/Skills.ts` (data), `party/Character.ts` (a character's own
points/known-skill state), `GameLogic.ts` (spending rules), and
`combat/CombatEngine.ts` (what each skill actually does in a fight).

## The shape of the system

Every character knows **one skill from the moment they're created** —
their class's signature move, free, no unlock step. Leveling up grants
**skill points** (3 per level, uniform across every class) that the
player spends by hand, on a new **Level Up** screen (reachable directly
from exploration, or from any of the other menu screens), on either:

- **+1 to a stat.** Every point raised on Vitality or Focus also nudges
  max HP/Mana respectively (+3 each) — those two stats' whole job is
  driving those maximums, so a point spent there is never a dead
  choice. Might/Grace/Resolve stay exactly what they've always been:
  read straight from `effectiveStats` wherever combat math needs them.
- **Unlocking a skill**, at a flat cost of 8 points.

That second option is where the actual build choice lives: **each
class has exactly two alternative second skills, not one.** Choosing
either one *permanently rules out the other* for that character, for
the rest of the run — there's no respec. This is deliberate: a single
"unlock or don't" skill isn't really a choice (see
[the history below](#why-this-exists)), but two skills that pull a
class in genuinely different directions is. The Level Up screen shows
the option you didn't pick as **"unavailable (chose the other one)"**
once you've committed, so the fork is always visible, not a surprise.

A character therefore ever knows **at most two skills at once**: the
free tier-1 skill, and whichever tier-2 fork they chose (if they've
saved up the points for it yet). `CombatEngine` enforces the same
boundary a second way — even a stale or malformed skill id is checked
against `Character.knowsSkill` before it can do anything, and a skill
id that doesn't belong to the acting character's class is refused
outright.

## Every class, both forks

Each fork is written to answer something the class's kit genuinely
lacked — the same "every ability answers something specific" principle
[03-party-and-characters.md](03-party-and-characters.md#classes) sets
for the game's whole ability design, just applied twice per class now
instead of once.

### Warrior — tank / melee damage

| | Tier | Cost | Effect |
| --- | --- | --- | --- |
| **Guard** | 1 (free) | — | Draws the monster's next attack onto the Warrior, and halves it. |
| **Second Wind** | 2 | 8 pts | Heals the Warrior for a third of their own max HP. |
| **Rally Cry** | 2 | 8 pts | Heals the *whole living party* 6 HP each, and clears Fear from everyone. |

**The build fork:** sustain solo (Second Wind — a Warrior who can just
keep soaking hits and healing back up between them) vs. spending a turn
on the whole party instead of yourself (Rally Cry — steadies everyone
at once, and is the only skill in the game other than Cleanse/Smelling
Salts that clears Fear). A Warrior built around Second Wind reads as a
pure damage sponge; one built around Rally Cry reads as an off-support
anchor the rest of the party leans on.

### Rogue — skirmisher / utility

| | Tier | Cost | Effect |
| --- | --- | --- | --- |
| **Precision Strike** | 1 (free) | — | `might + 1d4 + 2` damage, ignoring the monster's resistance entirely, and applies Bleed. |
| **Smoke Bomb** | 2 | 8 pts | Guarantees the party escapes this fight immediately — no roll. |
| **Ambush** | 2 | 8 pts | `might + 1d6` damage, **+8 more** if the monster hasn't taken any damage yet this fight. |

**The build fork:** a guaranteed way out (Smoke Bomb — turns "this fight
is unwinnable" from a Resolve-scaled coin flip into a certainty) vs. a
much harder opening hit that rewards striking first (Ambush — the bonus
only applies while the monster is still at full HP, so it's specifically
an alpha-strike tool, not a general damage boost). A Smoke Bomb Rogue
is the party's safety net; an Ambush Rogue is the party's opener.

### Mage — offense caster

| | Tier | Cost | Effect |
| --- | --- | --- | --- |
| **Firebolt** | 1 (free) | 6 mana | `focus + 1d6` Fire damage. |
| **Frost Lance** | 2 | 8 pts, 8 mana | `ceil(focus / 2) + 1d3` Physical damage, and **stuns the monster** for its next turn. |
| **Cinder Nova** | 2 | 8 pts, 10 mana | `round(focus × 1.5) + 1d8` Fire damage — no other effect. |

**The build fork:** control (Frost Lance — clearly less raw damage than
Firebolt, but skipping the monster's next turn outright, including a
telegraphed heavy strike, is the first actual in-game source for Stun)
vs. pure burst (Cinder Nova — meaningfully harder-hitting than Firebolt,
at a real mana-cost premium, with nothing but the damage number). A
Frost Lance Mage plays around denying the monster's turn; a Cinder Nova
Mage plays around ending the fight as fast as possible.

### Cleric — support caster

| | Tier | Cost | Effect |
| --- | --- | --- | --- |
| **Cleanse** | 1 (free) | 5 mana | Removes every negative status effect from whichever living ally has the most active. |
| **Smite** | 2 | 8 pts, 6 mana | `focus + 1d4` Holy damage. |
| **Ward** | 2 | 8 pts, 4 mana | Shields whichever living ally is proportionally lowest on HP from their next hit (halved, like Defend) — without spending *their* turn on it. |

**The build fork:** offense (Smite — Cleric's only source of damage
output at all beyond a plain Attack, and a second, repeatable answer to
Steward Marrow's Holy weakness alongside the single-use Holy Water
pickup) vs. protection (Ward — keeps a squishy ally like the Mage alive
through a telegraphed heavy hit without costing that ally a turn of
their own, which Defend can't do since it only ever protects whoever
casts it). A Smite Cleric contributes real damage every fight; a Ward
Cleric is a dedicated protector who never lands a hit themselves.

## Why this exists

The original design doc ([03-party-and-characters.md](03-party-and-characters.md#leveling))
always asked for "stat points to allocate" on level-up, but the first
implementation shipped a simplification instead — every stat grew on a
fixed table automatically, flagged in the code's own comments as
"revisit once a level-up screen is worth building." That screen didn't
exist yet, so there was nothing to spend a point on.

Once it did, a second round of feedback pushed further: an early
version gave every class exactly one optional second skill — unlock it
or don't, a checklist item, not a choice between anything. A player
pointed out directly that this didn't actually deliver "each class
customized by skill selection with a real impact on gameplay," which is
accurate — there's no build diversity in a single yes/no toggle. The
two-alternative-skills-per-fork design above is the answer: every class
now has a genuine decision to make once it's time to spend those 8
points, not just a foregone conclusion.

## What doesn't scale with anything

Worth naming directly, since it's not obvious from the tables above:
**Resolve** only affects the ordinary Flee action's success chance —
it doesn't touch a single skill, on any class. Grace only decides turn
order (`initiativeStat`), never skill power. Both are real, intentional
stats with mechanical weight elsewhere in combat, but neither is a
"skill" lever in the sense this doc covers — Might and Focus are the
two stats that actually scale a skill's numbers (Precision
Strike/Ambush on Might; Firebolt/Frost Lance/Cinder Nova/Smite on
Focus).
