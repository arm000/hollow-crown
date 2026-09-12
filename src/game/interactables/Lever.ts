import type { Door } from "./Door";
import type { Interactable } from "./types";

/**
 * A wall-mounted switch that toggles a linked door elsewhere in the
 * level (see docs/04-exploration-and-world.md). Unlike a key-locked
 * door, a lever's door has no key requirement of its own — only the
 * lever (or, in principle, some other lever wired to the same door)
 * changes its state.
 */
export class Lever implements Interactable {
  readonly kind = "lever";

  constructor(
    public x: number,
    public z: number,
    private readonly linkedDoor: Door,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  interact(): string {
    this.linkedDoor.locked = !this.linkedDoor.locked;
    return this.linkedDoor.locked
      ? "You push the lever. Something locks nearby."
      : "You pull the lever. Something unlocks nearby.";
  }
}
