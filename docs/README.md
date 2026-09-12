# The Hollow Crown — Design Docs

This is the living design documentation for *The Hollow Crown*. It's split
into focused documents rather than one giant GDD so each piece can evolve
independently as we build.

| Doc | Covers |
| --- | --- |
| [01-vision.md](01-vision.md) | Pillars, tone, target experience, what we are/aren't building |
| [02-setting-and-story.md](02-setting-and-story.md) | World, lore, narrative arc |
| [03-party-and-characters.md](03-party-and-characters.md) | Party structure, stats, classes, leveling |
| [04-exploration-and-world.md](04-exploration-and-world.md) | Grid movement, interactables, level structure |
| [05-combat.md](05-combat.md) | Turn-based combat rules, initiative, monster AI |
| [06-items-and-equipment.md](06-items-and-equipment.md) | Inventory, gear, consumables |
| [07-technical-architecture.md](07-technical-architecture.md) | Engine, code structure, data formats, save system |
| [08-roadmap-phases.md](08-roadmap-phases.md) | **The phased build plan.** Every phase ends in a playable milestone — read this before starting any phase of work |
| [09-deployment.md](09-deployment.md) | Where and how the game is hosted, and how a deploy happens |
| [10-visual-style-guide.md](10-visual-style-guide.md) | Pixel art direction: rendering pipeline, asset specs, palette, typography |
| [11-testing-strategy.md](11-testing-strategy.md) | How every feature is verified without a human — the automated counterpart to the roadmap's playability gates |

## Working rule

**Every phase in [08-roadmap-phases.md](08-roadmap-phases.md) must produce a
playable build before we move to the next one.** "Playable" means someone
can launch the game and complete a real loop start-to-finish — not just
"the code compiles" or "the feature exists behind a debug flag." If a
phase's scope can't be reduced to something playable, split it further
rather than skip the gate.

**Every phase also needs an automated way to verify that same loop
without a human** — see [11-testing-strategy.md](11-testing-strategy.md).
The two gates are both required and neither substitutes for the other: a
green test suite nobody has played, and a fun playtest with no test
coverage, are both incomplete.

These docs describe the intended shape of the game. Implementation may
reveal that a system needs to change — when that happens, update the doc
in the same change, don't let it drift out of sync with the code.
