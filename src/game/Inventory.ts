/**
 * Fully-unidentified items (docs/06-items-and-equipment.md#discovery-not-explanation's
 * stretch tier, docs/08-roadmap-phases.md Phase 5): a handful of
 * consumables show a mystery name instead of their true one until
 * identified — by actually using them in combat (`CombatEngine.resolveItem`
 * calls `Inventory.identify`), the simplest of that doc's three
 * identification routes ("by use, a found scroll, or a class skill").
 *
 * **Deliberate scope reduction**: a fixed mapping, not re-shuffled per
 * playthrough. The design doc's "random flavor names per playthrough"
 * exists so a name can't be looked up once and reused across replays —
 * real per-run randomization needs a seeded shuffle threaded through
 * `SaveGame.ts` too, which is a further stretch beyond this one, not
 * built here. Every other item (equipment, key items) is unaffected —
 * only consumables ship unidentified in this pass, matching the design
 * doc's own "an unidentified potion" framing.
 */
const UNIDENTIFIED_NAMES: Record<string, string> = {
  "oil-flask": "a bubbling amber vial",
  antidote: "a cloudy green vial",
  bandages: "a stained roll of cloth",
  "smelling-salts": "a sharp-smelling sachet",
  "holy-water": "a vial of pale, still water",
};

/**
 * The shared party inventory (see docs/06-items-and-equipment.md — a
 * single shared list, not per-character bags). Tracks a display name
 * and a count per item id — key items sit at count 1 forever (nothing
 * ever consumes them), consumables get used up via `consume`.
 */
export class Inventory {
  private readonly items = new Map<string, { name: string; count: number }>();
  private readonly identified = new Set<string>();

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

  /** Reveals an item's true name from here on. A no-op for anything that never shipped unidentified (equipment, key items) — see `UNIDENTIFIED_NAMES` above. */
  identify(itemId: string): void {
    this.identified.add(itemId);
  }

  /** Display names in collection order (with a "xN" suffix once count > 1), for the placeholder HUD list. */
  list(): string[] {
    return this.entries().map(({ name, count }) => (count > 1 ? `${name} x${count}` : name));
  }

  /** Items with at least one remaining — for a combat UI to offer as usable. `name` is the mystery name for an unidentified consumable, the real one otherwise. */
  entries(): Array<{ id: string; name: string; count: number }> {
    return [...this.items.entries()]
      .filter(([, item]) => item.count > 0)
      .map(([id, item]) => ({ id, name: this.displayName(id, item.name), count: item.count }));
  }

  /** The stored (true) name and count per item, bypassing unidentified-name substitution — `SaveGame.ts` needs the *true* name to persist regardless of identification state, not whatever `entries()` currently displays. */
  rawEntries(): Array<{ id: string; name: string; count: number }> {
    return [...this.items.entries()]
      .filter(([, item]) => item.count > 0)
      .map(([id, item]) => ({ id, name: item.name, count: item.count }));
  }

  /** Every item id identified so far — paired with `rawEntries` so `SaveGame.ts` can restore identification state exactly, not just item counts. */
  identifiedIds(): string[] {
    return [...this.identified];
  }

  private displayName(itemId: string, trueName: string): string {
    const mystery = UNIDENTIFIED_NAMES[itemId];
    if (!mystery || this.identified.has(itemId)) return trueName;
    return mystery;
  }
}
