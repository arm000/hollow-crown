# Combat System (as built)

This is the exact, current mechanical reference for combat — every
number, formula, and rule as `CombatEngine.ts` actually implements it
today. [05-combat.md](05-combat.md) is the *design* doc: it explains why
combat works this way and was written phase-by-phase as the system was
still being built, so it's deliberately light on exact numbers
("illustrative, not final content"). This doc is the opposite: it's a
snapshot of what's actually shipped, meant to be kept in sync with the
code (per [docs/README.md](README.md)'s working rule) rather than read
as a plan. For the skill system specifically — what each class can do
and how a build is chosen — see
[13-skill-system.md](13-skill-system.md).

## Where a fight happens

No separate battle scene: the corridor the party was just walking
becomes the battlefield the instant a hostile, alerted monster ends up
adjacent to (or on) the party's tile. `Game.startCombat` snaps the
party to face the monster the moment this happens (`GameLogic.facingToward`),
so a fight never starts with the party staring at a wall while the log
describes something they can't see.

v1 combat is always **one monster at a time** — `CombatEngine` takes a
single `Monster`, not a list. Everything below (targeting, AI,
`healsOnHeavyTurn`) is written against that constraint.

## Turn order (initiative)

At the start of every round — the first one, and again every time a
round's turn order runs out — every living combatant (party members
still standing, plus the monster) rolls:

```
score = initiativeStat + 1d6
```

`initiativeStat` is a character's effective Grace (`effectiveStats.grace`
— base stat plus any equipped gear bonus) or a monster's own fixed
`initiativeStat`. Scores are sorted high to low; that's the round's
fixed turn order, re-rolled fresh every round rather than locked for
the whole fight. The current round's full order, and exactly where play
currently sits in it, is shown live in the combat UI's initiative
tracker (a row of pills above the monster's HP line — dimmed for
whoever's already acted, highlighted for the current turn, struck
through for anyone downed) so the party can see the monster's turn
coming and plan around it, not just react after the fact.

A downed party member is skipped when the order reaches them, but stays
in the roll pool for future rounds in case they're healed back up.
Status-effect damage-over-time and duration countdowns (Bleed, Stun,
Fear, Poison, Silence) tick exactly once per round, at the moment a new
round's order is rolled — never on the very first round of a fight,
so a 1-turn effect applied mid-round doesn't expire before it ever gets
to matter.

## Actions

Whoever's turn it is (only ever a live party member — the monster's
turn(s) resolve automatically, in full, before control ever returns to
the player) picks exactly one of:

