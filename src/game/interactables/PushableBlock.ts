import type { Interactable } from "./types";

/**
 * A block occupying a floor tile that can be pushed one tile further in
 * the direction the party is moving, if that tile is free (see
 * docs/04-exploration-and-world.md). The actual push logic — checking
 * the tile beyond it and moving the block there — lives in
 * `GameLogic.ts`, since it needs to coordinate with the rest of the
 * move resolution; this class just holds the block's position and
 * always blocks the tile it's currently on.
 */
export class PushableBlock implements Interactable {
  readonly kind = "pushableBlock";

  constructor(
    public x: number,
    public z: number,
  ) {}

  blocksMovement(): boolean {
    return true;
  }

  blockedMessage(): string {
    return "It won't budge that way.";
  }
}
