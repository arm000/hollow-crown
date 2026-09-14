/**
 * The single source of truth for every real art/VFX asset the game
 * will eventually need, and what game entity (skill, monster, class,
 * item, status effect, or base combat action) each one visually
 * represents — a player request: "Build a framework such that there is
 * a single source of truth for game assets and actions/skills that
 * link to art assets so that we can deterministically find if any are
 * missing with tests." See `AssetManifest.test.ts` for the completeness
 * checks this actually enables, and
 * [docs/14-asset-inventory.md](../../../docs/14-asset-inventory.md) for
 * the human-readable version of why this exists and how to use it.
 *
 * This file is deliberately self-contained rather than scattering an
 * `assetId` field across `Skills.ts`/`Equipment.ts`/`Consumable.ts`/
 * `bestiary.ts`/etc. — every one of those stays exactly as it already
 * was, a pure gameplay-data table with zero art-pipeline concerns
 * mixed in. The *linking* lives here instead, in `AssetSpec.links`,
 * pointing at those tables' own ids — this module is the only place
 * that needs to change as art actually gets made (flipping a
 * `status`), and the only place that needs to change as new game
 * content ships (adding a new `links` entry), without ever touching
 * gameplay logic to do either.
 */

export type AssetCategory =
  | "environment-tile" // wall/floor/ceiling, per docs/10-visual-style-guide.md#asset-specs
  | "monster-sprite" // billboarded, per-monster sprite sheet (idle/attack/hit/death frames)
  | "character-portrait" // one per class, shown in party creation/HUD/inventory
  | "item-icon" // equipment and consumables both
  | "status-effect-icon" // a small overlay/HUD icon while an effect is active
  | "skill-vfx"; // an animated effect for a skill or a base combat action

export type AssetStatus =
  | "procedural" // a code-generated placeholder already stands in (Textures.ts, MonsterAnimator, MONSTER_COLORS, emoji portraits, ...) -- not blocking, but will eventually want real art
  | "needed"; // nothing stands in for this at all yet, not even a placeholder

/**
 * What real game entity this asset visually represents. `id` is that
 * entity's own real identifier (a `SkillDef.id`, a `MonsterTypeId`, an
 * `EquipmentItem.id`, ...) — never a made-up label — so
 * `AssetManifest.test.ts` can cross-check it against the actual data
 * table that owns that id, not just against this file's own say-so.
 */
export type AssetLink =
  | { kind: "skill"; id: string }
  | { kind: "monster"; id: string }
  | { kind: "class-portrait"; id: string }
  | { kind: "equipment"; id: string }
  | { kind: "consumable"; id: string }
  | { kind: "status-effect"; id: string }
  | { kind: "combat-action"; id: string }
  | { kind: "environment"; id: string };

export interface AssetSpec {
  id: string;
  category: AssetCategory;
  name: string;
  /** What it's for, and — for `status: "needed"` skill VFX especially — what it should actually look/feel like, since there's no other design doc capturing that yet. */
  description: string;
  status: AssetStatus;
  /** Pixel dimensions per docs/10-visual-style-guide.md#asset-specs, where a fixed size applies (most VFX don't have one yet). */
  size?: string;
  /** What currently stands in for this asset, if anything -- almost always only meaningful when `status` is `"procedural"`. */
  placeholderNotes?: string;
  /** Which real game entity/entities this asset belongs to — see `AssetLink`. Usually exactly one; nothing stops two entities sharing a VFX later. */
  links: AssetLink[];
}

const ACT_1_ENV = { kind: "environment", id: "act-1-sunken-wards" } as const;

