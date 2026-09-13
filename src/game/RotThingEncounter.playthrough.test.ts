import { describe, expect, it } from "vitest";
import { CombatEngine } from "./combat/CombatEngine";
import { DungeonMap } from "./DungeonMap";
import { Monster } from "./monster/Monster";
import { Character } from "./party/Character";
import { Party } from "./party/Party";
import { createStartingParty } from "./party/roster";
import { Player } from "./Player";
import { SeededRng } from "./Rng";

/**
 * A headless scripted combat encounter with the Rot-thing — the
 * automated form of Phase 2's "Playable when" gate
 * (docs/08-roadmap-phases.md#phase-2--party--turn-based-combat): the
 * fight is winnable by attacking, and losing it without ever Defending
 * through the telegraphed heavy strike is a fair, avoidable mistake,
 * not bad luck.
 */

const OPEN_ROOM = new DungeonMap(["###", "#.#", "###"]);

function newRotThing(maxHp = 18): Monster {
  return new Monster(
    { name: "Rot-thing", x: 1, z: 1, patrolPoints: [{ x: 1, z: 1 }], detectionRadius: 0, maxHp, might: 3, initiativeStat: 3 },
    OPEN_ROOM,
    new Player(1, 1, 1, 2, 1),
  );
}

describe("Rot-thing encounter (headless)", () => {
  it("the full starting party can defeat it by attacking", () => {
    const party = createStartingParty();
    const monster = newRotThing();
    const engine = new CombatEngine(party, monster, new SeededRng(7));

    let guard = 0;
    while (engine.result === "ongoing" && guard < 100) {
      if (engine.isPartyTurn) engine.submitAction("attack");
      guard++;
    }

    expect(engine.result).toBe("victory");
    expect(party.isDefeated).toBe(false);
  });

  it("never Defending through the telegraphed heavy strike is a fair, avoidable loss", () => {
    // A solo, fragile combatant makes the arithmetic airtight rather than
    // probabilistic: the Rot-thing's un-mitigated light hit (might 3 + a
    // d4, so 4-7) followed by its heavy strike (might x3 + a d4, so
    // 10-13) always sums to more than 14 HP even in the best case for the
    // defender (7 + 10 = 17 > 14) -- so *never* defending is guaranteed
    // to go down within the first two monster turns, regardless of the
    // dice, once the target never mitigates either hit.
    const fragile = new Party([
      new Character("Corvin", "mage", "front", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 14, 20),
    ]);
    const monster = newRotThing(9999); // never dies mid-test; only its attacks matter here
    const engine = new CombatEngine(fragile, monster, new SeededRng(3));

    for (let round = 0; round < 2 && engine.result === "ongoing"; round++) {
      if (engine.isPartyTurn) engine.submitAction("attack"); // never once Defends
    }

    expect(fragile.members[0].isDown).toBe(true);
    expect(engine.result).toBe("defeat");
  });

  it("the same fight is survivable across those same two hits if the target Defends instead", () => {
    const fragile = new Party([
      new Character("Corvin", "mage", "front", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 14, 20),
    ]);
    const monster = newRotThing(9999);
    const engine = new CombatEngine(fragile, monster, new SeededRng(3)); // same seed as the loss above

    for (let round = 0; round < 2 && engine.result === "ongoing"; round++) {
      if (engine.isPartyTurn) engine.submitAction("defend"); // Defends through every hit, including the heavy one
    }

    expect(fragile.members[0].isDown).toBe(false);
    expect(engine.result).toBe("ongoing");
  });
});
