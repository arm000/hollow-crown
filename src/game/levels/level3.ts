import { DungeonMap } from "../DungeonMap";
import type { EntitySpawn } from "../interactables/types";
import type { MonsterSpawn } from "../monster/bestiary";
import type { LevelDef } from "./LevelDef";

/**
 * The third level of the descent (expanded to a full 10×10 in
 * docs/08-roadmap-phases.md Phase 8, on a player request that "each
 * dungeon level should be 10x10"): a single one-tile-wide corridor with
 * no branch to duck down and no way around any of its three patrols —
 * unlike level 1's Cinder Wretch, which sits in a room the party could
 * choose to avoid entirely, every fight on this level's main corridor is
 * mandatory. The Court Alchemist and Cinder Wretch return from the
 * original cut of this level; the Armored Sentinel (docs/05-combat.md's
 * reach-weapon newcomer) is new, and deliberately the middle fight of
 * the three — everything the party has learned so far, stacked back to
 * back, right before level 4's boss.
 *
 * Two side alcoves break the gauntlet up, both entirely optional: a
 * defensive breather (`hardened-leather`, existing since Phase 3 but
 * first actually placed on Phase 4's difficulty-curve pass) positioned
 * right where the run needs it most, heading into the second mandatory
 * fight already bruised from the first; and a second rune-sequence
 * puzzle (docs/08-roadmap-phases.md Phase 8's "innovative puzzle"),
 * shorter than level 2's three-rune version — two sigils instead of
 * three — guarding the first dual-stat accessory in the game, a Crown
 * Shard Pendant. Also carries a Holy Water pickup, right in the main
 * corridor between the fights (found via Phase 6's automated
 * full-campaign playthrough: `CONSUMABLE_ITEMS`/Steward Marrow's whole
 * design says "weak to Holy, Holy Water is the answer," but nothing in
 * any level ever actually handed the player one — the intended counter
 * to the boss's weakness was unreachable in real play). A stairway down
 * to level 4 (Phase 5's boss arena) replaces what used to be this
 * level's run-ending exit.
 */
export const LEVEL_3_MAP = new DungeonMap([
  "##########",
  "#S.......#",
  "###.##.###",
  "###.#..###",
  "###.##.###",
  "######.###",
  "######.###",
  "##########",
  "##########",
  "##########",
]);

export const LEVEL_3_ENTITIES: EntitySpawn[] = [
  {
    type: "trap",
    x: 2,
    z: 1,
    params: {
      damageType: "physical",
      amount: 6,
      message: "A weighted dart, longer and heavier than any so far, snaps free!",
    },
  },
  {
    type: "trap",
    x: 5,
    z: 1,
    params: {
      damageType: "physical",
      amount: 4,
      message: "A hooked barb rakes past, cold and precise!",
      statusEffect: { type: "bleed", turnsRemaining: 2, tickDamage: 3 },
    },
  },

  { type: "keyItem", x: 4, z: 1, params: { itemId: "holy-water", name: "Holy Water" } },
  { type: "stairsDown", x: 8, z: 1, params: { targetLevelId: "level-4" } },
  {
    type: "npc",
    x: 7,
    z: 1,
    params: {
      name: "An Old Sentry",
      line: "Marrow still walks the far hall. Tell them supper's ready, if you get the chance. Tell them it's been ready a long while.",
    },
  },

  {
    type: "loreItem",
    x: 3,
    z: 2,
    params: {
      text: "Claw marks score the stone at exactly shoulder height. Whatever made them was patient — this alcove wasn't a hiding spot, it was a blind.",
    },
  },
  {
    type: "rescue",
    x: 3,
    z: 3,
    params: {
      line: "Wedged into the alcove past every patrol on this level, someone who's clearly been counting on nobody finding this corridor twice.",
    },
  },
  { type: "equipmentItem", x: 3, z: 4, params: { itemId: "hardened-leather" } },

  {
    type: "loreItem",
    x: 6,
    z: 2,
    params: {
      text: "A shard of the crown itself, or a forgery convincing enough to leave this alcove warded: '...the near ward first, then the deeper one, or the shard salts itself to worthless slag.'",
    },
  },
  { type: "sequenceRune", x: 5, z: 3, params: { sequenceId: "level3-vault", order: 0, doorX: 6, doorZ: 5 } }, // the near ward
  { type: "sequenceRune", x: 6, z: 4, params: { sequenceId: "level3-vault", order: 1, doorX: 6, doorZ: 5 } }, // the deeper ward
  { type: "door", x: 6, z: 5, params: { locked: true } },
  { type: "equipmentItem", x: 6, z: 6, params: { itemId: "crown-shard-pendant" } },
];

export const LEVEL_3_MONSTERS: MonsterSpawn[] = [
  {
    type: "courtAlchemist",
    x: 3,
    z: 1,
    patrolPoints: [
      { x: 2, z: 1 },
      { x: 4, z: 1 },
    ],
  },
  {
    type: "armoredSentinel",
    x: 6,
    z: 1,
    patrolPoints: [
      { x: 5, z: 1 },
      { x: 7, z: 1 },
    ],
  },
  {
    type: "cinderWretch",
    x: 7,
    z: 1,
    patrolPoints: [
      { x: 6, z: 1 },
      { x: 8, z: 1 },
    ],
  },
];

export const LEVEL_3: LevelDef = {
  id: "level-3",
  name: "The Sunken Wards — Old Foundations",
  introMessage: "The foundations groan under six generations of sinking stone. Something down here has been guarding it a long time.",
  dungeon: LEVEL_3_MAP,
  entities: LEVEL_3_ENTITIES,
  monsters: LEVEL_3_MONSTERS,
};
