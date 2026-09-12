import type { InteractionContext, Interactable } from "./types";

/**
 * A door blocking a passage until unlocked. Locked doors require a
 * matching key item in the party's inventory (see
 * docs/04-exploration-and-world.md). Once unlocked, a door stays
 * unlocked — there's no re-locking mechanism in v1.
 */
export class Door implements Interactable {
  readonly kind = "door";
  locked: boolean;

  constructor(
    public x: number,
    public z: number,
    private readonly requiredKeyId: string | undefined,
    locked = true,
  ) {
    this.locked = locked;
  }

  blocksMovement(): boolean {
    return this.locked;
  }

  blockedMessage(): string {
    return "The door is locked.";
  }

  interact(ctx: InteractionContext): string | undefined {
    if (!this.locked) {
      return "The door is already open.";
    }
    if (this.requiredKeyId && ctx.inventory.has(this.requiredKeyId)) {
      this.locked = false;
      return "You unlock the door.";
    }
    return "The door is locked.";
  }
}
