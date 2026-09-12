# Vision & Pillars

## One-line pitch

A first-person dungeon crawl where you walk a haunted castle's foundations
one careful step at a time, and every fight is a tactical puzzle you solve
in the same breath as the corridor you're standing in.

## Reference points

- **Legend of Grimrock** — grid-locked first-person movement, tile puzzles
  (pressure plates, levers, secret walls), atmosphere carried by lighting
  and sound rather than long cutscenes.
- **Wizardry / Might & Magic / Bard's Tale** — a rolled party of
  distinct classes, turn-based combat with initiative order, front/back
  rank matters.
- **Darkest Dungeon** — tonally (a crumbling, faintly gothic dread rather
  than jump-scare horror), and now mechanically too on one specific
  point: every enemy type should demand you actually know something
  about it, not just outdamage it.

*The Hollow Crown* sits at the intersection: Grimrock's legs, a
Wizardry-blobber's combat brain.

## Pillars

These are the things we protect at every phase. When a feature idea
conflicts with a pillar, the pillar wins.

1. **Every step matters.** Movement is grid-locked and turn-based on
   purpose. There's no twitch skill in walking — the tension comes from
   *deciding* to open a door, not from reflexes.
2. **Combat is a puzzle, not a reflex test — and it's meant to be hard.**
   Turn-based, initiative-order combat means a fight is a set of choices
   you can see coming, but "you can see it coming" doesn't mean "it's
   easy." Difficulty comes from party composition, positioning, resource
   management, and knowing a specific enemy's counter — never from input
   speed, and never from padding out fights with easy filler. A party
   that walks in with the wrong loadout or the wrong tactic should lose,
   fairly.
3. **Every monster is a lesson, not a reskin — and you learn it by
   playing, not by reading a tooltip.** A new monster type earns its
   place by requiring a genuinely different answer — a resistance that
   makes your default attack weak, a status effect only one class can
   cure, a telegraphed attack that punishes not reacting to it — not
   just bigger numbers on the same stat block. And the game never just
   tells you the answer: it never states what an item mechanically does
   either, only its name and the consequence of trying it. Figuring out
   "this is the thing that beats that" is the skill the game is testing.
   See [05-combat.md](05-combat.md#monster-design-every-type-is-a-lesson)
   for monsters and
   [06-items-and-equipment.md](06-items-and-equipment.md#discovery-not-explanation)
   for items — how both are actually built, not just intended.
4. **The dungeon is the character.** Environmental storytelling (ruined
   heraldry, journal pages, the shape of the architecture itself) carries
   the plot. Dialogue and cutscenes are used sparingly.
5. **Small, dense levels over big, empty ones.** A level should reward
   full exploration — a secret, a puzzle, a piece of lore, a resource —
   roughly every screen's worth of corridor. No padding.
6. **Playable beats feature-complete — and verifiable beats "it worked
   when I checked it."** Every phase of development ships something a
   person can actually sit down and finish, *and* an automated way to
   confirm that without a person doing it by hand every time. See
   [08-roadmap-phases.md](08-roadmap-phases.md) for the former,
   [11-testing-strategy.md](11-testing-strategy.md) for the latter.

## Target experience

A session should feel like: *creep down a corridor, hear something ahead,
decide whether to fight or route around it, open the wrong door, regret
it, win the fight anyway because you'd built your party to cover exactly
this situation.*

## Explicit non-goals (for now)

Calling these out so we don't scope-creep into them by accident:

- No multiplayer/co-op.
- No procedurally generated levels — every level is hand-authored. (May
  revisit for replayability post-launch, not before.)
- No open-world/outdoor exploration — the game is entirely
  dungeon/interior spaces.
- No full 3D character creator/customization screen — party members have
  a small number of authored portraits and a name field.
- No real-time combat. If a fight ever needs reflexes instead of
  decisions, that's a bug against pillar 2.
- No cheap difficulty. Hard is good; a mechanic that can wipe or badly
  hurt the party with no prior telegraph is not "hard," it's unfair, and
  is a bug against pillars 2 and 3 — see the telegraphing rule in
  [05-combat.md](05-combat.md#monster-design-every-type-is-a-lesson).
- No photorealistic or painted/high-resolution art direction. The visual
  target is pixel art — see
  [10-visual-style-guide.md](10-visual-style-guide.md) for the actual
  rendering pipeline and asset specs, not just the aspiration.

## Platform & scope

Browser-based, **desktop and mobile both first-class**, single save slot
to start. A solo/small-team hobby-scale project — the roadmap is written
assuming we add breadth (more levels, monsters, classes) only after each
underlying system is proven fun in miniature.

"Playable" — the word every phase gate in
[08-roadmap-phases.md](08-roadmap-phases.md) is built around — means
playable **with touch controls on a phone-sized viewport**, not just with
a keyboard on a desktop browser. This is a platform requirement, not a
stretch goal: it holds from Phase 0 onward, and every new piece of UI
(combat menu, inventory, minimap) has to work for someone with only a
touchscreen and no keyboard/mouse. See
[04-exploration-and-world.md](04-exploration-and-world.md#input--touch-controls)
for the control scheme and
[07-technical-architecture.md](07-technical-architecture.md#input--responsive-ui)
for the implementation approach.
