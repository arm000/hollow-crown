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
 * the puzzle was solved. As of docs/08-roadmap-phases.md Phase 4, this
 * is level 1 of a multi-level descent — reaching this level's own exit
 * moves on to level 2 rather than ending the run (see `StairsDown`);
 * see `levels/index.ts` for the full descent and where the real,
 * run-ending `ExitTile` now lives.
 *
 * Everything else is optional, bypassable content reachable without the
 * key:
 * - A lever, and separately a pushable-block-and-plate puzzle, both
 *   unlock the *same* bonus door (a deliberate simplification for this
 *   placeholder level — either mechanism alone is enough; using both
 *   can leave them fighting over one door's lock state, which is a
 *   known, accepted wrinkle here, not a bug to chase down).
 * - Beyond that bonus alcove's lore item, a secret wall hides one more
 *   hidden pocket with a second lore item.
 * - Three equipment pickups (docs/08-roadmap-phases.md Phase 3): a
 *   sword in the plate/block spur, a fire-resisting charm in the room
 *   the Cinder Wretch patrols — finding it means passing through the
 *   exact monster its resistance answers — and a ring behind the
 *   class-gated passage described below. All land in the shared
 *   inventory unequipped; who wears what is chosen via the inventory
 *   screen.
 * - Two consumables (docs/06-items-and-equipment.md combat-countering
 *   items): an Oil Flask in the entry corridor, everyone's first pickup,
 *   and an Antidote along the spur toward the lever room. Both reuse the
 *   generic "keyItem" spawn — `KeyItem.onEnter` just adds whatever
 *   itemId/name it's given to the inventory, and `Inventory` now tracks
 *   counts, so it works unmodified for stackable consumables too. Their
 *   *effects* (what CONSUMABLE_ITEMS says an id does) are never named
 *   here or in the pickup message — discovering that is the player's
 *   job, per docs/06-items-and-equipment.md "Discovery, not explanation".
 * - A class-gated passage off the lever room (docs/08-roadmap-phases.md
 *   Phase 3's "non-combat puzzle gated by a class ability"): no key, no
 *   lever, it only opens for a party with a living Rogue along, per
 *   that class's "handles lockpicking... out of combat" job description
 *   in docs/03-party-and-characters.md. Guards one more equipment
 *   pickup, entirely optional and bypassable like everything past the
 *   main corridor.
 * - An NPC encounter (docs/08-roadmap-phases.md Phase 5,
 *   docs/02-setting-and-story.md#how-story-is-delivered): a sparse,
 *   non-hostile figure worth one memorable exchange, unmissable in the
 *   main corridor.
 */
export const STARTING_LEVEL_ENTITIES: EntitySpawn[] = [
  { type: "keyItem", x: 3, z: 2, params: { itemId: "rusted-key", name: "a Rusted Key" } },
  { type: "door", x: 6, z: 1, params: { keyId: "rusted-key", locked: true } },
  { type: "stairsDown", x: 7, z: 1, params: { targetLevelId: "level-2" } },
  {
    type: "npc",
    x: 3,
    z: 1,
    params: {
      name: "A Gaunt Steward",
      line: "The masters will be down for supper. They are always almost down for supper.",
    },
  },

  { type: "equipmentItem", x: 2, z: 3, params: { itemId: "rusted-sword" } },
  { type: "equipmentItem", x: 4, z: 4, params: { itemId: "ember-charm" } },

  { type: "keyItem", x: 2, z: 1, params: { itemId: "oil-flask", name: "an Oil Flask" } },
  { type: "keyItem", x: 5, z: 3, params: { itemId: "antidote", name: "an Antidote" } },

  { type: "lever", x: 5, z: 4, params: { doorX: 6, doorZ: 5 } },
  { type: "door", x: 6, z: 5, params: { locked: true } },
  {
    type: "loreItem",
    x: 6,
    z: 6,
    params: {
      text: "A page, half-rotted: '...the wards held until the third winter, when even the walls forgot which king they served.'",
    },
  },

  { type: "pushableBlock", x: 2, z: 4 },
  { type: "pressurePlate", x: 2, z: 5, params: { doorX: 6, doorZ: 5 } },

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
    x: 8,
    z: 4,
    params: {
      requiredClass: "rogue",
      blockedText: "The lock is far too intricate to force open.",
      openText: "{name} makes quick work of the lock — it clicks open.",
    },
  },
  { type: "equipmentItem", x: 9, z: 4, params: { itemId: "shadow-ring" } },
];

/** Monster placements for `STARTING_LEVEL`, kept separate the same way `STARTING_LEVEL_ENTITIES` is — see `monster/bestiary.ts`'s `MonsterSpawn`. */
export const STARTING_LEVEL_MONSTERS: MonsterSpawn[] = [
  {
    type: "rotThing",
    x: 4,
    z: 1,
    patrolPoints: [
      { x: 4, z: 1 },
      { x: 5, z: 1 },
    ],
  },
  {
    type: "cinderWretch",
    x: 6,
    z: 4,
    patrolPoints: [
      { x: 4, z: 4 },
      { x: 6, z: 4 },
    ],
  },
];
