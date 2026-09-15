import { describe, expect, it } from "vitest";
import { ALL_CLASS_IDS } from "./Character";
import {
  createCharacterFromSpec,
  createParty,
  createStartingParty,
  DEFAULT_PARTY_SPEC,
  pickAvailablePortrait,
  PORTRAIT_OPTIONS,
  recruitableCompanions,
} from "./roster";

describe("createStartingParty", () => {
  it("still produces the Phase 2 defaults (Bram/Ysolde/Corvin/Maren, one per class)", () => {
    const party = createStartingParty();
    expect(party.members.map((m) => m.name)).toEqual(["Bram", "Ysolde", "Corvin", "Maren"]);
    expect(party.members.map((m) => m.classId)).toEqual(["warrior", "rogue", "mage", "cleric"]);
  });
});

describe("createParty", () => {
  it("builds a character per spec, using that class's base stat block and rank", () => {
    const party = createParty([{ name: "Test", classId: "mage", portrait: "🔵" }]);
    const mage = party.members[0];
    expect(mage.rank).toBe("back");
    expect(mage.maxMana).toBeGreaterThan(0); // Mages have mana, unlike Warriors/Rogues
    expect(mage.portrait).toBe("🔵");
  });

  it("gives each character its own stats object, even when two slots share a class", () => {
    const party = createParty([
      { name: "First", classId: "warrior", portrait: "🔴" },
      { name: "Second", classId: "warrior", portrait: "🟠" },
    ]);
    const [first, second] = party.members;

    first.stats.might += 100;

    expect(second.stats.might).not.toBe(first.stats.might); // no shared reference bleeding a mutation across characters
  });

  it("matches DEFAULT_PARTY_SPEC one-to-one when passed through directly", () => {
    const party = createParty(DEFAULT_PARTY_SPEC);
    expect(party.members.map((m) => m.name)).toEqual(DEFAULT_PARTY_SPEC.map((s) => s.name));
  });
});

describe("createCharacterFromSpec", () => {
  it("builds the same character createParty would, for reuse by RescueEncounter", () => {
    const spec = { name: "Solo", classId: "cleric" as const, portrait: "🟣" };
    const character = createCharacterFromSpec(spec);
    expect(character.name).toBe("Solo");
    expect(character.classId).toBe("cleric");
    expect(character.rank).toBe("back");
    expect(character.maxMana).toBeGreaterThan(0);
  });
});

describe("recruitableCompanions", () => {
  it("returns the other three classic roster members, in fixed roster order", () => {
    expect(recruitableCompanions("warrior").map((s) => s.name)).toEqual(["Ysolde", "Corvin", "Maren"]);
    expect(recruitableCompanions("mage").map((s) => s.name)).toEqual(["Bram", "Ysolde", "Maren"]);
  });

  it("never includes the starting class itself, for any class", () => {
    for (const classId of ALL_CLASS_IDS) {
      expect(recruitableCompanions(classId).some((s) => s.classId === classId)).toBe(false);
      expect(recruitableCompanions(classId)).toHaveLength(3);
    }
  });
});

describe("pickAvailablePortrait", () => {
  it("returns the preferred portrait when nobody else is wearing it", () => {
    expect(pickAvailablePortrait(["🔵", "🟢"], "🔴")).toBe("🔴");
  });

  it("falls back to a free portrait when the preferred one is already taken", () => {
    const picked = pickAvailablePortrait(["🔴", "🟢"], "🔴");
    expect(picked).not.toBe("🔴");
    expect(PORTRAIT_OPTIONS).toContain(picked);
  });

  it("never returns a portrait already in use, given only one is free", () => {
    const used = PORTRAIT_OPTIONS.slice(0, 5); // every option but the last
    const picked = pickAvailablePortrait(used, used[0]);
    expect(picked).toBe(PORTRAIT_OPTIONS[5]);
  });
});
