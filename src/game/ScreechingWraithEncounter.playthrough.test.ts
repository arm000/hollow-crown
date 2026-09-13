import { describe, expect, it } from "vitest";
import { CombatEngine } from "./combat/CombatEngine";
import { DungeonMap } from "./DungeonMap";
import { createScreechingWraith } from "./monster/bestiary";
import { Character } from "./party/Character";
import { Party } from "./party/Party";
import { Player } from "./Player";
import { SeededRng } from "./Rng";

/**
 * A headless scripted encounter with the Screeching Wraith — the
 * teaching-ladder entry for Fear (docs/05-combat.md#a-teaching-ladder-illustrative-not-final-content),
 * and Phase 4's "monster roster expansion" ask
 * (docs/08-roadmap-phases.md#phase-4--multi-level-descent--persistence)
 * for a lesson that actually clears the bar, not a stat reskin: proves
 * Fear really does force a Defend on the feared character's very next
 * turn, through a real `CombatEngine` fight, not just the `Monster`
 * unit in isolation (see `Monster.test.ts`/`bestiary.test.ts` for that).
 */

const OPEN_ROOM = new DungeonMap(["###", "#.#", "###"]);

function newFragileCharacter(): Character {
  // Low Might so the fight lasts long enough for the Wraith to actually
  // get to its telegraphed (Fear-inflicting) turn at least once; low
  // Resolve so Fear, once applied, isn't shrugged off before it matters.
  return new Character("Maren", "cleric", "back", { might: 2, grace: 5, vitality: 8, focus: 4, resolve: 2 }, 20, 10);
}

function newWraith() {
  return createScreechingWraith(1, 1, [{ x: 1, z: 1 }], OPEN_ROOM, new Player(1, 1, 1, 2, 1));
}

describe("Screeching Wraith encounter: Fear forces a Defend (headless)", () => {
  it("once feared, the character is forced to brace on their next turn instead of acting", () => {
    const character = newFragileCharacter();
    const party = new Party([character]);
    const monster = newWraith();
    const engine = new CombatEngine(party, monster, new SeededRng(3));

    let guard = 0;
    while (engine.result === "ongoing" && guard < 40) {
      if (engine.isPartyTurn) engine.submitAction("attack"); // always tries to attack -- Fear should override this itself
      guard++;
    }

    expect(engine.log.some((line) => line.includes("too afraid to do anything but brace"))).toBe(true);
  });
});
