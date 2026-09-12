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

/**
 * Builds the renderable geometry for a dungeon level: one big floor slab,
 * one big ceiling slab, and an instanced quad for every wall face that
 * borders a walkable tile (interior wall volume is never built, since the
 * player can never see it).
 */
export function buildDungeonMesh(dungeon: DungeonMap, tileSize: number): THREE.Group {
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

  for (let z = 0; z < dungeon.height; z++) {
    for (let x = 0; x < dungeon.width; x++) {
      if (dungeon.isWall(x, z)) continue;
      for (const [dx, dz, yaw] of NEIGHBORS) {
        if (!dungeon.isWall(x + dx, z + dz)) continue;
        dummy.position.set(
          x * tileSize + (dx * tileSize) / 2,
          WALL_HEIGHT / 2,
          z * tileSize + (dz * tileSize) / 2,
        );
        dummy.rotation.set(0, yaw, 0);
        dummy.updateMatrix();
        faceMatrices.push(dummy.matrix.clone());
      }
    }
  }

  if (faceMatrices.length > 0) {
    const walls = new THREE.InstancedMesh(wallGeo, wallMat, faceMatrices.length);
    faceMatrices.forEach((matrix, i) => walls.setMatrixAt(i, matrix));
    walls.instanceMatrix.needsUpdate = true;
    group.add(walls);
  }

  return group;
}
