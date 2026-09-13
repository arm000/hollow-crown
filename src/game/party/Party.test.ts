import { describe, expect, it } from "vitest";
import { Character } from "./Character";
import { Party } from "./Party";

function newMember(name: string, rank: "front" | "back" = "front") {
  return new Character(name, "warrior", rank, { might: 5, grace: 5, vitality: 5, focus: 5, resolve: 5 }, 10, 0);
}

describe("Party", () => {
  it("is not defeated while at least one member is standing", () => {
    const party = new Party([newMember("A"), newMember("B")]);
    party.members[0].takeDamage(999);
    expect(party.isDefeated).toBe(false);
  });

  it("is defeated once every member is down", () => {
    const party = new Party([newMember("A"), newMember("B")]);
    for (const member of party.members) member.takeDamage(999);
    expect(party.isDefeated).toBe(true);
  });

  it("livingMembers excludes downed characters", () => {
    const party = new Party([newMember("A"), newMember("B")]);
    party.members[0].takeDamage(999);
    expect(party.livingMembers().map((m) => m.name)).toEqual(["B"]);
  });

  it("livingFrontRank excludes back-rank and downed characters", () => {
    const party = new Party([newMember("Front1", "front"), newMember("Front2", "front"), newMember("Back", "back")]);
    party.members[0].takeDamage(999); // downs Front1

    expect(party.livingFrontRank().map((m) => m.name)).toEqual(["Front2"]);
  });
});
