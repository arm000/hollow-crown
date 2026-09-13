import { describe, expect, it } from "vitest";
import { DungeonMap } from "./DungeonMap";
import { buildMinimapGrid } from "./Minimap";

// #####
// #S..#
// #.#.#
// #...#
// #####
const MAP = new DungeonMap(["#####", "#S..#", "#.#.#", "#...#", "#####"]);

describe("buildMinimapGrid", () => {
  it("marks everything unknown when nothing has been visited", () => {
    const grid = buildMinimapGrid(MAP, new Set());
    for (const row of grid) {
      for (const cell of row) expect(cell).toBe("unknown");
    }
  });

  it("reveals a visited floor tile as floor", () => {
    const grid = buildMinimapGrid(MAP, new Set(["1,1"]));
    expect(grid[1][1]).toBe("floor");
  });

  it("reveals the walls adjacent to a visited floor tile, but nothing further out", () => {
    const grid = buildMinimapGrid(MAP, new Set(["1,1"]));

    // Adjacent walls -- revealed.
    expect(grid[0][1]).toBe("wall"); // north
    expect(grid[1][0]).toBe("wall"); // west

    // The floor tile at (2, 1) is unvisited and only reachable via (1,1)
    // horizontally, not diagonally -- still unknown, since it isn't
    // itself visited and isn't a wall adjacent to a visited tile.
    expect(grid[1][2]).toBe("unknown");

    // Tiles nowhere near (1,1) stay unknown too.
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

    const grid = buildMinimapGrid(MAP, visited);

    for (let z = 0; z < MAP.height; z++) {
      for (let x = 0; x < MAP.width; x++) {
        if (grid[z][x] === "unknown") continue;
        expect(grid[z][x]).toBe(MAP.isWall(x, z) ? "wall" : "floor");
      }
    }
  });

  it("returns a grid matching the dungeon's exact width and height", () => {
    const grid = buildMinimapGrid(MAP, new Set());
    expect(grid).toHaveLength(MAP.height);
    for (const row of grid) expect(row).toHaveLength(MAP.width);
  });
});
