import type { Character } from "./Character";

/** How many characters a party can ever hold — the number of slots `RescueEncounter` recruits fill up toward. */
export const MAX_PARTY_SIZE = 4;

/**
 * The party, up to four members (docs/03-party-and-characters.md#party-structure).
 * A run starts with just one (docs/03-party-and-characters.md#party-creation-vs-pre-generated)
 * and grows via `addMember` as `RescueEncounter`s are found — every
 * method here already iterates `members` rather than assuming a fixed
 * length, so growing the array mid-run needs no special-casing. The
 * party moves as a single unit on the dungeon grid (that's still
 * `Player`) — this class is only about the characters themselves:
 * their stats, health, and rank.
 */
export class Party {
  constructor(public readonly members: Character[]) {}

  get isDefeated(): boolean {
    return this.members.every((member) => member.isDown);
  }

  livingMembers(): Character[] {
    return this.members.filter((member) => !member.isDown);
  }

  livingFrontRank(): Character[] {
    return this.livingMembers().filter((member) => member.rank === "front");
  }

  /** Adds a recruited character to the party. A no-op past `MAX_PARTY_SIZE` — callers (`RescueEncounter`) check first so they can report why nobody joined, but this guards against ever silently exceeding it either way. */
  addMember(character: Character): void {
    if (this.members.length >= MAX_PARTY_SIZE) return;
    this.members.push(character);
  }
}
