import type { Character } from "./Character";

/**
 * The four-member party (docs/03-party-and-characters.md#party-structure).
 * The party moves as a single unit on the dungeon grid (that's still
 * `Player`) — this class is only about the four characters themselves:
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
}
