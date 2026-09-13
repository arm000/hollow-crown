import type { EquipmentItem } from "../party/Equipment";
import type { InteractionContext, Interactable } from "./types";

/**
 * A piece of gear lying on the floor. Picked up into the shared
 * inventory on entering its tile, same as `KeyItem` — who actually
 * wears it is the player's choice via the inventory screen
 * (`InventoryUI`/`equipItem` in `GameLogic.ts`), not decided by the
 * level. Earlier in Phase 3, before that screen existed, this
 * auto-equipped onto a level-designated character; that was a
 * deliberate stopgap, not the design (docs/08-roadmap-phases.md Phase
 * 3 batch 2's status entry).
 */
export class EquipmentPickup implements Interactable {
  readonly kind = "equipmentItem";
  private collected = false;

  constructor(
    public x: number,
    public z: number,
    private readonly item: EquipmentItem,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  onEnter(ctx: InteractionContext): string | undefined {
    if (this.collected) return undefined;
    ctx.inventory.add(this.item.id, this.item.name);
    this.collected = true;
    return `You found ${this.item.name}.`;
  }

  isConsumed(): boolean {
    return this.collected;
  }
}
