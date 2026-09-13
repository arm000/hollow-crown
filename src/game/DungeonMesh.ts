import * as THREE from "three";
import type { DungeonMap } from "./DungeonMap";

export const WALL_HEIGHT = 2;

/** Direction offsets for the four cardinal neighbors, paired with the yaw
 * (rotation around Y) that makes a wall quad's front face point back at a
 * floor tile sitting in that direction. */
const NEIGHBORS: Array<[dx: number, dz: number, yaw: number]> = [
  [0, -1, 0], // wall to the north
  [1, 0, -Math.PI / 2], // wall to the east
  [0, 1, Math.PI], // wall to the south
  [-1, 0, Math.PI / 2], // wall to the west
];

const HIDDEN_FACE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

export interface DungeonMeshResult {
  group: THREE.Group;
  /**
   * Hides the wall face(s) bordering the given wall cell — used when a
   * `SecretWall` (see `interactables/SecretWall.ts`) is revealed and the
   * passage should visually open up. A no-op if that cell never had a
   * rendered face (e.g. it's surrounded by other walls, or isn't a wall
   * cell at all).
   */
  hideWallFace(x: number, z: number): void;
}

/**
 * Builds the renderable geometry for a dungeon level: one big floor slab,
 * one big ceiling slab, and an instanced quad for every wall face that
 * borders a walkable tile (interior wall volume is never built, since the
 * player can never see it).
 *
 * `secretWallCells` are wall cells that can *later* become walkable (see
 * `SecretWall`) even though they're `#` in `dungeon` right now. A plain
 * wall cell that never becomes enterable needs no geometry beyond the
 * faces its floor neighbors already generate — but a cell someone can
 * eventually stand inside needs its *other* sides built too (genuine
 * solid walls, e.g. the two sides of a one-tile-wide secret passage), or
 * they'd be invisible-but-still-solid once revealed: never built in the
 * first place, not merely hidden. Those side faces are always visible
 * and are never registered for `hideWallFace` — revealing a secret
 * should open the passage along its length, not remove its side walls.
 */
export function buildDungeonMesh(
  dungeon: DungeonMap,
  tileSize: number,
  secretWallCells: Array<{ x: number; z: number }> = [],
): DungeonMeshResult {
  const group = new THREE.Group();
  group.name = "dungeon";

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 1 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x14110d, roughness: 1 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5c5548, roughness: 0.9 });

  const spanX = dungeon.width * tileSize;
  const spanZ = dungeon.height * tileSize;
  const centerX = ((dungeon.width - 1) * tileSize) / 2;
  const centerZ = ((dungeon.height - 1) * tileSize) / 2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(spanX, spanZ), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centerX, 0, centerZ);
  group.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(spanX, spanZ), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(centerX, WALL_HEIGHT, centerZ);
  group.add(ceiling);

  const wallGeo = new THREE.PlaneGeometry(tileSize, WALL_HEIGHT);
  const dummy = new THREE.Object3D();
  const faceMatrices: THREE.Matrix4[] = [];
  // Which face instance(s) border a given wall cell — usually one, but a
  // single-tile-wide wall between two corridors could border floor on
  // both sides.
  const faceIndicesByWallCell = new Map<string, number[]>();

  for (let z = 0; z < dungeon.height; z++) {
    for (let x = 0; x < dungeon.width; x++) {
      if (dungeon.isWall(x, z)) continue;
      for (const [dx, dz, yaw] of NEIGHBORS) {
        const wallX = x + dx;
        const wallZ = z + dz;
        if (!dungeon.isWall(wallX, wallZ)) continue;
        dummy.position.set(
          x * tileSize + (dx * tileSize) / 2,
          WALL_HEIGHT / 2,
          z * tileSize + (dz * tileSize) / 2,
        );
        dummy.rotation.set(0, yaw, 0);
        dummy.updateMatrix();

        const faceIndex = faceMatrices.length;
        faceMatrices.push(dummy.matrix.clone());

        const wallKey = `${wallX},${wallZ}`;
        const indices = faceIndicesByWallCell.get(wallKey);
        if (indices) indices.push(faceIndex);
        else faceIndicesByWallCell.set(wallKey, [faceIndex]);
      }
    }
  }

  // A secret cell's own genuine wall neighbors (not the direction(s) that
  // lead to real floor, which the loop above already handles) — always
  // visible, deliberately not added to faceIndicesByWallCell.
  for (const { x, z } of secretWallCells) {
    for (const [dx, dz, yaw] of NEIGHBORS) {
      const neighborX = x + dx;
      const neighborZ = z + dz;
      if (!dungeon.isWall(neighborX, neighborZ)) continue; // an open connection, not a wall to build
      dummy.position.set(x * tileSize + (dx * tileSize) / 2, WALL_HEIGHT / 2, z * tileSize + (dz * tileSize) / 2);
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      faceMatrices.push(dummy.matrix.clone());
    }
  }

  let walls: THREE.InstancedMesh | undefined;
  if (faceMatrices.length > 0) {
    walls = new THREE.InstancedMesh(wallGeo, wallMat, faceMatrices.length);
    faceMatrices.forEach((matrix, i) => walls!.setMatrixAt(i, matrix));
    walls.instanceMatrix.needsUpdate = true;
    group.add(walls);
  }

  return {
    group,
    hideWallFace(x: number, z: number): void {
      const indices = faceIndicesByWallCell.get(`${x},${z}`);
      if (!indices || !walls) return;
      for (const index of indices) walls.setMatrixAt(index, HIDDEN_FACE_MATRIX);
      walls.instanceMatrix.needsUpdate = true;
    },
  };
}
