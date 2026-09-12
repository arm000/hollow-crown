import type { Door } from "./Door";
import type { Interactable } from "./types";

/**
 * A floor plate that holds a linked door open for as long as something
 * (the party or a pushed block) sits on its tile — see
 * docs/04-exploration-and-world.md. Unlike `Lever`, a plate has no
 * `interact`: its state is driven entirely by occupancy, recomputed by
 * `InteractableManager.reevaluatePressurePlates` after every move, which
 * is simpler and self-correcting than tracking separate onEnter/onExit
 * events — the door's lock state is always derived fresh from "is
 * anything on the plate right now", never accumulated.
 */
export class PressurePlate implements Interactable {
  readonly kind = "pressurePlate";
  private occupied = false;

  constructor(
    public x: number,
    public z: number,
    private readonly linkedDoor: Door,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  setOccupied(occupied: boolean): void {
    if (this.occupied === occupied) return;
    this.occupied = occupied;
    this.linkedDoor.locked = !occupied;
  }
}
