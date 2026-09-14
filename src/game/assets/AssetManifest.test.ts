import { describe, expect, it } from "vitest";
import { ALL_STATUS_EFFECT_TYPES } from "../combat/StatusEffect";
import { CONSUMABLE_ITEMS } from "../combat/Consumable";
import { ALL_MONSTER_TYPE_IDS } from "../monster/bestiary";
import { ALL_CLASS_IDS } from "../party/Character";
import { EQUIPMENT_ITEMS } from "../party/Equipment";
import { SKILLS } from "../party/Skills";
import { ASSET_MANIFEST, type AssetLink } from "./AssetManifest";

/**
 * The "deterministically find if any are missing" test a player asked
 * for: `AssetManifest.ts` is the single source of truth for every real
 * art/VFX asset the game will need, and which game entity each one
 * belongs to. This file checks the crossref in both directions —
 * every link in the manifest actually resolves to something real
 * (catches a typo'd or stale id in the manifest itself), and every
 * real skill/monster/class/item/status effect has at least one asset
 * covering it (catches new game content shipping with nothing added to
 * the manifest for it) — plus a few basic data-integrity checks on the
 * manifest's own shape.
 */

function allSkillIds(): string[] {
  return Object.values(SKILLS)
    .flat()
    .map((skill) => skill.id);
}

const KNOWN_COMBAT_ACTION_IDS = ["attack", "defend", "flee", "monster-attack", "monster-hit"];

function linksOfKind<K extends AssetLink["kind"]>(kind: K): Array<Extract<AssetLink, { kind: K }>> {
  return Object.values(ASSET_MANIFEST)
    .flatMap((spec) => spec.links)
    .filter((link): link is Extract<AssetLink, { kind: K }> => link.kind === kind);
}

describe("AssetManifest's own shape", () => {
  it("every entry's own id matches the key it's filed under", () => {
    for (const [key, spec] of Object.entries(ASSET_MANIFEST)) {
      expect(spec.id, key).toBe(key);
    }
  });

  it("every entry has a non-empty name and description, and at least one link", () => {
    for (const spec of Object.values(ASSET_MANIFEST)) {
      expect(spec.name.length, spec.id).toBeGreaterThan(0);
      expect(spec.description.length, spec.id).toBeGreaterThan(0);
      expect(spec.links.length, spec.id).toBeGreaterThan(0);
    }
  });

  it("placeholderNotes is only set on a procedural entry -- a \"needed\" asset has nothing standing in for it by definition", () => {
    for (const spec of Object.values(ASSET_MANIFEST)) {
      if (spec.status === "needed") {
        expect(spec.placeholderNotes, spec.id).toBeUndefined();
      }
    }
  });
});

describe("every link in the manifest resolves to a real game entity (no stale/typo'd ids)", () => {
  it("skill links", () => {
    const real = new Set(allSkillIds());
    for (const link of linksOfKind("skill")) {
      expect(real.has(link.id), `skill "${link.id}"`).toBe(true);
    }
  });

  it("monster links", () => {
    for (const link of linksOfKind("monster")) {
      expect(ALL_MONSTER_TYPE_IDS, `monster "${link.id}"`).toContain(link.id);
    }
  });

  it("class-portrait links", () => {
    for (const link of linksOfKind("class-portrait")) {
      expect(ALL_CLASS_IDS, `class "${link.id}"`).toContain(link.id);
    }
  });

  it("equipment links", () => {
    for (const link of linksOfKind("equipment")) {
      expect(EQUIPMENT_ITEMS[link.id], `equipment "${link.id}"`).toBeDefined();
    }
  });

  it("consumable links", () => {
    for (const link of linksOfKind("consumable")) {
      expect(CONSUMABLE_ITEMS[link.id], `consumable "${link.id}"`).toBeDefined();
    }
  });

  it("status-effect links", () => {
    for (const link of linksOfKind("status-effect")) {
      expect(ALL_STATUS_EFFECT_TYPES, `status effect "${link.id}"`).toContain(link.id);
    }
  });

  it("combat-action links", () => {
    for (const link of linksOfKind("combat-action")) {
      expect(KNOWN_COMBAT_ACTION_IDS, `combat action "${link.id}"`).toContain(link.id);
    }
  });
});

describe("every real game entity has at least one asset covering it", () => {
  it("every skill", () => {
    const linked = new Set(linksOfKind("skill").map((link) => link.id));
    for (const id of allSkillIds()) {
      expect(linked.has(id), id).toBe(true);
    }
  });

  it("every monster type", () => {
    const linked = new Set(linksOfKind("monster").map((link) => link.id));
    for (const id of ALL_MONSTER_TYPE_IDS) {
      expect(linked.has(id), id).toBe(true);
    }
  });

  it("every class (a portrait)", () => {
    const linked = new Set(linksOfKind("class-portrait").map((link) => link.id));
    for (const id of ALL_CLASS_IDS) {
      expect(linked.has(id), id).toBe(true);
    }
  });

  it("every equipment item (an icon)", () => {
    const linked = new Set(linksOfKind("equipment").map((link) => link.id));
    for (const id of Object.keys(EQUIPMENT_ITEMS)) {
      expect(linked.has(id), id).toBe(true);
    }
  });

  it("every consumable (an icon)", () => {
    const linked = new Set(linksOfKind("consumable").map((link) => link.id));
    for (const id of Object.keys(CONSUMABLE_ITEMS)) {
      expect(linked.has(id), id).toBe(true);
    }
  });

  it("every status effect type (an icon)", () => {
    const linked = new Set(linksOfKind("status-effect").map((link) => link.id));
    for (const id of ALL_STATUS_EFFECT_TYPES) {
      expect(linked.has(id), id).toBe(true);
    }
  });
});
