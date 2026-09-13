import { describe, expect, it } from "vitest";
import { createParty, createStartingParty, DEFAULT_PARTY_SPEC } from "./roster";

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
