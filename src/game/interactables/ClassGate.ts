import type { ClassId } from "../party/Character";
import type { InteractionContext, Interactable } from "./types";

/**
 * A passage that only opens for a party that includes a living member
 * of `requiredClass` — docs/03-party-and-characters.md's class table
 * ("Rogue ... handles lockpicking & trap disarm out of combat") made
 * literal, and docs/08-roadmap-phases.md Phase 3's "non-combat puzzle
 * gated by a class ability" scope item. No key, no lever: interacting
 * with the right class along is what opens it. Kept generic over which
 * class rather than hardcoding Rogue, so a different level could gate a
 * different passage on a different class without a new `Interactable`
 * type. Once opened, stays open — no re-locking, same as `Door`.
 */
export class ClassGate implements Interactable {
  readonly kind = "classGate";
  private opened = false;

  constructor(
    public x: number,
    public z: number,
    private readonly requiredClass: ClassId,
    private readonly blockedText: string,
    /** `{name}` is replaced with whichever party member actually opened it — the log crediting a specific character, not a generic "the party," is what should hint at the mechanic in play, per the spirit of docs/06-items-and-equipment.md#discovery-not-explanation even though that principle is written for items specifically. */
    private readonly openTextTemplate: string,
  ) {}

  blocksMovement(): boolean {
    return !this.opened;
  }

  blockedMessage(): string {
    return this.blockedText;
  }

  interact(ctx: InteractionContext): string {
    if (this.opened) return "The way is already open.";
    const opener = ctx.party.livingMembers().find((member) => member.classId === this.requiredClass);
    if (!opener) return this.blockedText;
    this.opened = true;
    return this.openTextTemplate.replace("{name}", opener.name);
  }
}
