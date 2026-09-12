import { describe, expect, it } from "vitest";
import { DungeonMap } from "./DungeonMap";
import { Player } from "./Player";

const OPEN_MAP = new DungeonMap(["#####", "#...#", "#...#", "#...#", "#####"]);
const TILE_SIZE = 2;

function newPlayer(x = 1, z = 1, facing: 0 | 1 | 2 | 3 = 1) {
  return new Player(x, z, facing, TILE_SIZE, 1);
}

/** Runs enough time for any in-progress move/turn animation to finish. */
function finishAnimation(player: Player) {
  player.update(10);
}

describe("Player", () => {
  it("starts at the given grid cell and facing, camera positioned to match", () => {
    const player = newPlayer(2, 3, 0);
    expect(player.gridX).toBe(2);
    expect(player.gridZ).toBe(3);
    expect(player.facing).toBe(0);
    expect(player.camera.position.x).toBeCloseTo(2 * TILE_SIZE);
    expect(player.camera.position.z).toBeCloseTo(3 * TILE_SIZE);
    expect(player.isAnimating).toBe(false);
  });

  describe("forwardStep / rightStep", () => {
    it.each([
      [0, [0, -1], [1, 0]], // north: forward is -Z, right is +X (east)
      [1, [1, 0], [0, 1]], // east: forward is +X, right is +Z (south)
      [2, [0, 1], [-1, 0]], // south: forward is +Z, right is -X (west)
      [3, [-1, 0], [0, -1]], // west: forward is -X, right is -Z (north)
    ] as const)("facing %i", (facing, forward, right) => {
      const player = newPlayer(1, 1, facing);
      expect(player.forwardStep()).toEqual(forward);
      expect(player.rightStep()).toEqual(right);
    });
  });

  describe("tryMove", () => {
    it("moves into an open tile and updates grid position", () => {
      const player = newPlayer(1, 1, 1);
      const moved = player.tryMove(1, 0, OPEN_MAP);
      expect(moved).toBe(true);
      expect(player.gridX).toBe(2);
      expect(player.gridZ).toBe(1);
    });

    it("is blocked by a wall and leaves grid position unchanged", () => {
      const player = newPlayer(1, 1, 0);
      const moved = player.tryMove(-1, 0, OPEN_MAP); // (0, 1) is a wall
      expect(moved).toBe(false);
      expect(player.gridX).toBe(1);
      expect(player.gridZ).toBe(1);
    });

    it("animates the camera smoothly to the destination, then settles exactly on it", () => {
      const player = newPlayer(1, 1, 1);
      player.tryMove(1, 0, OPEN_MAP);
      expect(player.isAnimating).toBe(true);

      finishAnimation(player);
      expect(player.isAnimating).toBe(false);
      expect(player.camera.position.x).toBeCloseTo(2 * TILE_SIZE);
      expect(player.camera.position.z).toBeCloseTo(1 * TILE_SIZE);
    });

    it("refuses a second move while one is already animating", () => {
      const player = newPlayer(1, 1, 1);
      player.tryMove(1, 0, OPEN_MAP);
      const secondMove = player.tryMove(1, 0, OPEN_MAP);
      expect(secondMove).toBe(false);
      expect(player.gridX).toBe(2); // still mid-flight to the first destination
    });
  });

  describe("turn", () => {
    it("wraps facing around from west back to north", () => {
      const player = newPlayer(1, 1, 3);
      player.turn(1);
      expect(player.facing).toBe(0);
    });

    it("wraps facing around from north back to west", () => {
      const player = newPlayer(1, 1, 0);
      player.turn(-1);
      expect(player.facing).toBe(3);
    });

    it("lands on exactly north's yaw after turning right from west", () => {
      // Regression test for the wrap-around case: west's raw yaw
      // (facingToYaw(3) = -270deg) is a full 270deg from north's yaw (0deg)
      // without Player.turn's shortest-path adjustment, so a naive lerp
      // would either overshoot or land on the wrong normalized angle.
      const player = newPlayer(1, 1, 3); // west
      player.turn(1); // turn right -> north
      finishAnimation(player);
      const yaw = player.camera.rotation.y;
      const normalized = ((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      expect(normalized).toBeCloseTo(0, 5);
    });

    it("refuses to turn while a move is animating", () => {
      const player = newPlayer(1, 1, 1);
      player.tryMove(1, 0, OPEN_MAP);
      const turned = player.turn(1);
      expect(turned).toBe(false);
      expect(player.facing).toBe(1);
    });
  });
});
