import type { EntitySpawn } from "./interactables/types";
import type { MonsterSpawn } from "./monster/bestiary";

/**
 * Entity placements for `STARTING_LEVEL` (see `DungeonMap.ts`), kept
 * separate from the dungeon grid itself — geometry stays pure tile data,
 * entity spawns are layered on top per docs/07-technical-architecture.md
 * "Level data".
 *
 * The main puzzle: a key sits in a one-tile side room off the main
 * corridor; a locked door further along won't open without it. That's
 * the only mandatory path, so simply reaching the stairs down is proof
 * the puzzle was solved. A dart trap sits early in that same corridor
 * (docs/08-roadmap-phases.md Phase 8) — the gentlest trap in the whole
 * descent, and automatically disarmed outright by a living Rogue (see
 * `Trap.ts`), same as it's always been the class's documented job.
 *
 * Everything else is optional, bypassable content reachable without the
 * key:
 * - A pushable-block spur: pushing the block south lands it on a plate
 *   that remotely arms a bonus door, *and* clears the one tile leading
 *   to a hidden pocket the block itself used to stand on — solving the
 *   puzzle always turns up something the party couldn't have reached
 *   any other way, not just a second route to a door a lever already
 *   opens.
 * - A separate lever, a few columns over, that unlocks that exact same
 *   bonus door on its own — either mechanism alone is enough (a
 *   deliberate simplification; using both can leave them fighting over
 *   one door's lock state, a known, accepted wrinkle here, not a bug to
 *   chase down).
 * - Past that bonus door, a lore item; past that, a secret wall hiding
 *   one more hidden pocket with a second lore item.
 * - Three equipment pickups (docs/08-roadmap-phases.md Phase 3): a
 *   sword in the block spur, a talisman in the block's own hidden
 *   pocket, and a ring behind the class-gated passage described below.
 *   All land in the shared inventory unequipped; who wears what is
 *   chosen via the character sheet.
 * - Two consumables (docs/06-items-and-equipment.md combat-countering
 *   items): an Oil Flask right in the entry corridor, and an Antidote
 *   along the lever spur. Both reuse the generic "keyItem" spawn —
 *   `KeyItem.onEnter` just adds whatever itemId/name it's given to the
 *   inventory. Their *effects* are never named here or in the pickup
 *   message — discovering that is the player's job, per
 *   docs/06-items-and-equipment.md "Discovery, not explanation".
 * - A class-gated passage off the lever room (docs/08-roadmap-phases.md
 *   Phase 3's "non-combat puzzle gated by a class ability"): no key, no
 *   lever, it only opens for a party with a living Rogue along, per
 *   that class's "handles lockpicking... out of combat" job description
 *   in docs/03-party-and-characters.md. Guards one more equipment
 *   pickup, entirely optional and bypassable like everything past the
 *   main corridor.
 * - An NPC encounter and a rescue encounter, each unmissable along one
 *   of the two spurs, per docs/02-setting-and-story.md#how-story-is-delivered.
 *
 * The single Rot-thing patrolling the main corridor (docs/05-combat.md's
 * baseline monster) is the only mandatory fight on this level — level 1
 * is deliberately the easiest rung of the whole descent's ladder; every
 * later level raises the floor from here (see `levels/level2.ts` onward).
 */
export const STARTING_LEVEL_ENTITIES: EntitySpawn[] = [
  {
    type: "trap",
    x: 2,
    z: 1,
    params: {
      damageType: "physical",
      amount: 4,
      message: "A dart springs from a crack in the wall!",
    },
  },

  { type: "keyItem", x: 3, z: 2, params: { itemId: "rusted-key", name: "a Rusted Key" } },
  { type: "keyItem", x: 4, z: 1, params: { itemId: "oil-flask", name: "an Oil Flask" } },

  { type: "door", x: 7, z: 1, params: { keyId: "rusted-key", locked: true } },
  { type: "stairsDown", x: 8, z: 1, params: { targetLevelId: "level-2" } },

  {
    type: "rescue",
    x: 5,
    z: 2,
    params: {
      line: "A figure crouches behind an overturned shelf, more startled than hostile once they see you're no guard.",
    },
  },
  { type: "equipmentItem", x: 5, z: 3, params: { itemId: "rusted-sword" } },
  { type: "pushableBlock", x: 5, z: 4 },
  { type: "pressurePlate", x: 5, z: 5, params: { doorX: 6, doorZ: 5 } },
  // The block's own reward -- only reachable once it's been pushed off
  // (5, 4), the one and only tile leading to it. Regression coverage
  // for a player report that an earlier cut of this puzzle gave nothing
  // back for the trouble beyond a door the lever already opened.
  { type: "equipmentItem", x: 4, z: 4, params: { itemId: "tarnished-talisman" } },

  {
    type: "npc",
    x: 6,
    z: 2,
    params: {
      name: "A Gaunt Steward",
      line: "The masters will be down for supper. They are always almost down for supper.",
    },
  },
  { type: "keyItem", x: 6, z: 3, params: { itemId: "antidote", name: "an Antidote" } },
  { type: "lever", x: 6, z: 4, params: { doorX: 6, doorZ: 5 } },
  { type: "door", x: 6, z: 5, params: { locked: true } },
  {
    type: "loreItem",
    x: 6,
    z: 6,
    params: {
      text: "A page, half-rotted: '...the wards held until the third winter, when even the walls forgot which king they served.'",
    },
  },
  { type: "secretWall", x: 6, z: 7 },
  {
    type: "loreItem",
    x: 6,
    z: 8,
    params: {
      text: "Scratched into the stone, barely legible: 'if you have found this, you were never meant to stop looking.'",
    },
  },

  {
    type: "classGate",
    x: 7,
    z: 4,
    params: {
      requiredClass: "rogue",
      blockedText: "The lock is far too intricate to force open.",
      openText: "{name} makes quick work of the lock — it clicks open.",
    },
  },
  { type: "equipmentItem", x: 8, z: 4, params: { itemId: "shadow-ring" } },
];

/** Monster placements for `STARTING_LEVEL`, kept separate the same way `STARTING_LEVEL_ENTITIES` is — see `monster/bestiary.ts`'s `MonsterSpawn`. */
export const STARTING_LEVEL_MONSTERS: MonsterSpawn[] = [
  {
    type: "rotThing",
    x: 3,
    z: 1,
    patrolPoints: [
      { x: 3, z: 1 },
      { x: 5, z: 1 },
    ],
  },
];
