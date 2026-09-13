/**
 * The shared party inventory (see docs/06-items-and-equipment.md — a
 * single shared list, not per-character bags). Tracks a display name
 * and a count per item id — key items sit at count 1 forever (nothing
 * ever consumes them), consumables get used up via `consume`.
 */
export class Inventory {
  private readonly items = new Map<string, { name: string; count: number }>();

  add(itemId: string, displayName: string = itemId, count = 1): void {
    const existing = this.items.get(itemId);
    if (existing) {
      existing.count += count;
    } else {
      this.items.set(itemId, { name: displayName, count });
    }
  }

  has(itemId: string): boolean {
    return (this.items.get(itemId)?.count ?? 0) > 0;
  }

  /** Removes one of the item; returns whether one was actually available. */
  consume(itemId: string): boolean {
    const existing = this.items.get(itemId);
    if (!existing || existing.count <= 0) return false;
    existing.count -= 1;
    return true;
  }

  /** Display names in collection order (with a "xN" suffix once count > 1), for the placeholder HUD list. */
  list(): string[] {
    const names: string[] = [];
    for (const { name, count } of this.items.values()) {
      if (count <= 0) continue;
      names.push(count > 1 ? `${name} x${count}` : name);
    }
    return names;
  }

  /** Items with at least one remaining — for a combat UI to offer as usable. */
  entries(): Array<{ id: string; name: string; count: number }> {
    return [...this.items.entries()]
      .filter(([, item]) => item.count > 0)
      .map(([id, item]) => ({ id, name: item.name, count: item.count }));
  }
}
