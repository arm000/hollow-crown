/**
 * The shared party inventory (see docs/06-items-and-equipment.md — a
 * single shared list, not per-character bags). Minimal placeholder: just
 * tracks which item ids have been collected, plus a display name for
 * the placeholder HUD list. No stacking, no equipment slots yet — those
 * arrive with Phase 3.
 */
export class Inventory {
  private readonly items = new Map<string, string>(); // itemId -> display name

  add(itemId: string, displayName: string = itemId): void {
    this.items.set(itemId, displayName);
  }

  has(itemId: string): boolean {
    return this.items.has(itemId);
  }

  /** Display names in collection order, for the placeholder HUD list. */
  list(): string[] {
    return [...this.items.values()];
  }
}