export const ASSET_MANIFEST: Record<string, AssetSpec> = {
  // ---------------------------------------------------------------
  // Environment tiles (docs/10-visual-style-guide.md#asset-specs) --
  // scoped to Act 1 only, since docs/08-roadmap-phases.md Phase 6
  // decided v1 ships Act 1 alone; Acts 2-4 stay canon but unbuilt, so
  // there's nothing to inventory art for yet.
  // ---------------------------------------------------------------
  "env-sunken-wards-wall": {
    id: "env-sunken-wards-wall",
    category: "environment-tile",
    name: "Sunken Wards wall tile",
    description: "Damp stone/moss corridor wall, per the Act 1 palette direction (damp stone grays and mosses).",
    status: "procedural",
    size: "32×32 px",
    placeholderNotes: "Textures.ts draws this on an offscreen canvas (seeded jitter + mortar lines + moss flecks).",
    links: [ACT_1_ENV],
  },
  "env-sunken-wards-floor": {
    id: "env-sunken-wards-floor",
    category: "environment-tile",
    name: "Sunken Wards floor tile",
    description: "Corridor floor, tiled via RepeatWrapping across the whole level plane.",
    status: "procedural",
    size: "32×32 px",
    placeholderNotes: "Textures.ts, same procedural approach as the wall tile.",
    links: [ACT_1_ENV],
  },
  "env-sunken-wards-ceiling": {
    id: "env-sunken-wards-ceiling",
    category: "environment-tile",
    name: "Sunken Wards ceiling tile",
    description: "Overhead plane, plainer than the wall (no mortar lines per the style guide).",
    status: "procedural",
    size: "32×32 px",
    placeholderNotes: "Textures.ts, same procedural approach, mortarEvery disabled.",
    links: [ACT_1_ENV],
  },

  // ---------------------------------------------------------------
  // Monster sprites (docs/10-visual-style-guide.md#sprites-start-with-single-facing-not-8-directional):
  // one sprite sheet per monster type, billboarded, single-facing.
  // Frame counts per the style guide: idle 2, attack 2-3, hit 1,
  // death 2-3 -- tracked as one manifest entry per monster (the
  // sprite sheet is the real unit of art production), not one per
  // frame.
  // ---------------------------------------------------------------
  "monster-rot-thing": {
    id: "monster-rot-thing",
    category: "monster-sprite",
    name: "Rot-thing",
    description: "Baseline monster, no resistance/weakness — should read as an ordinary shambling threat, nothing exotic.",
    status: "procedural",
    size: "64×64 px/frame",
    placeholderNotes: "Game.ts's buildMonsterMesh: a plain capsule, sickly-green default color (no MONSTER_COLORS entry).",
    links: [{ kind: "monster", id: "rotThing" }],
  },
  "monster-cinder-wretch": {
    id: "monster-cinder-wretch",
    category: "monster-sprite",
    name: "Cinder Wretch",
    description: "Physical-resistant, Fire-weak — warm, ember-toned design should hint at the Fire weakness before a player ever reads its bestiary entry.",
    status: "procedural",
    size: "64×64 px/frame",
    placeholderNotes: "Game.ts's MONSTER_COLORS: a flat warm ember color (0x8a3f2a) on the placeholder capsule.",
    links: [{ kind: "monster", id: "cinderWretch" }],
  },
  "monster-screeching-wraith": {
    id: "monster-screeching-wraith",
    category: "monster-sprite",
    name: "Screeching Wraith",
    description: "Inflicts Fear on its heavy strike — should read as unnatural/ghostly, distinct in silhouette from the more physical monster types.",
    status: "procedural",
    size: "64×64 px/frame",
    placeholderNotes: "Game.ts's MONSTER_COLORS: pale/ghostly (0xd8d8e8) on the placeholder capsule.",
    links: [{ kind: "monster", id: "screechingWraith" }],
  },
  "monster-court-alchemist": {
    id: "monster-court-alchemist",
    category: "monster-sprite",
    name: "Court Alchemist",
    description: "Heals itself instead of attacking on its heavy turn — a support-caster silhouette (robes, a held vial) reads the intent before the first fight teaches it.",
    status: "procedural",
    size: "64×64 px/frame",
    placeholderNotes: "Game.ts's MONSTER_COLORS: a muted violet (0x6a4a7a) on the placeholder capsule.",
    links: [{ kind: "monster", id: "courtAlchemist" }],
  },
  "monster-steward-marrow": {
    id: "monster-steward-marrow",
    category: "monster-sprite",
    name: "Steward Marrow (Act 1 boss)",
    description: "Physical-resistant, Holy-weak, combines the Rot-thing's telegraph and the Wraith's Fear — visually the largest/most detailed sprite in Act 1, a decayed ceremonial steward, per docs/02-setting-and-story.md.",
    status: "procedural",
    size: "64×64 px/frame",
    placeholderNotes: "Game.ts's buildMonsterMesh: no MONSTER_COLORS entry, falls back to the same sickly-green default as the Rot-thing — currently visually indistinguishable from it, which real art needs to fix.",
    links: [{ kind: "monster", id: "stewardMarrow" }],
  },

  // ---------------------------------------------------------------
  // Character portraits (docs/10-visual-style-guide.md#asset-specs)
  // -- one per class, per docs/03-party-and-characters.md's minimal
  // creation screen. The current color-swatch-per-slot customization
  // (roster.ts's PORTRAIT_OPTIONS) is a placeholder for this, not a
  // feature real art necessarily has to preserve.
  // ---------------------------------------------------------------
  "portrait-warrior": {
    id: "portrait-warrior",
    category: "character-portrait",
    name: "Warrior portrait",
    description: "Front-rank tank — armored, sturdy silhouette.",
    status: "procedural",
    size: "48×48 px",
    placeholderNotes: "roster.ts's PORTRAIT_OPTIONS: a plain color-swatch emoji, player-chosen, not class-specific art.",
    links: [{ kind: "class-portrait", id: "warrior" }],
  },
  "portrait-rogue": {
    id: "portrait-rogue",
    category: "character-portrait",
    name: "Rogue portrait",
    description: "Front-or-back skirmisher — leaner silhouette, implies speed/utility over raw armor.",
    status: "procedural",
    size: "48×48 px",
    placeholderNotes: "roster.ts's PORTRAIT_OPTIONS, same as Warrior.",
    links: [{ kind: "class-portrait", id: "rogue" }],
  },
  "portrait-mage": {
    id: "portrait-mage",
    category: "character-portrait",
    name: "Mage portrait",
    description: "Back-rank offense caster — fragile, robed, implies raw offensive power over survivability.",
    status: "procedural",
    size: "48×48 px",
    placeholderNotes: "roster.ts's PORTRAIT_OPTIONS, same as Warrior.",
    links: [{ kind: "class-portrait", id: "mage" }],
  },
  "portrait-cleric": {
    id: "portrait-cleric",
    category: "character-portrait",
    name: "Cleric portrait",
    description: "Back-rank support caster — implies protection/holy imagery, distinct from the Mage's offense-first read.",
    status: "procedural",
    size: "48×48 px",
    placeholderNotes: "roster.ts's PORTRAIT_OPTIONS, same as Warrior.",
    links: [{ kind: "class-portrait", id: "cleric" }],
  },

  // ---------------------------------------------------------------
  // Equipment icons (docs/10-visual-style-guide.md#asset-specs) --
  // no placeholder exists at all today; InventoryUI.ts shows item
  // names as plain text buttons, nothing visual.
  // ---------------------------------------------------------------
  "icon-rusted-sword": {
    id: "icon-rusted-sword",
    category: "item-icon",
    name: "a Rusted Sword (icon)",
    description: "Weapon slot, +Might. A plain, worn blade silhouette.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "equipment", id: "rusted-sword" }],
  },
  "icon-old-buckler": {
    id: "icon-old-buckler",
    category: "item-icon",
    name: "an Old Buckler (icon)",
    description: "Off-hand slot, +Grace. A small round shield.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "equipment", id: "old-buckler" }],
  },
  "icon-hardened-leather": {
    id: "icon-hardened-leather",
    category: "item-icon",
    name: "Hardened Leather (icon)",
    description: "Armor slot, Physical resistance. A studded leather cuirass silhouette.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "equipment", id: "hardened-leather" }],
  },
  "icon-ember-charm": {
    id: "icon-ember-charm",
    category: "item-icon",
    name: "an Ember Charm (icon)",
    description: "Accessory slot, Fire resistance. A small glowing ember/coal pendant.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "equipment", id: "ember-charm" }],
  },
  "icon-shadow-ring": {
    id: "icon-shadow-ring",
    category: "item-icon",
    name: "a Shadow Ring (icon)",
    description: "Accessory slot, +Grace. A plain dark band.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "equipment", id: "shadow-ring" }],
  },
  "icon-ambition-ring": {
    id: "icon-ambition-ring",
    category: "item-icon",
    name: "a Ring of Old Ambition (icon)",
    description: "Accessory slot, +Might, cursed (can't be removed once worn) — should read as tempting/ornate, not obviously dangerous, since the curse is never stated ahead of time.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "equipment", id: "ambition-ring" }],
  },
  "icon-tarnished-talisman": {
    id: "icon-tarnished-talisman",
    category: "item-icon",
    name: "a Tarnished Talisman (icon)",
    description: "Accessory slot, +Focus. A small tarnished pendant.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "equipment", id: "tarnished-talisman" }],
  },
  "icon-antidote": {
    id: "icon-antidote",
    category: "item-icon",
    name: "an Antidote (icon)",
    description: "Cures Poison. A small corked vial, sickly-green contents.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "consumable", id: "antidote" }],
  },
  "icon-bandages": {
    id: "icon-bandages",
    category: "item-icon",
    name: "Bandages (icon)",
    description: "Cures Bleed. A rolled cloth bandage.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "consumable", id: "bandages" }],
  },
  "icon-smelling-salts": {
    id: "icon-smelling-salts",
    category: "item-icon",
    name: "Smelling Salts (icon)",
    description: "Cures Fear. A small stoppered bottle.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "consumable", id: "smelling-salts" }],
  },
  "icon-holy-water": {
    id: "icon-holy-water",
    category: "item-icon",
    name: "Holy Water (icon)",
    description: "8 Holy damage thrown at the monster. A vial with a faint glow/holy sigil.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "consumable", id: "holy-water" }],
  },
  "icon-oil-flask": {
    id: "icon-oil-flask",
    category: "item-icon",
    name: "an Oil Flask (icon)",
    description: "6 Fire damage thrown at the monster. An amber liquid-filled flask.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "consumable", id: "oil-flask" }],
  },

  // ---------------------------------------------------------------
  // Status effect icons -- no placeholder at all today; an active
  // effect is only ever visible as combat-log text and (for Fear) the
  // forced-Defend behavior itself. A small always-visible icon next
  // to an affected combatant is the actual gap.
  // ---------------------------------------------------------------
  "status-icon-poison": {
    id: "status-icon-poison",
    category: "status-effect-icon",
    name: "Poison icon",
    description: "Damage-over-time. A dripping green droplet.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "status-effect", id: "poison" }],
  },
  "status-icon-stun": {
    id: "status-icon-stun",
    category: "status-effect-icon",
    name: "Stun icon",
    description: "Skips the target's next turn. Small circling stars/dizzy marks.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "status-effect", id: "stun" }],
  },
  "status-icon-bleed": {
    id: "status-icon-bleed",
    category: "status-effect-icon",
    name: "Bleed icon",
    description: "Damage-over-time, scales with the bleeding target's Might. A small blood droplet, distinct in color from Poison's.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "status-effect", id: "bleed" }],
  },
  "status-icon-fear": {
    id: "status-icon-fear",
    category: "status-effect-icon",
    name: "Fear icon",
    description: "Forces Defend instead of acting. A small screaming/wide-eyed mask.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "status-effect", id: "fear" }],
  },
  "status-icon-silence": {
    id: "status-icon-silence",
    category: "status-effect-icon",
    name: "Silence icon",
    description: "Blocks the Ability action for a turn. A crossed-out speech bubble.",
    status: "needed",
    size: "16×16 px",
    links: [{ kind: "status-effect", id: "silence" }],
  },

  // ---------------------------------------------------------------
  // Base combat action VFX (docs/12-combat-system.md#actions) -- the
  // three actions every class shares, not skill-specific.
  // ---------------------------------------------------------------
  "vfx-basic-attack": {
    id: "vfx-basic-attack",
    category: "skill-vfx",
    name: "Basic Attack VFX",
    description: "A plain weapon-swing impact — quick, unflashy, the visual baseline every skill's own VFX should read as more elaborate than.",
    status: "needed",
    links: [{ kind: "combat-action", id: "attack" }],
  },
  "vfx-defend": {
    id: "vfx-defend",
    category: "skill-vfx",
    name: "Defend VFX",
    description: "A brace/guard-up cue — reads clearly as \"about to take reduced damage,\" since Defend has no other visual tell right now.",
    status: "needed",
    links: [{ kind: "combat-action", id: "defend" }],
  },
  "vfx-flee": {
    id: "vfx-flee",
    category: "skill-vfx",
    name: "Flee VFX",
    description: "A dash/retreat cue on a successful flee attempt (ordinary or a guaranteed-escape skill) — a smoke-puff or motion-blur exit.",
    status: "needed",
    links: [{ kind: "combat-action", id: "flee" }],
  },
  "vfx-monster-attack": {
    id: "vfx-monster-attack",
    category: "skill-vfx",
    name: "Monster attack lunge",
    description: "The monster's own light/heavy strike landing — currently a pure motion effect (lunge toward the party), no particle/impact flourish.",
    status: "procedural",
    placeholderNotes: "MonsterAnimator.ts's \"attack\" animation kind: a world-space lunge toward the party and back, no material/particle change.",
    links: [{ kind: "combat-action", id: "monster-attack" }],
  },
  "vfx-monster-hit-reaction": {
    id: "vfx-monster-hit-reaction",
    category: "skill-vfx",
    name: "Monster hit reaction",
    description: "The monster reacting to taking damage, from any source — currently a scale punch plus a white emissive flash.",
    status: "procedural",
    placeholderNotes: "MonsterAnimator.ts's \"hit\" animation kind, applied via Game.ts's syncMonsterMesh (mesh.scale + material.emissiveIntensity).",
    links: [{ kind: "combat-action", id: "monster-hit" }],
  },

  // ---------------------------------------------------------------
  // Skill VFX (docs/13-skill-system.md) -- one per skill, all
  // currently invisible beyond the generic monster hit-reaction/
  // attack-lunge above (which don't vary by which skill caused them).
  // ---------------------------------------------------------------
  "vfx-warrior-guard": {
    id: "vfx-warrior-guard",
    category: "skill-vfx",
    name: "Guard VFX",
    description: "Warrior draws the monster's next attack and halves it — a raised-shield flash, or a challenge/taunt shockwave from the Warrior.",
    status: "needed",
    links: [{ kind: "skill", id: "warrior-guard" }],
  },
  "vfx-warrior-secondwind": {
    id: "vfx-warrior-secondwind",
    category: "skill-vfx",
    name: "Second Wind VFX",
    description: "Self-heal — a warm/green sparkle rising off the Warrior.",
    status: "needed",
    links: [{ kind: "skill", id: "warrior-secondWind" }],
  },
  "vfx-warrior-rallycry": {
    id: "vfx-warrior-rallycry",
    category: "skill-vfx",
    name: "Rally Cry VFX",
    description: "Heals the whole party and clears Fear — a radiating shockwave/pulse from the Warrior outward, distinct from Second Wind's self-only sparkle.",
    status: "needed",
    links: [{ kind: "skill", id: "warrior-rallyCry" }],
  },
  "vfx-rogue-precisionstrike": {
    id: "vfx-rogue-precisionstrike",
    category: "skill-vfx",
    name: "Precision Strike VFX",
    description: "Ignores resistance, applies Bleed — a quick red slash/flash on the monster, distinct from a plain attack's impact.",
    status: "needed",
    links: [{ kind: "skill", id: "rogue-precisionStrike" }],
  },
  "vfx-rogue-smokebomb": {
    id: "vfx-rogue-smokebomb",
    category: "skill-vfx",
    name: "Smoke Bomb VFX",
    description: "Guarantees the party escapes — a smoke cloud filling the screen/corridor as combat ends.",
    status: "needed",
    links: [{ kind: "skill", id: "rogue-smokeBomb" }],
  },
  "vfx-rogue-ambush": {
    id: "vfx-rogue-ambush",
    category: "skill-vfx",
    name: "Ambush VFX",
    description: "Bonus damage only while the target is still undamaged — a quick dash/blur into the strike, reading as \"a fleeting opening,\" distinct from Precision Strike's more measured slash.",
    status: "needed",
    links: [{ kind: "skill", id: "rogue-ambush" }],
  },
  "vfx-mage-firebolt": {
    id: "vfx-mage-firebolt",
    category: "skill-vfx",
    name: "Firebolt VFX",
    description: "Fire damage — a small fire projectile from the Mage to the monster, with an impact burst.",
    status: "needed",
    links: [{ kind: "skill", id: "mage-firebolt" }],
  },
  "vfx-mage-frostlance": {
    id: "vfx-mage-frostlance",
    category: "skill-vfx",
    name: "Frost Lance VFX",
    description: "Modest damage plus a guaranteed Stun — an ice-shard projectile, and a frost/ice overlay on the monster while stunned (ties into the status-icon-stun gap above).",
    status: "needed",
    links: [{ kind: "skill", id: "mage-frostLance" }],
  },
  "vfx-mage-cindernova": {
    id: "vfx-mage-cindernova",
    category: "skill-vfx",
    name: "Cinder Nova VFX",
    description: "A much bigger fire hit than Firebolt, no control effect — a larger fire explosion/nova, should read as clearly more intense than Firebolt's projectile.",
    status: "needed",
    links: [{ kind: "skill", id: "mage-cinderNova" }],
  },
  "vfx-cleric-cleanse": {
    id: "vfx-cleric-cleanse",
    category: "skill-vfx",
    name: "Cleanse VFX",
    description: "Removes every negative status effect from an ally — a cleansing light/sparkle wash over the target.",
    status: "needed",
    links: [{ kind: "skill", id: "cleric-cleanse" }],
  },
  "vfx-cleric-smite": {
    id: "vfx-cleric-smite",
    category: "skill-vfx",
    name: "Smite VFX",
    description: "Holy damage, Cleric's first offensive skill — a beam of light striking down onto the monster.",
    status: "needed",
    links: [{ kind: "skill", id: "cleric-smite" }],
  },
  "vfx-cleric-ward": {
    id: "vfx-cleric-ward",
    category: "skill-vfx",
    name: "Ward VFX",
    description: "Shields an ally's next hit without spending their turn — a translucent shield/bubble glimmer on the warded ally, persisting (per CombatEngine's `warded` set) until it's actually consumed by a hit.",
    status: "needed",
    links: [{ kind: "skill", id: "cleric-ward" }],
  },
};