| Action | What it does |
| --- | --- |
| **Attack** | `effectiveStats.might + 1d4` Physical damage, resistance-adjusted. Always available, no cost. |
| **Ability** | Casts one of the character's known skills — see [13-skill-system.md](13-skill-system.md) for every skill's exact effect and cost. |
| **Item** | Uses a consumable from the shared party inventory (see [Items in combat](#items-in-combat) below). |
| **Defend** | Halves the damage of the *next* hit this character takes, until their own next turn. No cost, always available. |
| **Flee** | `30 + effectiveStats.resolve × 5` percent chance to end the fight immediately. A failed attempt still consumes the turn. Some classes have a skill that guarantees this instead of rolling it (see the skill doc). |

A character afflicted with **Fear** has every action other than Defend
replaced with a forced Defend — the game log says so, and the turn is
still consumed.

### Targeting & rank

- The monster's melee attack targets **whoever's taunting it** (a
  skill effect — see the skill doc), else the party's living **front
  rank** if anyone's still standing there, else a random living member.
- The party's own Attack/most skills always hit the monster — v1 combat
  is one monster at a time, so there's no target *choice* to make on
  the party's side, only on which action to take.

### Items in combat

Every consumable is either a **cure** (removes one specific status
effect from the user) or a **damage** item (a flat amount of one damage
type, thrown at the monster, resistance-adjusted the same as a spell).
Using an item is also the moment it gets identified — an unidentified
"bubbling amber vial" becomes "an Oil Flask" in every list the instant
it's used once, win or lose. There's no ally-targeting for cure items
yet: they always target whoever uses them.

| Item | Effect |
| --- | --- |
| Antidote | Cures Poison |
| Bandages | Cures Bleed |
| Smelling Salts | Cures Fear |
| Holy Water | 8 Holy damage |
| Oil Flask | 6 Fire damage |

## Damage & resistance math

Every damage number in the game — Attack, every offensive skill, every
damage item, the monster's own hits — passes through the same function:

```
dealt = round(rawDamage × resistanceMultiplier)
```

clamped to never go below 0. `resistanceMultiplier` is looked up from
the target's resistance map for that specific damage type; anything not
listed defaults to `1` (neutral). A multiplier below 1 is a resistance,
above 1 is a weakness — there's no cap on how extreme either can be,
though nothing shipped goes past 2×. The four damage types are
**Physical**, **Fire**, **Blight**, and **Holy** (`Blight` currently has
no in-game source or monster weakness yet — every shipped monster's
resistance map uses only Physical/Fire/Holy).

The party's own damage taken from a monster's melee hit is always
Physical, resistance-adjusted against the *defender's* `effectiveResistances`
(base resistances — empty by default for every character — plus
whatever's granted by equipped gear).

### Defend / Ward halving

Both Defend (self, via the `defending` set) and the Cleric's Ward skill
(cast on an ally, via a *separate* `warded` set — see the skill doc for
why they can't share one) apply the exact same halving:

```
baseDamage = defended ? ceil(monsterDamage / 2) : monsterDamage
```

before that result goes through the resistance formula above. Defend
clears the instant its owner's own next turn starts, whether or not
they were actually hit in between — Ward instead only clears when the
monster's attack actually lands on the warded target (or the fight
ends), so it survives the target acting again in the meantime.

## Status effects

| Effect | What it does | How long | Where it comes from today |
| --- | --- | --- | --- |
| **Bleed** | Damage-over-time, ticked once per round | 2 rounds | Rogue's Precision Strike (on the monster) |
| **Fear** | Every action but Defend is replaced with a forced Defend | 2 rounds (monster sources) | A monster's telegraphed heavy strike (Screeching Wraith, Steward Marrow); cured by Cleanse, Smelling Salts, or Warrior's Rally Cry |
| **Stun** | Skips the afflicted combatant's entire next turn | 1 round | Mage's Frost Lance (on the monster) — the only in-game source; nothing currently stuns a party member |
| **Poison** | Damage-over-time, ticked once per round | Source-defined | Mechanically complete (`StatusEffectSet` handles it identically to Bleed); no monster or skill actually applies it yet — cured by Antidote when it eventually does |
| **Silence** | Blocks the Ability action for a turn (logged, no mana spent) | Source-defined | Mechanically complete; no monster or skill applies it yet |

A monster's own resistance/weakness/status-effect profile, once
encountered (win, lose, or flee all count), is visible from then on in
the in-game Bestiary screen — so a repeat fight can be won on memory,
not luck.

## Monster turns

A monster's turn alternates a lighter hit with a **telegraphed** heavy
one — the lighter hit's own flavor text always warns the heavy one is
coming next, so a player who's never seen the monster before still gets
one full turn's warning before the big hit lands:

```
light damage = might + 1d4
heavy damage = might × 3 + 1d4
```

A heavy turn can instead be a **self-heal** (`healsOnHeavyTurn`, e.g.
the Court Alchemist) — no target, no damage, just restores the monster's
own HP, making "burst it down before the heal comes around" the actual
answer rather than more damage output alone. A heavy turn can also
carry a **status effect** applied to whoever it hits (`heavyStatusEffect`
— the Screeching Wraith's and Steward Marrow's Fear). A stunned monster
skips its turn entirely instead of acting.

### The current monster roster

| Monster | HP | Might | Initiative | Resistances | Signature mechanic | XP |
| --- | --- | --- | --- | --- | --- | --- |
| Rot-thing | 18 | 3 | 3 | none | Baseline — front/back rank, Attack/Defend fundamentals | 15 |
| Cinder Wretch | 20 | 4 | 4 | Physical ×0.5, Fire ×2 | Melee alone goes badly; Firebolt/Precision Strike/Oil Flask all answer it | 25 |
| Screeching Wraith | 16 | 2 | 6 | none | Heavy strike inflicts Fear | 22 |
| Court Alchemist | 22 | 3 | 4 | none | Heals itself for 9 instead of attacking on its heavy turn | 25 |
| Steward Marrow (Act 1 boss) | 40 | 5 | 5 | Physical ×0.6, Holy ×1.5 | Combines the Rot-thing's telegraph, the Wraith's Fear, and a resistance profile — Holy Water or Cleric's Smite are the repeatable answers | 50 |

## HP, Mana, and leveling

- Starting stats/HP/Mana are fixed per class (`roster.ts`), tuned around
  each class's rank and role — e.g. Warrior starts at 30 HP/0 Mana,
  Mage at 14 HP/20 Mana.
- XP needed to reach the next level is `level × 20` (linear, no curve
  tuned yet — there's no level cap).
- Every level-up grants a flat, class-flavored HP/Mana increase
  automatically (Warriors gain more HP, Mages/Clerics gain Mana) *and*
  3 skill points the player spends by hand — see
  [13-skill-system.md](13-skill-system.md) for exactly what those points
  can buy and why. XP comes from defeating a monster (`xpReward` above)
  or finding a secret for the first time (a flat 15).

## Ending a fight

- **Victory**: the monster's HP hits 0. The party gains its `xpReward`,
  applying every level-up that triggers.
- **Defeat**: every party member is downed. Freezes input and shows the
  defeat screen — there's no revive/retry system in v1.
- **Fled**: an ordinary Flee roll succeeds, or a skill (Rogue's Smoke
  Bomb) guarantees it outright. The monster disengages — clears its
  alert state and starts a 5-world-turn cooldown
  (`Monster.disengageCooldown`) during which it ignores the party's
  proximity entirely and just resumes patrolling, even standing right
  next to them. That cooldown is what actually makes a flee work: a
  flee never relocates the party, so without it the monster (still
  trivially within its own detection radius at distance 1) would
  re-notice and `GameLogic.advanceWorldTurn`'s plain adjacency check
  would re-trigger combat on literally the very next action, of any
  kind — a real bug a player found ("the monster just re-engages into
  combat again"), fixed in
  [08-roadmap-phases.md](08-roadmap-phases.md#phase-7--post-v1-enhancements)
  Phase 7.
