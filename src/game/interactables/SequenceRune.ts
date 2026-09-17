import type { Door } from "./Door";
import type { Interactable } from "./types";

/**
 * Progress shared by every `SequenceRune` in one puzzle group — a plain
 * mutable object rather than a field on any single rune, since no one
 * rune is the "owner": stepping on rune 0 has to be visible to rune 1's
 * own check of whether it's next. Mirrors `Lever`/`PressurePlate`'s
 * existing pattern of holding a reference to shared state elsewhere
 * (there, a `Door`; here, this) rather than each entity re-deriving it.
 */
export interface RuneSequenceState {
  progress: number;
}

/**
 * One floor rune in an ordered sequence — step on all of them, in the
 * right order, to unlock a linked door. The "innovative puzzle" half of
 * a player request ("Add some innovative puzzles"): the correct order
 * is never printed on the runes themselves (they're unmarked floor
 * tiles, distinguished only by a faint glow — see
 * `InteractableMesh.ts`'s `buildSequenceRune`), only discoverable from
 * a nearby `LoreItem`'s inscription, so *reading the level* is the
 * puzzle, not trial and error on the runes themselves — consistent
 * with docs/06-items-and-equipment.md#discovery-not-explanation's
 * spirit even though that principle is written for items specifically.
 *
 * **Deliberately forgiving about incidental backtracking**: stepping
 * back onto a rune already passed (its `order` below the group's
 * current `progress`) is a harmless no-op, not a reset — only actually
 * stepping on a rune *out of turn* (ahead of what's next) resets the
 * whole group back to 0. A level's rune layout still has to make sure
 * the path to each next rune doesn't force walking across a *later*,
 * not-yet-reached one, but doubling back over ones already solved (often
 * unavoidable in a real room) never punishes the player for it.
 */
export class SequenceRune implements Interactable {
  readonly kind = "sequenceRune";

  constructor(
    public x: number,
    public z: number,
    /** This rune's 0-based position in its group's required order. */
    private readonly order: number,
    /** How many runes make up this group — the group is solved once `state.progress` reaches this. */
    private readonly total: number,
    private readonly state: RuneSequenceState,
    private readonly linkedDoor: Door,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  onEnter(): string | undefined {
    if (this.state.progress >= this.total) return undefined; // group already solved -- every rune goes quiet

    if (this.order < this.state.progress) return "This rune is already lit, and stays that way."; // an earlier rune, revisited
    if (this.order > this.state.progress) {
      this.state.progress = 0;
      return "Wrong rune — every light in the sequence gutters out at once.";
    }

    this.state.progress += 1;
    if (this.state.progress === this.total) {
      this.linkedDoor.locked = false;
      return "The final rune flares bright — a lock gives way somewhere nearby.";
    }
    return "The rune glows and holds.";
  }
}
