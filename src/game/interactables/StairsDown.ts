import type { Interactable } from "./types";

/**
 * Descends to the next level on entering its tile — the "stairs/
 * level-transition entity" from docs/08-roadmap-phases.md Phase 4.
 * Unlike `ExitTile` (which ends the run in victory, reserved for the
 * final level of a descent), this hands `targetLevelId` back up through
 * `InteractableManager`/`GameLogic` so `Game` can load a different
 * `LevelDef` and reposition the party at its start tile. No return trip
 * modeled in v1 — a one-way descent, matching the phase's "small
 * descent" scope.
 */
export class StairsDown implements Interactable {
  readonly kind = "stairsDown";
  /** Read by `InteractableManager.handleEnter` — the `Interactable` interface's contract for "which level to load next". */
  readonly stairsToLevelId: string;

  constructor(
    public x: number,
    public z: number,
    targetLevelId: string,
  ) {
    this.stairsToLevelId = targetLevelId;
  }

  blocksMovement(): boolean {
    return false;
  }

  onEnter(): string {
    return "You descend deeper into the dungeon...";
  }
}
