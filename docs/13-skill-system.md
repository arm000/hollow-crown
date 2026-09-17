# Skill System (as built)

The exact, current reference for how skills and skill points work —
what each class can learn, what each skill actually does, and how a
build is chosen. Companion to [12-combat-system.md](12-combat-system.md)
(the general combat rules every skill plays inside of) and
[03-party-and-characters.md](03-party-and-characters.md#leveling) (the
original design ask this system fulfills). Code lives in
`party/Skills.ts` (data, cooldowns included), `party/Character.ts` (a
character's own points/known-skill/cooldown state), `GameLogic.ts`
(spending rules), and `combat/CombatEngine.ts` (what each skill
actually does in a fight, and where its cooldown is checked and
started).

## The shape of the system

Every class has **two build forks, not one** — a tier-1 fork chosen at
character creation, and a tier-2 fork chosen later via leveling. Both
use the exact same rule: choosing either side *permanently rules out
the other* for that character, for the rest of the run — there's no
respec, ever, on either fork.

**Tier 1**, chosen on `PartyCreationUI` (name/class/portrait, plus this
— see [03-party-and-characters.md](03-party-and-characters.md#party-creation-vs-pre-generated)),
is free (no skill-point cost) and known from the moment the character
exists: an offense-leaning option vs. a defense/utility-leaning one.
Only the player's own created character gets this choice — a recruited
companion (`RescueEncounter`) and anything built via
`roster.createStartingParty` always default to the class's original
tier-1 option (`defaultSkillId`, index 0 of that class's `SkillDef[]`),
same as before this fork existed.

**Tier 2** is the original level-up fork. Leveling up grants **skill
points** (3 per level, uniform across every class) that the player
spends by hand, via the **Level Up** button on a character's sheet
(the Inventory screen's `editMode`, reachable directly from exploration
via the always-visible Level Up HUD button, or by tapping "Level Up"
from any character's sheet already open), on either:

- **+1 to a stat.** Every point raised on Vitality or Focus also nudges
  max HP/Mana respectively (+3 each) — those two stats' whole job is
  driving those maximums, so a point spent there is never a dead
  choice. Might/Grace stay exactly what they've always been: read
  straight from `effectiveStats` wherever combat math needs them.
- **Unlocking the tier-2 skill**, at a flat cost of 8 points.

The character sheet shows whichever side of *either* fork you didn't
pick as **"unavailable (chose the other one)"** — tier-1's alternative
included, even though there was never a skill-point cost to intercept
there — so both forks stay visible, not a surprise, and there's no
live "Unlock" button sitting on an option creation already ruled out.

A character therefore ever knows **at most two skills at once**: the
tier-1 skill chosen at creation, and whichever tier-2 fork they chose
(if they've saved up the points for it yet). `CombatEngine` enforces
the same boundary a second way — even a stale or malformed skill id is
checked against `Character.knowsSkill` before it can do anything, and
a skill id that doesn't belong to the acting character's class is
refused outright.

## Every class, both forks

Each skill is written to answer something the class's kit genuinely
lacked — the same "every ability answers something specific" principle
[03-party-and-characters.md](03-party-and-characters.md#classes) sets
for the game's whole ability design, applied twice per class now
instead of once: a tier-1 offense-vs-defense/utility choice made at
creation, and the original tier-2 fork made later via leveling. Within
a class, the tier-1 utility option and the tier-2 non-damage option are
deliberately *not* the same power level as their offense-leaning
counterparts (Feint vs. Smoke Bomb; Radiant Spark vs. Smite) — a coin-
flip-plus now vs. a certainty or a real damage number later, so
unlocking the tier-2 skill stays worth it even for a character who
started leaning the same direction.

### Warrior — tank / melee damage

| | Tier | Cost | CD | Effect |
| --- | --- | --- | --- | --- |
| **Guard** | 1 (creation) | — | 2 | Draws the monster's next attack onto the Warrior, and halves it. |
| **Power Strike** | 1 (creation) | — | 2 | `round(might × 1.5) + 1d6` Physical damage — no other effect. |
| **Second Wind** | 2 (level-up) | 8 pts | 3 | Heals the Warrior for a third of their own max HP. |
| **Rally Cry** | 2 (level-up) | 8 pts | 3 | Heals the *whole living party* 6 HP each, and clears Fear from everyone. |

**Tier-1 fork:** defense (Guard — halves the next hit and pulls it onto
the Warrior specifically, protecting whoever's behind them) vs. offense
(Power Strike — noticeably harder than a plain Attack, no downside, but
no protective value either). **Tier-2 fork:** sustain solo (Second Wind
— a Warrior who can just keep soaking hits and healing back up between
them) vs. spending a turn on the whole party instead of yourself (Rally
Cry — steadies everyone at once, and is the only skill in the game
other than Cleanse/Smelling Salts that clears Fear).

### Rogue — skirmisher / utility

| | Tier | Cost | CD | Effect |
| --- | --- | --- | --- | --- |
| **Precision Strike** | 1 (creation) | — | 2 | `might + 1d4 + 2` damage, ignoring the monster's resistance entirely, and applies Bleed. |
| **Feint** | 1 (creation) | — | 2 | Immediately attempts to flee at `30 + resolve×5 + 25`% — a real chance, not a guarantee. |
| **Smoke Bomb** | 2 (level-up) | 8 pts | 3 | Guarantees the party escapes this fight immediately — no roll. |
| **Ambush** | 2 (level-up) | 8 pts | 3 | `might + 1d6` damage, **+8 more** if the monster hasn't taken any damage yet this fight. |

**Tier-1 fork:** offense (Precision Strike — resistance-piercing plus
Bleed) vs. a taste of the escape identity Smoke Bomb later perfects
(Feint — a much better than average flee chance, available immediately,
but still a roll). **Tier-2 fork:** a guaranteed way out (Smoke Bomb —
turns "this fight is unwinnable" from a chance into a certainty) vs. a
much harder opening hit that rewards striking first (Ambush — the bonus
only applies while the monster is still at full HP, so it's
specifically an alpha-strike tool). A Feint Rogue who later unlocks
Smoke Bomb gets a real escape *progression*, not a flat upgrade — a
coin-flip-plus at creation, a certainty once it's paid for.

### Mage — offense caster

| | Tier | Cost | CD | Effect |
| --- | --- | --- | --- | --- |
| **Firebolt** | 1 (creation) | 6 mana | 2 | `focus + 1d6` Fire damage. |
| **Arcane Barrier** | 1 (creation) | 4 mana | 2 | Shields the Mage's *own* next hit (halved, like Defend) — without spending a later turn on it. |
| **Frost Lance** | 2 (level-up) | 8 pts, 8 mana | 3 | `ceil(focus / 2) + 1d3` Physical damage, and **stuns the monster** for its next turn. |
| **Cinder Nova** | 2 (level-up) | 8 pts, 10 mana | 3 | `round(focus × 1.5) + 1d8` Fire damage — no other effect. |

**Tier-1 fork:** offense (Firebolt) vs. self-defense (Arcane Barrier —
the same halving mechanism Cleric's Ward uses on an ally, reused here
self-only, for a Mage who'd rather survive a hit than not throw one).
**Tier-2 fork:** control (Frost Lance — clearly less raw damage than
Firebolt, but skipping the monster's next turn outright, including a
telegraphed heavy strike, is the first actual in-game source for Stun)
vs. pure burst (Cinder Nova — meaningfully harder-hitting than Firebolt,
at a real mana-cost premium, with nothing but the damage number).

### Cleric — support caster

| | Tier | Cost | CD | Effect |
| --- | --- | --- | --- | --- |
| **Cleanse** | 1 (creation) | 5 mana | 2 | Removes every negative status effect from whichever living ally has the most active. |
| **Radiant Spark** | 1 (creation) | 4 mana | 2 | `ceil(focus / 2) + 1d4` Holy damage — weaker than Smite. |
| **Smite** | 2 (level-up) | 8 pts, 6 mana | 3 | `focus + 1d4` Holy damage. |
| **Ward** | 2 (level-up) | 8 pts, 4 mana | 3 | Shields whichever living ally is proportionally lowest on HP from their next hit (halved, like Defend) — without spending *their* turn on it. |

**Tier-1 fork:** utility (Cleanse — no damage at all) vs. a first, if
modest, taste of offense (Radiant Spark — deliberately weaker than
Smite, so unlocking Smite later stays a real upgrade rather than a
sidegrade). **Tier-2 fork:** offense (Smite — Cleric's strongest damage
output, and a second, repeatable answer to Steward Marrow's Holy
weakness alongside the single-use Holy Water pickup) vs. protection
(Ward — keeps a squishy ally like the Mage alive through a telegraphed
heavy hit without costing that ally a turn of their own, which Defend
can't do since it only ever protects whoever casts it).

## Cooldowns

Every skill (`CD` in the tables above) has to sit out a number of
rounds after it's cast before it can be used again — tier 1 sits out 2
rounds, tier 2 sits out 3, mana-gated or not (see
[the history below](#why-this-exists) for why a mana cost alone wasn't
enough). Both sides of every fork share the same cooldown, so a build
choice is always about the *effect*, never about which option recharges
faster.

Ticks down by one at the start of every round (the same round boundary
Bleed/Fear/Stun durations already use), regardless of whether its owner
actually acted that round — there's no way to "save up" cooldown
reduction by Defending instead. Attempting a skill that's still
recharging fails outright (the turn is still consumed, same as trying
an unaffordable spell) and the combat log says how many rounds are
left. There is deliberately no cooldown on Attack/Defend/Flee: with
every skill on a timer, those three stay the reliable fallback while
one recharges, instead of every fight boiling down to "spam the one
best skill" — which is exactly what prompted this system (see below).

Cooldowns aren't reset between fights, or by a save/reload — a skill
cast right before a fight ends still shows time left on it at the start
of the next one, and (docs/11-testing-strategy.md's usual "not chased"
scope for save-scumming) simply resetting via reload is an accepted
gap, not a tracked bug, the same stance v1 already takes on saves
elsewhere.

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
two-alternative-skills-per-fork design (what's now the *tier-2* fork)
is the answer: every class had a genuine decision to make once it was
time to spend those 8 points, not just a foregone conclusion.

A third round asked for a character creation screen where "the user can
assign attribute points and pick a starting skill." The attribute
points are `PartyCreationUI`'s new allocator (see
[03-party-and-characters.md](03-party-and-characters.md#party-creation-vs-pre-generated)).
For "a starting skill" to be a real pick rather than a rubber stamp on
the class's already-fixed signature move, every class needed a *second*
tier-1 option to choose against — the tier-1 fork this doc's tables
show today, built the same "everything answers something specific" way
the tier-2 fork was, rather than as four interchangeable reskins.

That second tier-1 option is what exposed the next gap: a player
pointed directly at Power Strike — "strictly better than a regular
attack, so why wouldn't a Warrior use it every turn?" — and the same
was quietly true of Precision Strike since Phase 3, and really of any
0-mana skill with no built-in drawback at all. Cooldowns are the
answer, applied to every skill uniformly rather than patched onto just
the offenders, so the fix reads as a real combat mechanic instead of a
one-off nerf. One implementation trap worth naming since it actually
shipped once here before a test caught it: a cooldown of exactly 1 has
*no effect at all* in a turn-based engine where each character only
acts once per round — the character's own next possible attempt is
already next round, and the cooldown ticks away during that exact
transition. 2 is the smallest cooldown that does anything.

## What doesn't scale with anything

Worth naming directly, since it's not obvious from the tables above:
**Grace** only decides turn order (`initiativeStat`), never skill
power, on any class. It's a real, intentional stat with mechanical
weight elsewhere in combat, but not a "skill" lever in the sense this
doc covers. **Resolve** used to be in the same boat — it only touched
the ordinary Flee action's success chance — but Rogue's Feint changed
that: Feint's own flee-attempt chance is `30 + resolve×5 + 25`, so
Resolve now does scale one skill, on one class. Might and Focus remain
the two stats that scale the most skill numbers (Power Strike/Precision
Strike/Ambush on Might; Firebolt/Frost Lance/Cinder Nova/Radiant
Spark/Smite on Focus) — Arcane Barrier and Ward are the two skills tied
to no stat at all, a fixed halving regardless of who casts them.
