import { describe, expect, it } from "vitest";
import { DungeonMap } from "./DungeonMap";
import { ClassGate } from "./interactables/ClassGate";
import { Door } from "./interactables/Door";
import { InteractableManager } from "./interactables/InteractableManager";
import { PushableBlock } from "./interactables/PushableBlock";
import { SecretWall } from "./interactables/SecretWall";
import { Inventory } from "./Inventory";
import { buildMinimapGrid } from "./Minimap";
import { Character } from "./party/Character";
import { Party } from "./party/Party";

const NO_INTERACTABLES = new InteractableManager([]);

// #####
// #S..#
// #.#.#
// #...#
// #####
const MAP = new DungeonMap(["#####", "#S..#", "#.#.#", "#...#", "#####"]);

describe("buildMinimapGrid", () => {
  it("marks everything unknown when nothing has been visited", () => {
    const grid = buildMinimapGrid(MAP, NO_INTERACTABLES, new Set());
    for (const row of grid) {
      for (const cell of row) expect(cell).toBe("unknown");
    }
  });

  it("reveals a visited floor tile as floor", () => {
    const grid = buildMinimapGrid(MAP, NO_INTERACTABLES, new Set(["1,1"]));
    expect(grid[1][1]).toBe("floor");
  });

  it("reveals the walls adjacent to a visited floor tile, but nothing further out", () => {
    const grid = buildMinimapGrid(MAP, NO_INTERACTABLES, new Set(["1,1"]));

    // Adjacent walls -- revealed.
    expect(grid[0][1]).toBe("wall"); // north
    expect(grid[1][0]).toBe("wall"); // west

    // The floor tile at (2, 1) *is* in a straight line from (1,1), so
    // line-of-sight reveals it too (see the dedicated tests below) --
    // pick a tile that's neither adjacent nor in line to prove the
    // "nothing further out" half of this claim.
    expect(grid[3][3]).toBe("unknown");
  });

  it("never mislabels a revealed cell, however much has been visited", () => {
    // Every floor tile visited -- a corner wall tile with no orthogonal
    // floor neighbor (e.g. the map's literal corners) legitimately stays
    // "unknown" forever, so this checks "revealed cells are correct,"
    // not "every cell ends up revealed."
    const visited = new Set<string>();
    for (let z = 0; z < MAP.height; z++) {
      for (let x = 0; x < MAP.width; x++) {
        if (!MAP.isWall(x, z)) visited.add(`${x},${z}`);
      }
    }

    const grid = buildMinimapGrid(MAP, NO_INTERACTABLES, visited);

    for (let z = 0; z < MAP.height; z++) {
      for (let x = 0; x < MAP.width; x++) {
        if (grid[z][x] === "unknown") continue;
        expect(grid[z][x]).toBe(MAP.isWall(x, z) ? "wall" : "floor");
      }
    }
  });

  it("returns a grid matching the dungeon's exact width and height", () => {
    const grid = buildMinimapGrid(MAP, NO_INTERACTABLES, new Set());
    expect(grid).toHaveLength(MAP.height);
    for (const row of grid) expect(row).toHaveLength(MAP.width);
  });

  describe("line of sight (tiles seen but not yet walked on)", () => {
    const CORRIDOR = new DungeonMap(["######", "#S...#", "######"]);

    it("reveals floor tiles straight ahead of a visited tile, not just the tile itself", () => {
      const grid = buildMinimapGrid(CORRIDOR, NO_INTERACTABLES, new Set(["1,1"]));
      expect(grid[1][2]).toBe("floor");
      expect(grid[1][3]).toBe("floor");
    });

    it("reveals the wall that finally stops the sightline, but nothing past it", () => {
      const grid = buildMinimapGrid(CORRIDOR, NO_INTERACTABLES, new Set(["1,1"]));
      expect(grid[1][4]).toBe("floor"); // the last floor tile before the far wall
      expect(grid[1][5]).toBe("wall"); // the far wall itself, seen from all the way down the corridor
    });

    function managerWithDoor(locked: boolean): InteractableManager {
      return new InteractableManager([new Door(3, 1, undefined, locked)]);
    }

    it("a closed door blocks the sightline and is itself revealed as a door, not a floor tile", () => {
      const grid = buildMinimapGrid(CORRIDOR, managerWithDoor(true), new Set(["1,1"]));
      expect(grid[1][2]).toBe("floor"); // between the party and the door
      expect(grid[1][3]).toBe("door"); // the door, seen
      expect(grid[1][4]).toBe("unknown"); // beyond a closed door -- not revealed
    });

    it("an open door doesn't block the sightline, and still shows as a door", () => {
      const grid = buildMinimapGrid(CORRIDOR, managerWithDoor(false), new Set(["1,1"]));
      expect(grid[1][3]).toBe("door");
      expect(grid[1][4]).toBe("floor"); // now visible straight through the open door
    });

    // #S.#.# -- (3,1) is a secret wall cell, (4,1) only reachable once revealed.
    const SECRET_CORRIDOR = new DungeonMap(["######", "#S.#.#", "######"]);

    function managerWithSecret(revealed: boolean): InteractableManager {
      const wall = new SecretWall(3, 1);
      if (revealed) wall.interact({ inventory: new Inventory(), party: new Party([]) });
      return new InteractableManager([wall]);
    }

    it("an unrevealed secret wall blocks the sightline exactly like an ordinary wall", () => {
      const grid = buildMinimapGrid(SECRET_CORRIDOR, managerWithSecret(false), new Set(["1,1"]));
      expect(grid[1][3]).toBe("wall"); // indistinguishable from any other wall while hidden
      expect(grid[1][4]).toBe("unknown");
    });

    it("a revealed secret wall shows as an open floor tile and stops blocking sight", () => {
      const grid = buildMinimapGrid(SECRET_CORRIDOR, managerWithSecret(true), new Set(["1,1"]));
      expect(grid[1][3]).toBe("floor"); // the opened passage, not a solid wall block
      expect(grid[1][4]).toBe("floor"); // now visible beyond it
    });

    it("a pushable block sitting on a floor tile shows as an obstacle, not plain floor -- the bug where the map showed an open hallway right up to an unmarked dead end", () => {
      const manager = new InteractableManager([new PushableBlock(3, 1)]);
      const grid = buildMinimapGrid(CORRIDOR, manager, new Set(["1,1"]));
      expect(grid[1][2]).toBe("floor"); // between the party and the block
      expect(grid[1][3]).toBe("obstacle"); // the block itself, currently blocking
      expect(grid[1][4]).toBe("unknown"); // it blocks sight too, same as a closed door
    });

    it("once a pushable block moves off a tile, that tile reverts to floor", () => {
      const block = new PushableBlock(3, 1);
      const manager = new InteractableManager([block]);
      manager.moveEntity(block, 4, 1); // simulates GameLogic pushing it one tile further down the corridor
      const grid = buildMinimapGrid(CORRIDOR, manager, new Set(["1,1"]));
      expect(grid[1][3]).toBe("floor");
      expect(grid[1][4]).toBe("obstacle");
    });

    it("an unopened class gate shows as an obstacle, same as a pushable block", () => {
      const gate = new ClassGate(3, 1, "rogue", "blocked", "opened");
      const grid = buildMinimapGrid(CORRIDOR, new InteractableManager([gate]), new Set(["1,1"]));
      expect(grid[1][3]).toBe("obstacle");
    });

    it("an opened class gate shows as plain floor and stops blocking sight", () => {
      const gate = new ClassGate(3, 1, "rogue", "blocked", "opened");
      const rogue = new Character("Ysolde", "rogue", "front", { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 5 }, 22, 0);
      gate.interact({ inventory: new Inventory(), party: new Party([rogue]) });
      const grid = buildMinimapGrid(CORRIDOR, new InteractableManager([gate]), new Set(["1,1"]));
      expect(grid[1][3]).toBe("floor");
      expect(grid[1][4]).toBe("floor");
    });

    it("reveals the walls flanking a corridor, not just the tiles straight down it", () => {
      // A 1-wide horizontal corridor -- row 0 and row 2 are its north/
      // south walls the whole way down.
      const WIDE_VIEW_CORRIDOR = new DungeonMap(["#######", "#S....#", "#######"]);
      const grid = buildMinimapGrid(WIDE_VIEW_CORRIDOR, NO_INTERACTABLES, new Set(["1,1"]));

      // Every step down the corridor's sightline should reveal its
      // flanking wall on both sides, not just the tile directly ahead --
      // "any wall seen on screen," not only ones dead ahead.
      for (const x of [2, 3, 4, 5]) {
        expect(grid[0][x], `wall above (${x},1)`).toBe("wall");
        expect(grid[2][x], `wall below (${x},1)`).toBe("wall");
      }
    });
  });
});
