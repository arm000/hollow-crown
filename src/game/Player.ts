import * as THREE from "three";

/** Facing direction as a compass index: 0 = north, 1 = east, 2 = south, 3 = west. */
export type Facing = 0 | 1 | 2 | 3;

/**
 * Anything that can answer "is this tile blocked". `DungeonMap` satisfies
 * this structurally, but callers can pass a composite (raw walls plus
 * blocking interactables — a locked door, an unrevealed secret wall) so
 * `Player` never needs to know interactables exist at all.
 */
export interface Passable {
  isWall(x: number, z: number): boolean;
}

const FACING_OFFSETS: Array<[number, number]> = [
  [0, -1], // north
  [1, 0], // east
  [0, 1], // south
  [-1, 0], // west
];

const EYE_HEIGHT = 1;
const MOVE_DURATION = 0.16;
const TURN_DURATION = 0.14;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function wrapFacing(f: number): Facing {
  return (((f % 4) + 4) % 4) as Facing;
}

type AnimKind = "idle" | "move" | "turn";

/**
 * The player is always locked to a grid cell and one of four facings, in
 * the classic Grimrock style. Moves and turns are instantaneous in game
 * state but animated smoothly on screen so the camera doesn't snap.
 */
export class Player {
  gridX: number;
  gridZ: number;
  facing: Facing;
  readonly camera: THREE.PerspectiveCamera;

  private readonly tileSize: number;
  private animKind: AnimKind = "idle";
  private animT = 1;
  private moveFrom = new THREE.Vector3();
  private moveTo = new THREE.Vector3();
  private rotFrom = 0;
  private rotTo = 0;

  constructor(gridX: number, gridZ: number, facing: Facing, tileSize: number, aspect: number) {
    this.gridX = gridX;
    this.gridZ = gridZ;
    this.facing = facing;
    this.tileSize = tileSize;

    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.01, 100);
    this.camera.position.copy(this.worldPosition());
    this.camera.rotation.set(0, facingToYaw(facing), 0);
  }

  get isAnimating(): boolean {
    return this.animT < 1;
  }

  private worldPosition(x = this.gridX, z = this.gridZ): THREE.Vector3 {
    return new THREE.Vector3(x * this.tileSize, EYE_HEIGHT, z * this.tileSize);
  }

  /** Direction the player is currently facing, as a (dx, dz) unit step. */
  forwardStep(): [number, number] {
    return FACING_OFFSETS[this.facing];
  }

  /** Direction to the player's right, as a (dx, dz) unit step. */
  rightStep(): [number, number] {
    return FACING_OFFSETS[(this.facing + 1) % 4];
  }

  /** Attempts to step onto the adjacent tile in the given grid direction. Fails if a wall blocks it or a move/turn is already in progress. */
  tryMove(dx: number, dz: number, terrain: Passable): boolean {
    if (this.isAnimating) return false;
    const nx = this.gridX + dx;
    const nz = this.gridZ + dz;
    if (terrain.isWall(nx, nz)) return false;

    this.moveFrom.copy(this.worldPosition());
    this.moveTo.copy(this.worldPosition(nx, nz));
    this.gridX = nx;
    this.gridZ = nz;
    this.animKind = "move";
    this.animT = 0;
    return true;
  }

  /** Turns 90 degrees; pass 1 to turn right (clockwise) or -1 to turn left. */
  turn(direction: 1 | -1): boolean {
    if (this.isAnimating) return false;

    this.rotFrom = facingToYaw(this.facing);
    this.facing = wrapFacing(this.facing + direction);
    this.rotTo = facingToYaw(this.facing);

    // Take the shortest angular path (never spin the long way around).
    if (this.rotTo - this.rotFrom > Math.PI) this.rotTo -= Math.PI * 2;
    if (this.rotTo - this.rotFrom < -Math.PI) this.rotTo += Math.PI * 2;

    this.animKind = "turn";
    this.animT = 0;
    return true;
  }

  update(deltaSeconds: number): void {
    if (this.animT >= 1) return;

    const duration = this.animKind === "move" ? MOVE_DURATION : TURN_DURATION;
    this.animT = Math.min(1, this.animT + deltaSeconds / duration);
    const eased = easeOutCubic(this.animT);

    if (this.animKind === "move") {
      this.camera.position.lerpVectors(this.moveFrom, this.moveTo, eased);
    } else if (this.animKind === "turn") {
      this.camera.rotation.y = THREE.MathUtils.lerp(this.rotFrom, this.rotTo, eased);
    }
  }
}

function facingToYaw(facing: Facing): number {
  // Facing increases clockwise (N->E->S->W); THREE yaw increases counter-clockwise,
  // so we negate.
  return -facing * (Math.PI / 2);
}
