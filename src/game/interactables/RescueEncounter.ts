import { createCharacterFromSpec, pickAvailablePortrait, recruitableCompanions } from "../party/roster";
import type { InteractionContext, Interactable } from "./types";

/**
 * A companion waiting to be found, one guaranteed per level on levels
 * 1-3 (docs/03-party-and-characters.md#party-creation-vs-pre-generated):
 * the run starts with a single character, and each of these grows the
 * party by one, up to `MAX_PARTY_SIZE` by level 4's boss fight if every
 * offer is taken.
 *
 * There's no accept/decline choice to build a dialogue-branch UI for —
 * every recruit is a strict upgrade (another class's kit, more HP, no
 * cost), so interacting *is* the whole offer, same "sparse encounter,
 * not a branching dialogue tree" shape `NpcEncounter` already uses
 * (docs/02-setting-and-story.md#how-story-is-delivered).
 *
 * Which classic roster member actually shows up here isn't baked into
 * level data — level 1/2/3 each just place one of these with its own
 * flavor `line`, and `interact` resolves the *identity* live, against
 * the party's own composition: whichever of the three companions the
 * player didn't start as, taken in fixed roster order, skipping anyone
 * already recruited. That makes the same three spawns correctly offer
 * the right three companions no matter which class was picked at
 * creation, with no coordination needed between the three level files.
 *
 * A recruit's portrait color usually matches their
 * `DEFAULT_PARTY_SPEC` entry, but falls back to whatever's actually
 * free (`pickAvailablePortrait`) if the player's own freely-chosen
 * starting portrait already claimed it — otherwise a party member
 * could be indistinguishable from another in the HUD's party status.
 *
 * `isConsumed` (true once `resolved`) is what makes the figure actually
 * disappear once there's nothing left to do here — same convention
 * `KeyItem`/`EquipmentPickup` already use, read by
 * `InteractableManager.handleInteract` to drop it from the level and by
 * `Game.refreshEntityVisual` to remove its mesh. A party that's
 * genuinely full (shouldn't happen given the one-per-level-1-3 pacing,
 * but not impossible) leaves it *not* resolved — the companion is
 * still there, just not able to join yet.
 */
export class RescueEncounter implements Interactable {
  readonly kind = "rescue";
  private recruitedName: string | undefined;
  private resolved = false;

  constructor(
    public x: number,
    public z: number,
    private readonly line: string,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  interact(ctx: InteractionContext): string {
    if (this.resolved) {
      return this.recruitedName ? `${this.recruitedName} is already at your side.` : "There's no one here anymore.";
    }

    // party.members[0] is always the character built at creation --
    // members are only ever appended (`Party.addMember`), never
    // reordered, so this stays reliable even after other recruits.
    const starter = ctx.party.members[0];
    const remaining = recruitableCompanions(starter.classId).filter(
      (spec) => !ctx.party.members.some((member) => member.name === spec.name),
    );
    if (remaining.length === 0) {
      this.resolved = true;
      return `${this.line}\nBut there's no one left down here to find.`;
    }
    if (ctx.party.members.length >= 4) {
      // Shouldn't happen given the one-per-level-1-3 pacing, but a
      // full party is a reason to decline, not a reason to crash.
      return `${this.line}\nThere's no room left to take them with you.`;
    }

    const spec = remaining[0];
    // The companion's usual DEFAULT_PARTY_SPEC color, unless the
    // player's freely-chosen starting portrait (or an earlier recruit,
    // in a party this size shouldn't collide but why not check) is
    // already wearing it -- see `pickAvailablePortrait`.
    const portrait = pickAvailablePortrait(
      ctx.party.members.map((member) => member.portrait),
      spec.portrait,
    );
    ctx.party.addMember(createCharacterFromSpec({ ...spec, portrait }));
    this.recruitedName = spec.name;
    this.resolved = true;
    return `${this.line}\n${spec.name} joins your party!`;
  }

  isConsumed(): boolean {
    return this.resolved;
  }
}
