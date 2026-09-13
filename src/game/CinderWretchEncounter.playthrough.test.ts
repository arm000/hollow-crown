import { describe, expect, it } from "vitest";
import { CombatEngine } from "./combat/CombatEngine";
import { DungeonMap } from "./DungeonMap";
import { createCinderWretch } from "./monster/bestiary";
import { Character } from "./party/Character";
import { Party } from "./party/Party";
import { Player } from "./Player";
import { SeededRng } from "./Rng";

/**
 * A headless scripted encounter with the Cinder Wretch — the specific
 * automated-verification ask for Phase 3
 * (docs/08-roadmap-phases.md#phase-3--character-depth--equipment):
 * fighting a Physical-resistant, Fire-weak monster with only melee
 * should be a visibly bad time, and switching to Fire should visibly
 * fix it. This is the actual pass/fail proof behind that claim, not
 * just an assertion in prose.
 */

const OPEN_ROOM = new DungeonMap(["###", "#.#", "###"]);

function newSoloMage(): Character {
  // A front-rank Mage on purpose: low Might makes melee-only play out
  // exactly as badly as it should against a monster that halves it, and
  // low Vitality means taking full, unresisted hits back is a real risk
  // -- the fight should visibly go wrong, not just "take a bit longer".
  return new Character("Corvin", "mage", "front", { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, 14, 20);
}

function newCinderWretch() {
  return createCinderWretch(1, 1, [{ x: 1, z: 1 }], OPEN_ROOM, new Player(1, 1, 1, 2, 1));
}

describe("Cinder Wretch encounter: damage type is the actual counter (headless)", () => {
  it("fighting it with melee alone does not go well", () => {
    const mage = newSoloMage();
    const party = new Party([mage]);
    const monster = newCinderWretch();
    const engine = new CombatEngine(party, monster, new SeededRng(10));

    let guard = 0;
    while (engine.result === "ongoing" && guard < 30) {
      if (engine.isPartyTurn) engine.submitAction("attack"); // physical, halved by the Wretch's resistance
      guard++;
    }

    // Halved damage against a fragile, low-Might attacker taking full
    // damage back: this should not be a clean win.
    expect(engine.result).not.toBe("victory");
  });

  it("switching to Firebolt turns the exact same fight around", () => {
    const mage = newSoloMage();
    const party = new Party([mage]);
    const monster = newCinderWretch();
    const engine = new CombatEngine(party, monster, new SeededRng(10)); // same seed as the loss above

    let guard = 0;
    while (engine.result === "ongoing" && guard < 5) {
      if (engine.isPartyTurn) engine.submitAction("ability"); // fire, doubled by the Wretch's weakness
      guard++;
    }

    expect(engine.result).toBe("victory");
    expect(mage.isDown).toBe(false);
  });
});
