import { describe, expect, it } from "vitest";
import type { ClassId } from "./Character";
import { defaultSkillId, SKILLS } from "./Skills";

const CLASS_IDS: ClassId[] = ["warrior", "rogue", "mage", "cleric"];

describe("Skills data integrity (docs/08-roadmap-phases.md Phase 7)", () => {
  it("every class has exactly one always-known tier-1 skill and two alternative tier-2 skills", () => {
    for (const classId of CLASS_IDS) {
      const skills = SKILLS[classId];
      expect(skills, classId).toHaveLength(3);
      expect(skills[0].unlockCost, `${classId} tier 1`).toBe(0);
      expect(skills[0].exclusiveWith, `${classId} tier 1`).toBeUndefined();
      for (const tier2 of skills.slice(1)) {
        expect(tier2.unlockCost, `${classId} ${tier2.id}`).toBeGreaterThan(0);
        expect(tier2.exclusiveWith, `${classId} ${tier2.id}`).toBeDefined();
      }
    }
  });

  it("every exclusiveWith reference is symmetric and points at a real sibling skill in the same class", () => {
    for (const classId of CLASS_IDS) {
      const skills = SKILLS[classId];
      for (const skill of skills) {
        if (!skill.exclusiveWith) continue;
        const other = skills.find((candidate) => candidate.id === skill.exclusiveWith);
        expect(other, `${classId} ${skill.id} -> ${skill.exclusiveWith}`).toBeDefined();
        expect(other!.exclusiveWith, `${classId} ${skill.id}'s exclusive partner should point back`).toBe(skill.id);
      }
    }
  });

  it("every skill id is unique across the whole roster, and every skill's classId matches where it's filed", () => {
    const seenIds = new Set<string>();
    for (const classId of CLASS_IDS) {
      for (const skill of SKILLS[classId]) {
        expect(seenIds.has(skill.id), skill.id).toBe(false);
        seenIds.add(skill.id);
        expect(skill.classId, skill.id).toBe(classId);
      }
    }
  });

  it("defaultSkillId always names the tier-1 (free) skill", () => {
    for (const classId of CLASS_IDS) {
      expect(defaultSkillId(classId)).toBe(SKILLS[classId][0].id);
    }
  });
});
