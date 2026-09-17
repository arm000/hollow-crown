import { DungeonMap } from "../DungeonMap";
import type { EntitySpawn } from "../interactables/types";
import type { MonsterSpawn } from "../monster/bestiary";
import type { LevelDef } from "./LevelDef";

/**
 * The second level of the descent (docs/08-roadmap-phases.md Phase 4,
 * expanded to a full 10×10 in Phase 8 on a player request that "each
 * dungeon level should be 10x10"): a longer main corridor than level 1,
 * carrying the same key-then-door mandatory gate but now with *two*
 * mandatory fights patrolling it back to back — the Screeching Wraith
 * (Fear, an existing lesson) and the Bound Servant (docs/05-combat.md's
 * telegraph-focused newcomer) — plus two traps along the way, a step up
 * from level 1's single gentle one. The Cinder Wretch (moved here from
 * level 1, docs/08-roadmap-phases.md Phase 8's difficulty-curve pass)
 * guards an optional Ember Charm two tiles down a side spur — deep
 * enough to sit outside combat's adjacency trigger from the mandatory
 * corridor, so the fight stays genuinely skippable rather than
 * "optional" in name only — matching its long-running "finding the
 * counter-item means passing the exact monster it answers" design.
 *
 * The showcase content is the rune-sequence spur (docs/08-roadmap-phases.md
 * Phase 8's "innovative puzzle"): a lore item spells out the solve
 * order for three unmarked floor sigils in plain language, and treading
 * them in that order unlocks a bonus door guarding the first tier-2
 * armor in the game, a Steel Cuirass. Getting the order wrong resets
 * the whole sequence (see `SequenceRune.ts`) — costless to retry, but
 * enough of a tax that skipping the lore item and just guessing isn't
 * the fast path.
 */
export const LEVEL_2_MAP = new DungeonMap([
  "##########",
  "#S.......#",
  "###.#..###",
  "#####...##",
  "####...###",
  "#####.####",
  "#####.####",
  "#####.####",
  "##########",
  "##########",
]);

export const LEVEL_2_ENTITIES: EntitySpawn[] = [
  {
    type: "trap",
    x: 2,
    z: 1,
    params: {
      damageType: "physical",
      amount: 5,
      message: "A spring-loaded dart snaps out of the floor seam!",
    },
  },
  {
    type: "trap",
    x: 4,
    z: 1,
    params: {
      damageType: "blight",
      amount: 3,
      message: "A fine dart, its tip crusted dark, grazes past!",
      statusEffect: { type: "poison", turnsRemaining: 3, tickDamage: 2 },
    },
  },

  // Right at the entrance, unmissable -- the difficulty curve's first
  // real gear reward (docs/08-roadmap-phases.md Phase 4's "tuned by
  // hand"): a small Grace boost that helps against the Wraith's Fear
  // (higher initiative, more chances to act before it does) waiting
  // just ahead.
  { type: "equipmentItem", x: 3, z: 1, params: { itemId: "old-buckler" } },
  { type: "keyItem", x: 3, z: 2, params: { itemId: "iron-key", name: "an Iron Key" } },

  { type: "door", x: 7, z: 1, params: { keyId: "iron-key", locked: true } },
  { type: "stairsDown", x: 8, z: 1, params: { targetLevelId: "level-3" } },

  {
    type: "rescue",
    x: 5,
    z: 3,
    params: {
      line: "Someone's rigged a rough shelter out of broken crates against the cold. They stiffen when you approach, then recognize a fellow prisoner rather than a warder.",
    },
  },

  {
    type: "loreItem",
    x: 5,
    z: 2,
    params: {
      text: "A cracked votive tablet: '...the sun-sigil to the east, the hound-sigil to the west, the hearth-sigil to the south — honor the sun first, then the hound, then let the hearth close the rite.'",
    },
  },
  { type: "sequenceRune", x: 6, z: 4, params: { sequenceId: "level2-vault", order: 0, doorX: 5, doorZ: 6 } }, // the "sun" sigil, east
  { type: "sequenceRune", x: 4, z: 4, params: { sequenceId: "level2-vault", order: 1, doorX: 5, doorZ: 6 } }, // the "hound" sigil, west
  { type: "sequenceRune", x: 5, z: 5, params: { sequenceId: "level2-vault", order: 2, doorX: 5, doorZ: 6 } }, // the "hearth" sigil, south
  { type: "door", x: 5, z: 6, params: { locked: true } },
  { type: "equipmentItem", x: 5, z: 7, params: { itemId: "steel-cuirass" } },

  { type: "equipmentItem", x: 7, z: 3, params: { itemId: "ember-charm" } },
];

export const LEVEL_2_MONSTERS: MonsterSpawn[] = [
  {
    type: "screechingWraith",
    x: 3,
    z: 1,
    patrolPoints: [
      { x: 2, z: 1 },
      { x: 4, z: 1 },
    ],
  },
  {
    type: "boundServant",
    x: 6,
    z: 1,
    patrolPoints: [
      { x: 5, z: 1 },
      { x: 7, z: 1 },
    ],
  },
  // Two tiles deep, not one -- (7, 3) sits at Manhattan distance 2 from
  // every tile on the mandatory corridor, outside combat's own distance
  // <= 1 trigger (`GameLogic.advanceWorldTurn`), so this fight stays
  // genuinely optional (a player only meets it by choosing to detour for
  // the Ember Charm) the same way level 1's own Cinder Wretch never sat
  // adjacent to its main corridor either. A one-tile-deep spur here
  // would put the monster right next to the mandatory door and make the
  // "optional" fight unavoidable in practice, regardless of what its
  // patrol points say. See `DifficultyCurve.test.ts`'s mandatory-XP
  // accounting, which depends on this staying true.
  {
    type: "cinderWretch",
    x: 7,
    z: 3,
    patrolPoints: [{ x: 7, z: 3 }],
  },
];

export const LEVEL_2: LevelDef = {
  id: "level-2",
  name: "The Sunken Wards — Deeper Cellars",
  introMessage: "The air changes below the wards proper. Less lived-in. Less a home, more a holding cell.",
  dungeon: LEVEL_2_MAP,
  entities: LEVEL_2_ENTITIES,
  monsters: LEVEL_2_MONSTERS,
};
