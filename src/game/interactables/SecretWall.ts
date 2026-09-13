import { awardPartyXp, SECRET_DISCOVERY_XP } from "../party/Leveling";
import type { InteractionContext, Interactable } from "./types";

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
 * revealing secrets just by walking near them. The first reveal also
 * awards XP, per docs/03-party-and-characters.md#leveling ("XP awarded
 * for combat victories and for first-time discovery of secrets") — only
 * the first, since re-searching an already-found wall isn't a new
 * discovery.
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

  interact(ctx: InteractionContext): string {
    if (this.revealed) return "Just a wall now.";
    this.revealed = true;
    const levelUps = awardPartyXp(ctx.party, SECRET_DISCOVERY_XP);
    return ["You find a hidden passage!", ...levelUps].join(" ");
  }
}
