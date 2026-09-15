import { createCharacterFromSpec, recruitableCompanions } from "../party/roster";
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
 */
export class RescueEncounter implements Interactable {
  readonly kind = "rescue";
  private recruitedName: string | undefined;

  constructor(
    public x: number,
    public z: number,
    private readonly line: string,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  interact(ctx: InteractionContext): string {
    if (this.recruitedName) return `${this.recruitedName} is already at your side.`;

    // party.members[0] is always the character built at creation --
    // members are only ever appended (`Party.addMember`), never
    // reordered, so this stays reliable even after other recruits.
    const starter = ctx.party.members[0];
    const remaining = recruitableCompanions(starter.classId).filter(
      (spec) => !ctx.party.members.some((member) => member.name === spec.name),
    );
    if (remaining.length === 0) {
      this.recruitedName = "no one";
      return `${this.line}\nBut there's no one left down here to find.`;
    }
    if (ctx.party.members.length >= 4) {
      // Shouldn't happen given the one-per-level-1-3 pacing, but a
      // full party is a reason to decline, not a reason to crash.
      return `${this.line}\nThere's no room left to take them with you.`;
    }

    const spec = remaining[0];
    ctx.party.addMember(createCharacterFromSpec(spec));
    this.recruitedName = spec.name;
    return `${this.line}\n${spec.name} joins your party!`;
  }
}
