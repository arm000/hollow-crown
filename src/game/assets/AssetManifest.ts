import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

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
 * The actual data lives in `asset-manifest.yaml`, right next to this
 * file — a second player request, so the inventory itself is a plain,
 * language-neutral structure an external tool (an art tracker, a
 * asset-pipeline script, anything that isn't this TypeScript codebase)
 * can read without going through this module or knowing TypeScript
 * exists. This file's only job is loading that YAML once, at import
 * time, and handing back a typed view of it — every actual asset entry
 * belongs in the `.yaml` file, never here.
 *
 * This file is also deliberately self-contained rather than scattering
 * an `assetId` field across `Skills.ts`/`Equipment.ts`/`Consumable.ts`/
 * `bestiary.ts`/etc. — every one of those stays exactly as it already
 * was, a pure gameplay-data table with zero art-pipeline concerns mixed
 * in. The *linking* lives in the YAML's `links` field instead, pointing
 * at those tables' own ids — so only the YAML needs to change as art
 * actually gets made or new content ships, never gameplay logic.
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
 * table that owns that id, not just against the YAML's own say-so.
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

const MANIFEST_PATH = join(dirname(fileURLToPath(import.meta.url)), "asset-manifest.yaml");

/**
 * Loads and parses `asset-manifest.yaml` once, at import time. Only a
 * light shape check happens here (this is a plain YAML file a human or
 * an external tool can hand-edit, so it's worth catching an obviously
 * malformed file with a clear error rather than a confusing downstream
 * crash) — the real, thorough validation (every link actually
 * resolving to a real game entity, every entity actually covered, ids
 * matching their own keys, ...) is `AssetManifest.test.ts`'s job, not
 * this loader's.
 */
function loadManifest(): Record<string, AssetSpec> {
  const raw = readFileSync(MANIFEST_PATH, "utf-8");
  const parsed = loadYaml(raw);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`asset-manifest.yaml did not parse to an object: ${MANIFEST_PATH}`);
  }
  return parsed as Record<string, AssetSpec>;
}

export const ASSET_MANIFEST: Record<string, AssetSpec> = loadManifest();
