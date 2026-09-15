import { describe, expect, it } from "vitest";
import type { ClassId } from "./Character";
import { defaultSkillId, SKILLS } from "./Skills";

const CLASS_IDS: ClassId[] = ["warrior", "rogue", "mage", "cleric"];

describe("Skills data integrity (docs/08-roadmap-phases.md Phase 7)", () => {
  it("every class has exactly two free tier-1 skills (a real choice at creation) and two alternative tier-2 skills", () => {
    for (const classId of CLASS_IDS) {
      const skills = SKILLS[classId];
      expect(skills, classId).toHaveLength(4);
      for (const tier1 of skills.slice(0, 2)) {
        expect(tier1.unlockCost, `${classId} ${tier1.id}`).toBe(0);
        expect(tier1.exclusiveWith, `${classId} ${tier1.id}`).toBeDefined();
      }
      for (const tier2 of skills.slice(2)) {
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

  describe("cooldowns (docs/08-roadmap-phases.md Phase 7 Batch 10)", () => {
    it("every skill's cooldown is at least 2 -- 1 ticks away before a character could ever attempt a repeat, making it indistinguishable from 0", () => {
      for (const classId of CLASS_IDS) {
        for (const skill of SKILLS[classId]) {
          expect(skill.cooldown, `${classId} ${skill.id}`).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it("every tier-1 skill sits at 2 rounds, every tier-2 skill at 3, regardless of mana cost", () => {
      for (const classId of CLASS_IDS) {
        const skills = SKILLS[classId];
        for (const tier1 of skills.slice(0, 2)) {
          expect(tier1.cooldown, `${classId} ${tier1.id}`).toBe(2);
        }
        for (const tier2 of skills.slice(2)) {
          expect(tier2.cooldown, `${classId} ${tier2.id}`).toBe(3);
        }
      }
    });

    it("both sides of every fork share the same cooldown, so the choice is about the effect, not recharge speed", () => {
      for (const classId of CLASS_IDS) {
        for (const skill of SKILLS[classId]) {
          if (!skill.exclusiveWith) continue;
          const sibling = SKILLS[classId].find((candidate) => candidate.id === skill.exclusiveWith)!;
          expect(skill.cooldown, `${classId} ${skill.id} vs. ${sibling.id}`).toBe(sibling.cooldown);
        }
      }
    });
  });
});
