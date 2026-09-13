import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildDungeonMesh } from "./DungeonMesh";
import { DungeonMap } from "./DungeonMap";

/**
 * `buildDungeonMesh` only constructs Three.js data/math objects
 * (geometry, materials, an InstancedMesh, matrices) — none of that
 * needs a WebGL context, only actually drawing a frame does. So this
 * runs as a plain headless unit test, same as `Player.test.ts`.
 */

function findWalls(group: THREE.Group): THREE.InstancedMesh {
  const walls = group.children.find((child) => child instanceof THREE.InstancedMesh);
  if (!walls) throw new Error("Expected an InstancedMesh of wall faces in the group");
  return walls as THREE.InstancedMesh;
}

/** True if the instance at `index` has been zero-scaled by hideWallFace. */
function isHidden(walls: THREE.InstancedMesh, index: number): boolean {
  const matrix = new THREE.Matrix4();
  walls.getMatrixAt(index, matrix);
  const scale = new THREE.Vector3();
  matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  return scale.x === 0;
}

describe("buildDungeonMesh", () => {
  it("builds one wall face per wall-adjacent floor-tile boundary", () => {
    const dungeon = new DungeonMap(["###", "#.#", "###"]);
    const { group } = buildDungeonMesh(dungeon, 2);
    expect(findWalls(group).count).toBe(4); // a 1-tile room has 4 surrounding faces
  });

  it("gives a secret wall cell's other (genuinely solid) sides real geometry", () => {
    // A corridor with a hidden cell in the middle: floor - secretwall - floor.
    const dungeon = new DungeonMap(["#####", "#.#.#", "#####"]);

    const without = buildDungeonMesh(dungeon, 2);
    const with_ = buildDungeonMesh(dungeon, 2, [{ x: 2, z: 1 }]);

    // Declaring (2,1) a secret cell adds its north/south side geometry
    // (both '#' in this layout) on top of the east/west faces the normal
    // per-floor-cell loop already built from the corridors beside it —
    // this is exactly the geometry that was missing before this fix,
    // which is what let the party see (but not walk) through a wall
    // once a secret passage was revealed.
    expect(findWalls(with_.group).count).toBe(findWalls(without.group).count + 2);
  });

  it("revealing a secret wall hides only its passage direction, not its side walls", () => {
    const dungeon = new DungeonMap(["#####", "#.#.#", "#####"]);
    const { group, hideWallFace } = buildDungeonMesh(dungeon, 2, [{ x: 2, z: 1 }]);
    const walls = findWalls(group);
    const totalFaces = walls.count;

    hideWallFace(2, 1);

    const hiddenCount = Array.from({ length: totalFaces }, (_, i) => i).filter((i) => isHidden(walls, i)).length;

    // Exactly the two passage-direction faces (east-facing from one
    // corridor, west-facing from the other) should be hidden -- the two
    // side-wall faces added by the previous test's fix must survive.
    expect(hiddenCount).toBe(2);
  });

  it("hideWallFace on a cell with no rendered face at all is a safe no-op", () => {
    const dungeon = new DungeonMap(["###", "#.#", "###"]);
    const { group, hideWallFace } = buildDungeonMesh(dungeon, 2);
    const walls = findWalls(group);

    expect(() => hideWallFace(99, 99)).not.toThrow(); // nowhere near the dungeon at all

    for (let i = 0; i < walls.count; i++) {
      expect(isHidden(walls, i)).toBe(false);
    }
  });
});
