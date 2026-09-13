import { describe, expect, it } from "vitest";
import { getLevel, LEVELS } from "./index";

describe("LEVELS", () => {
  it("has 4 levels, in descent order", () => {
    expect(LEVELS.map((l) => l.id)).toEqual(["level-1", "level-2", "level-3", "level-4"]);
  });

  it("every level has a non-empty name and intro message (docs/08-roadmap-phases.md Phase 5)", () => {
    for (const level of LEVELS) {
      expect(level.name.length, `${level.id} name`).toBeGreaterThan(0);
      expect(level.introMessage.length, `${level.id} introMessage`).toBeGreaterThan(0);
    }
  });

  it("every non-final level's StairsDown points at the next level's id", () => {
    for (let i = 0; i < LEVELS.length - 1; i++) {
      const stairs = LEVELS[i].entities.find((spawn) => spawn.type === "stairsDown");
      expect(stairs, `${LEVELS[i].id} should have a stairsDown spawn`).toBeDefined();
      expect(stairs!.params?.targetLevelId).toBe(LEVELS[i + 1].id);
    }
  });

  it("only the final level has a real exit (win condition)", () => {
    for (let i = 0; i < LEVELS.length - 1; i++) {
      expect(LEVELS[i].entities.some((spawn) => spawn.type === "exit")).toBe(false);
    }
    expect(LEVELS[LEVELS.length - 1].entities.some((spawn) => spawn.type === "exit")).toBe(true);
  });

  it("every level's map is fully enclosed and its start tile is reachable from every floor tile", () => {
    for (const level of LEVELS) {
      const { dungeon } = level;
      for (let x = 0; x < dungeon.width; x++) {
        expect(dungeon.isWall(x, 0), `${level.id} top row`).toBe(true);
        expect(dungeon.isWall(x, dungeon.height - 1), `${level.id} bottom row`).toBe(true);
      }
      for (let z = 0; z < dungeon.height; z++) {
        expect(dungeon.isWall(0, z), `${level.id} left column`).toBe(true);
        expect(dungeon.isWall(dungeon.width - 1, z), `${level.id} right column`).toBe(true);
      }

      const secretWallTiles = new Set(
        level.entities.filter((spawn) => spawn.type === "secretWall").map((spawn) => `${spawn.x},${spawn.z}`),
      );
      const passable = (x: number, z: number) => !dungeon.isWall(x, z) || secretWallTiles.has(`${x},${z}`);

      const start = dungeon.findStart();
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
      for (let z = 0; z < dungeon.height; z++) {
        for (let x = 0; x < dungeon.width; x++) {
          if (passable(x, z)) floorTileCount++;
        }
      }
      expect(seen.size, `${level.id} should have no isolated floor tiles`).toBe(floorTileCount);
    }
  });
});

describe("getLevel", () => {
  it("returns the matching level", () => {
    expect(getLevel("level-2").id).toBe("level-2");
  });

  it("throws for an unknown id", () => {
    expect(() => getLevel("level-99")).toThrow();
  });
});
