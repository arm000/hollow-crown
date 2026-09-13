import { describe, expect, it } from "vitest";
import { CombatEngine } from "./combat/CombatEngine";
import { DungeonMap } from "./DungeonMap";
import { createCourtAlchemist } from "./monster/bestiary";
import { Character } from "./party/Character";
import { Party } from "./party/Party";
import { Player } from "./Player";
import { SeededRng } from "./Rng";

/**
 * A headless scripted encounter with the Court Alchemist — the
 * teaching-ladder entry for "kill the healer first"
 * (docs/05-combat.md#a-teaching-ladder-illustrative-not-final-content).
 * `CombatEngine` only ever fights one monster at a time (see
 * `MonsterOptions.healsOnHeavyTurn`'s doc comment in `monster/Monster.ts`
 * for why), so the single-monster analogue of that lesson is: a slow,
 * grinding fight that lets its heal-turn come around undoes real
 * progress, while actually bursting it down wins cleanly. This proves
 * both halves of that claim with the same monster and the same
 * attacker, differing only in how much damage lands per hit — the
 * automated form of this phase's "visibly bad time / visibly fixed"
 * pattern, same shape as `CinderWretchEncounter.playthrough.test.ts`.
 */

const OPEN_ROOM = new DungeonMap(["###", "#.#", "###"]);

function newAlchemist() {
  return createCourtAlchemist(1, 1, [{ x: 1, z: 1 }], OPEN_ROOM, new Player(1, 1, 1, 2, 1));
}

function newAttacker(might: number): Character {
  return new Character("Bram", "warrior", "front", { might, grace: 4, vitality: 20, focus: 1, resolve: 6 }, 40, 0);
}

describe("Court Alchemist encounter: a healer left standing undoes your work (headless)", () => {
  it("a weak attacker sees its heal-turn actually restore HP mid-fight", () => {
    const attacker = newAttacker(1); // barely scratches it -- plenty of time for a heal turn to land
    const party = new Party([attacker]);
    const monster = newAlchemist();
    const engine = new CombatEngine(party, monster, new SeededRng(2));

    let sawAHeal = false;
    let guard = 0;
    while (engine.result === "ongoing" && guard < 20) {
      if (engine.isPartyTurn) engine.submitAction("attack");
      if (engine.log.some((line) => line.includes("restorative draught"))) sawAHeal = true;
      guard++;
    }

    expect(sawAHeal).toBe(true);
  });

  it("bursting it down before its heal-turn comes around wins without it ever mending", () => {
    const attacker = newAttacker(30); // one hit is nearly lethal on its own
    const party = new Party([attacker]);
    const monster = newAlchemist();
    const engine = new CombatEngine(party, monster, new SeededRng(2)); // same seed as above

    let guard = 0;
    while (engine.result === "ongoing" && guard < 5) {
      if (engine.isPartyTurn) engine.submitAction("attack");
      guard++;
    }

    expect(engine.result).toBe("victory");
    expect(engine.log.some((line) => line.includes("restorative draught"))).toBe(false);
  });
});
