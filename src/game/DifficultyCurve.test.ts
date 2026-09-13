import { describe, expect, it } from "vitest";
import { DungeonMap } from "./DungeonMap";
import { getLevel, LEVELS } from "./levels";
import { buildMonsters } from "./monster/bestiary";
import { Character } from "./party/Character";
import { gainXp } from "./party/Leveling";
import { Player } from "./Player";

/**
 * A data-driven regression guard for the difficulty curve's XP pacing
 * (docs/08-roadmap-phases.md Phase 4's "a real difficulty curve...
 * tuned by hand", extended in Phase 5 to include the boss level): pins
 * how far a character actually levels up across the full 4-level
 * descent, both for a full clear and for skipping every optional
 * fight/secret, so a future tweak to any one `xpReward` or
 * `xpToNextLevel` can't silently flatten or spike the curve without a
 * test noticing. Doesn't play out real combat (that's what the
 * per-encounter playthrough tests are for) -- just sums the actual XP
 * values `LEVELS`' monsters carry and feeds them through `gainXp`
 * directly.
 */

const DUMMY_MAP = new DungeonMap(["###", "#.#", "###"]);

function monstersOf(levelId: string) {
  return buildMonsters(getLevel(levelId).monsters, DUMMY_MAP, new Player(1, 1, 1, 2, 1));
}

function newTestCharacter(): Character {
  return new Character("Test", "warrior", "front", { might: 5, grace: 5, vitality: 5, focus: 5, resolve: 5 }, 20, 0);
}

describe("descent XP pacing", () => {
  it("a full clear (every monster defeated, level 1's secret found) reaches at least level 4", () => {
    const totalMonsterXp = LEVELS.flatMap((level) => level.id)
      .flatMap(monstersOf)
      .reduce((sum, monster) => sum + monster.xpReward, 0);
    const SECRET_WALL_XP = 15; // level 1's one secret -- see SecretWall.ts / Leveling.SECRET_DISCOVERY_XP

    const character = newTestCharacter();
    gainXp(character, totalMonsterXp + SECRET_WALL_XP);

    expect(character.level).toBeGreaterThanOrEqual(4);
  });

  it("skipping every optional fight and secret still reaches level 4 by the boss", () => {
    // Optional, per Level.ts's own comments: level 1's Cinder Wretch
    // (sits in the lever spur's room, not the main corridor) and its
    // secret wall. Everything else is mandatory: level 1's Rot-thing,
    // every monster in level 2/level 3 (all patrol a single-tile-wide
    // corridor with no way around), and level 4's Steward Marrow --
    // technically walkable-around in that open room, but the boss this
    // whole descent builds to, not content a real playthrough skips.
    const mandatoryXp =
      monstersOf("level-1").find((m) => m.name === "Rot-thing")!.xpReward +
      monstersOf("level-2").reduce((sum, m) => sum + m.xpReward, 0) +
      monstersOf("level-3").reduce((sum, m) => sum + m.xpReward, 0) +
      monstersOf("level-4").reduce((sum, m) => sum + m.xpReward, 0);

    const character = newTestCharacter();
    gainXp(character, mandatoryXp);

    expect(character.level).toBe(4);
  });
});
