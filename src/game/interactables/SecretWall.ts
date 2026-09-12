import type { Interactable } from "./types";

/**
 * A wall tile that's secretly passable once found. Its grid tile stays
 * `#` in `DungeonMap` forever (rendering and the raw wall check both
 * treat it as an ordinary wall) — this entity is the sole authority on
 * whether it actually blocks movement once registered for that tile, per
 * `GameLogic`'s "check the interactable first, fall back to the raw
 * grid" rule. See docs/04-exploration-and-world.md.
 *
 * Revealing it is a deliberate `interact` (a "search"), not automatic —
 * consistent with how doors and levers work, and avoids passively
 * revealing secrets just by walking near them.
 */
export class SecretWall implements Interactable {
  readonly kind = "secretWall";
  private revealed = false;

  constructor(
    public x: number,
    public z: number,
  ) {}

  blocksMovement(): boolean {
    return !this.revealed;
  }

  interact(): string {
    if (this.revealed) return "Just a wall now.";
    this.revealed = true;
    return "You find a hidden passage!";
  }
}
