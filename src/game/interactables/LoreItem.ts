import type { Interactable } from "./types";

/**
 * A readable (a journal page, an inscription, ...). Non-blocking and
 * re-readable — interacting just shows its text, no gameplay effect,
 * per docs/04-exploration-and-world.md. Unlike a key, this requires a
 * deliberate interact rather than triggering automatically on entering
 * its tile: reading is a choice, not something that should interrupt
 * every pass through the room.
 */
export class LoreItem implements Interactable {
  readonly kind = "loreItem";

  constructor(
    public x: number,
    public z: number,
    private readonly text: string,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  interact(): string {
    return this.text;
  }
}
