import type { Interactable } from "./types";

/**
 * Stepping onto this tile wins the level. There's no separate condition
 * check here on purpose — the puzzle is what guards the path to this
 * tile (a locked door, a hidden route), so simply being able to reach it
 * *is* the proof the puzzle was solved. See
 * docs/08-roadmap-phases.md Phase 1.
 */
export class ExitTile implements Interactable {
  readonly kind = "exit";
  readonly isExit = true;

  constructor(
    public x: number,
    public z: number,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  onEnter(): string {
    return "You found the way out.";
  }
}
