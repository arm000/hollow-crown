import { describe, expect, it } from "vitest";
import { CombatEngine } from "./combat/CombatEngine";
import { DungeonMap } from "./DungeonMap";
import { Inventory } from "./Inventory";
import { createStewardMarrow } from "./monster/bestiary";
import { Character } from "./party/Character";
import { Party } from "./party/Party";
import { Player } from "./Player";
import { SeededRng } from "./Rng";

/**
 * A headless scripted encounter with Steward Marrow, Act 1's boss
 * (docs/08-roadmap-phases.md Phase 5) — proves the fight actually
 * exercises every mechanic it's assembled from
 * (docs/05-combat.md#a-teaching-ladder-illustrative-not-final-content's
 * "everything you've learned, at once"), the same way
 * `CinderWretchEncounter`/`ScreechingWraithEncounter.playthrough.test.ts`
 * prove their one mechanic each: melee alone goes badly against the
 * Physical resistance, Holy Water (the only in-game Holy source right
 * now — there's no Holy spell yet) turns it around, and its telegraphed
 * heavy strike still inflicts Fear.
 */

const OPEN_ROOM = new DungeonMap(["###", "#.#", "###"]);

function newSoloWarrior(): Character {
  // High Vitality on purpose: Marrow hits hard enough (Might 5, a
  // finale boss) that a realistically fragile test character would die
  // to its raw damage output before the "Physical resistance vs. Holy
  // weakness" comparison this fight exists to prove ever gets to play
  // out -- the point here is the damage-type answer, not attrition.
  return new Character("Bram", "warrior", "front", { might: 6, grace: 4, vitality: 12, focus: 1, resolve: 3 }, 100, 0);
}

function newMarrow() {
  return createStewardMarrow(1, 1, [{ x: 1, z: 1 }], OPEN_ROOM, new Player(1, 1, 1, 2, 1));
}

describe("Steward Marrow encounter: the Act 1 boss combines earlier lessons (headless)", () => {
  it("melee alone, halved by Physical resistance, does not go well", () => {
    const warrior = newSoloWarrior();
    const party = new Party([warrior]);
    const monster = newMarrow();
    const engine = new CombatEngine(party, monster, new SeededRng(5));

    let guard = 0;
    while (engine.result === "ongoing" && guard < 40) {
      if (engine.isPartyTurn) engine.submitAction("attack");
      guard++;
    }

    expect(engine.result).not.toBe("victory");
  });

  it("Holy Water turns the exact same fight around, the same way an Oil Flask does against the Cinder Wretch", () => {
    const warrior = newSoloWarrior();
    const party = new Party([warrior]);
    const monster = newMarrow();
    const inventory = new Inventory();
    inventory.add("holy-water", "Holy Water", 10);
    const engine = new CombatEngine(party, monster, new SeededRng(5), inventory); // same seed as the loss above

    let guard = 0;
    while (engine.result === "ongoing" && guard < 60) {
      if (engine.isPartyTurn) engine.submitAction("item", "holy-water");
      guard++;
    }

    expect(engine.result).toBe("victory");
  });

  it("its telegraphed heavy strike still inflicts Fear, exactly as the Screeching Wraith's did", () => {
    const warrior = newSoloWarrior();
    const party = new Party([warrior]);
    const monster = newMarrow();
    const engine = new CombatEngine(party, monster, new SeededRng(5));

    let guard = 0;
    while (engine.result === "ongoing" && guard < 40) {
      if (engine.isPartyTurn) engine.submitAction("attack");
      guard++;
    }

    expect(engine.log.some((line) => line.includes("too afraid to do anything but brace"))).toBe(true);
  });
});
