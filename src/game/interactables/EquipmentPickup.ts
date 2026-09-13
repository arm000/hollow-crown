import type { EquipmentItem } from "../party/Equipment";
import type { InteractionContext, Interactable } from "./types";

/**
 * A piece of gear lying on the floor. Auto-equips onto a specific named
 * party member on pickup — a deliberate simplification for this first
 * equipment pass (docs/08-roadmap-phases.md Phase 3): there's no
 * slot-management/inventory UI yet to let the player choose who wears
 * what or re-equip later, so the level itself decides. A real inventory
 * screen is the natural next step once this is worth building on.
 */
export class EquipmentPickup implements Interactable {
  readonly kind = "equipmentItem";
  private collected = false;

  constructor(
    public x: number,
    public z: number,
    private readonly item: EquipmentItem,
    private readonly targetCharacterName: string,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  onEnter(ctx: InteractionContext): string | undefined {
    if (this.collected) return undefined;
    const character = ctx.party.members.find((member) => member.name === this.targetCharacterName);
    if (!character) return undefined;

    character.equip(this.item);
    this.collected = true;
    return `${character.name} finds and equips ${this.item.name}.`;
  }

  isConsumed(): boolean {
    return this.collected;
  }
}
