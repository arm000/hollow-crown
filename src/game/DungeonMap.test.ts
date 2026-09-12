import { describe, expect, it } from "vitest";
import { DungeonMap, STARTING_LEVEL } from "./DungeonMap";
import { STARTING_LEVEL_ENTITIES } from "./Level";

describe("DungeonMap", () => {
  it("reports width/height from the layout", () => {
    const map = new DungeonMap(["###", "#.#", "###"]);
    expect(map.width).toBe(3);
    expect(map.height).toBe(3);
  });

  it("rejects a layout with mismatched row lengths", () => {
    expect(() => new DungeonMap(["###", "#."])).toThrow();
  });

  it("rejects an empty layout", () => {
    expect(() => new DungeonMap([])).toThrow();
  });

  it("reads floor and wall tiles", () => {
    const map = new DungeonMap(["###", "#.#", "###"]);
    expect(map.isWall(0, 0)).toBe(true);
    expect(map.isWall(1, 1)).toBe(false);
  });

  it("treats anything outside the grid as a wall", () => {
    const map = new DungeonMap(["###", "#.#", "###"]);
    expect(map.isWall(-1, 1)).toBe(true);
    expect(map.isWall(1, -1)).toBe(true);
    expect(map.isWall(3, 1)).toBe(true);
    expect(map.isWall(1, 3)).toBe(true);
  });

  it("finds the marked start tile", () => {
    const map = new DungeonMap(["###", "#S#", "###"]);
    expect(map.findStart()).toEqual({ x: 1, z: 1 });
  });

  it("falls back to (1, 1) when no start tile is marked", () => {
    const map = new DungeonMap(["###", "#.#", "###"]);
    expect(map.findStart()).toEqual({ x: 1, z: 1 });
  });

  describe("STARTING_LEVEL", () => {
    it("is fully enclosed by walls on every edge", () => {
      for (let x = 0; x < STARTING_LEVEL.width; x++) {
        expect(STARTING_LEVEL.isWall(x, 0)).toBe(true);
        expect(STARTING_LEVEL.isWall(x, STARTING_LEVEL.height - 1)).toBe(true);
      }
      for (let z = 0; z < STARTING_LEVEL.height; z++) {
        expect(STARTING_LEVEL.isWall(0, z)).toBe(true);
        expect(STARTING_LEVEL.isWall(STARTING_LEVEL.width - 1, z)).toBe(true);
      }
    });

    it("has a start tile that isn't a wall", () => {
      const start = STARTING_LEVEL.findStart();
      expect(STARTING_LEVEL.isWall(start.x, start.z)).toBe(false);
    });

    it("has every floor tile reachable from the start, secret walls included (no truly isolated rooms)", () => {
      // Secret walls (see interactables/SecretWall.ts) are deliberately
      // *not* reachable by raw wall/floor adjacency — that's what makes
      // them secret. Treat their coordinates as passable here so this
      // check still catches a genuinely unreachable/isolated room (a
      // real level-design bug) without also flagging every intentional
      // secret as one.
      const secretWallTiles = new Set(
        STARTING_LEVEL_ENTITIES.filter((spawn) => spawn.type === "secretWall").map(
          (spawn) => `${spawn.x},${spawn.z}`,
        ),
      );
      const passable = (x: number, z: number) => !STARTING_LEVEL.isWall(x, z) || secretWallTiles.has(`${x},${z}`);

      const start = STARTING_LEVEL.findStart();
      const seen = new Set<string>([`${start.x},${start.z}`]);
      const queue: Array<{ x: number; z: number }> = [start];
      const steps: Array<[number, number]> = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ];

      while (queue.length > 0) {
        const { x, z } = queue.shift()!;
        for (const [dx, dz] of steps) {
          const nx = x + dx;
          const nz = z + dz;
          const key = `${nx},${nz}`;
          if (!passable(nx, nz) || seen.has(key)) continue;
          seen.add(key);
          queue.push({ x: nx, z: nz });
        }
      }

      let floorTileCount = 0;
      for (let z = 0; z < STARTING_LEVEL.height; z++) {
        for (let x = 0; x < STARTING_LEVEL.width; x++) {
          if (passable(x, z)) floorTileCount++;
        }
      }

      expect(seen.size).toBe(floorTileCount);
    });
  });
});
