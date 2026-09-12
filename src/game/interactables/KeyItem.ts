import type { InteractionContext, Interactable } from "./types";

/**
 * A key lying on the floor. Picked up automatically when the party steps
 * onto its tile (see docs/04-exploration-and-world.md) — unlike lore
 * items, there's little reason to make picking up a functional key a
 * separate deliberate action.
 */
export class KeyItem implements Interactable {
  readonly kind = "keyItem";
  private collected = false;

  constructor(
    public x: number,
    public z: number,
    public readonly itemId: string,
    private readonly displayName: string,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  onEnter(ctx: InteractionContext): string | undefined {
    if (this.collected) return undefined;
    ctx.inventory.add(this.itemId, this.displayName);
    this.collected = true;
    return `You found ${this.displayName}.`;
  }

  isConsumed(): boolean {
    return this.collected;
  }
}
