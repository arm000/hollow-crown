import * as THREE from "three";
import { WALL_HEIGHT } from "../DungeonMesh";
import type { Interactable } from "./types";

/**
 * Placeholder flat-colored geometry for interactables — same "flat
 * MeshStandardMaterial, no textures" treatment as `DungeonMesh` until
 * the Phase 5 art pass (docs/10-visual-style-guide.md). Every shape sits
 * on the floor at its entity's grid cell; nothing here needs to know
 * about facing/orientation since interactables are simple obstacles or
 * markers within a tile, not wall-embedded fixtures.
 */
export function createInteractableMesh(entity: Interactable, tileSize: number): THREE.Object3D | undefined {
  switch (entity.kind) {
    case "door":
      return buildDoor(entity, tileSize);
    case "keyItem":
      return buildKeyItem(entity, tileSize);
    case "exit":
      return buildExitMarker(entity, tileSize);
    case "lever":
      return buildLever(entity, tileSize);
    case "loreItem":
      return buildLoreItem(entity, tileSize);
    case "pushableBlock":
      return buildPushableBlock(entity, tileSize);
    case "pressurePlate":
      return buildPressurePlate(entity, tileSize);
    case "secretWall":
      // Deliberately no mesh: a secret wall *is* one of DungeonMesh's
      // ordinary wall faces, indistinguishable from any other wall until
      // revealed (see Game.refreshEntityVisual -> hideWallFace).
      return undefined;
    default:
      return undefined;
  }
}

function buildDoor(entity: Interactable, tileSize: number): THREE.Object3D {
  const height = WALL_HEIGHT * 0.85;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(tileSize * 0.8, height, tileSize * 0.8),
    new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }),
  );
  mesh.position.set(entity.x * tileSize, height / 2, entity.z * tileSize);
  return mesh;
}

function buildKeyItem(entity: Interactable, tileSize: number): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.2),
    new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.4, metalness: 0.6 }),
  );
  mesh.position.set(entity.x * tileSize, 0.9, entity.z * tileSize);
  return mesh;
}

function buildExitMarker(entity: Interactable, tileSize: number): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(tileSize * 0.9, tileSize * 0.9),
    new THREE.MeshStandardMaterial({
      color: 0xfff2cc,
      emissive: 0x88711a,
      emissiveIntensity: 0.6,
      roughness: 1,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  // Just above the floor, avoids z-fighting with the floor plane.
  mesh.position.set(entity.x * tileSize, 0.02, entity.z * tileSize);
  return mesh;
}

function buildLever(entity: Interactable, tileSize: number): THREE.Object3D {
  // A thin standing switch, deliberately much slimmer than a door so it
  // reads as "fixture to interact with" rather than "obstacle blocking
  // the way" — levers never block movement.
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(tileSize * 0.15, 1, tileSize * 0.15),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.5, metalness: 0.4 }),
  );
  mesh.position.set(entity.x * tileSize, 0.5, entity.z * tileSize);
  return mesh;
}

function buildLoreItem(entity: Interactable, tileSize: number): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(tileSize * 0.3, 0.05, tileSize * 0.4),
    new THREE.MeshStandardMaterial({ color: 0xd8c9a3, roughness: 1 }),
  );
  mesh.position.set(entity.x * tileSize, 0.05, entity.z * tileSize);
  return mesh;
}

function buildPushableBlock(entity: Interactable, tileSize: number): THREE.Object3D {
  const size = tileSize * 0.8;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color: 0xb08050, roughness: 0.95 }),
  );
  mesh.position.set(entity.x * tileSize, size / 2, entity.z * tileSize);
  return mesh;
}

function buildPressurePlate(entity: Interactable, tileSize: number): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(tileSize * 0.7, 0.04, tileSize * 0.7),
    new THREE.MeshStandardMaterial({ color: 0x4a6a7a, roughness: 0.8, metalness: 0.2 }),
  );
  mesh.position.set(entity.x * tileSize, 0.02, entity.z * tileSize);
  return mesh;
}
