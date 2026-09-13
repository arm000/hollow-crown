import type { Monster } from "../monster/Monster";
import type { Character } from "../party/Character";
import type { Party } from "../party/Party";
import { rollInt, type Rng } from "../Rng";

export type CombatActionChoice = "attack" | "defend" | "flee";
export type CombatResult = "ongoing" | "victory" | "defeat" | "fled";
export type Combatant = Character | Monster;

/**
 * Resolves one encounter turn-by-turn: initiative order, Attack/Defend/
 * Flee (Ability/Item wait for Phase 3), and the monster's AI turn — see
 * docs/05-combat.md. Zero rendering/DOM dependency, per
 * docs/11-testing-strategy.md, so a headless test can drive an entire
 * fight the same way `Game` does.
 */
export class CombatEngine {
  readonly log: string[] = [];
  result: CombatResult = "ongoing";

  private turnOrder: Combatant[] = [];
  private turnIndex = 0;
  private readonly defending = new Set<Character>();

  constructor(
    private readonly party: Party,
    private readonly monster: Monster,
    private readonly rng: Rng,
  ) {
    this.rollInitiative();
    this.resolveAutomaticTurns();
  }

  get currentActor(): Combatant {
    return this.turnOrder[this.turnIndex];
  }

  get isPartyTurn(): boolean {
    return this.result === "ongoing" && this.currentActor.side === "party";
  }

  /** The still-living combatants in this round's turn order, for a combat UI to show. */
  get turnQueue(): Combatant[] {
    return this.turnOrder;
  }

  /** Applies `choice` for whoever's turn it currently is (must be a party member's turn). */
  submitAction(choice: CombatActionChoice): void {
    if (!this.isPartyTurn) return;
    const actor = this.currentActor as Character;
    this.defending.delete(actor); // Defend lasts until this character's next action, which is now.

    switch (choice) {
      case "attack": {
        const damage = actor.stats.might + rollInt(this.rng, 1, 4);
        this.monster.takeDamage(damage);
        this.log.push(`${actor.name} attacks for ${damage} damage.`);
        if (this.monster.isDown) {
          this.result = "victory";
          this.log.push(`${this.monster.name} is defeated!`);
          return;
        }
        break;
      }
      case "defend": {
        this.defending.add(actor);
        this.log.push(`${actor.name} braces to defend.`);
        break;
      }
      case "flee": {
        const chance = 30 + actor.stats.resolve * 5;
        if (rollInt(this.rng, 1, 100) <= chance) {
          this.result = "fled";
          this.log.push(`${actor.name} leads the party in a hasty retreat!`);
          return;
        }
        this.log.push(`${actor.name} tries to flee, but can't get clear!`);
        break;
      }
    }

    this.advanceToNextLivingActor();
    this.resolveAutomaticTurns();
  }

  private rollInitiative(): void {
    this.defending.clear();
    const combatants: Combatant[] = [...this.party.livingMembers(), this.monster];
    const scored = combatants.map((combatant) => ({
      combatant,
      score: combatant.initiativeStat + rollInt(this.rng, 1, 6),
    }));
    scored.sort((a, b) => b.score - a.score);
    this.turnOrder = scored.map((entry) => entry.combatant);
    this.turnIndex = 0;
  }

  /** Moves to the next combatant still able to act, re-rolling initiative for a new round once the order is exhausted. */
  private advanceToNextLivingActor(): void {
    for (;;) {
      this.turnIndex++;
      if (this.turnIndex >= this.turnOrder.length) {
        this.rollInitiative();
      }
      const actor = this.turnOrder[this.turnIndex];
      if (actor.side === "party" && actor.isDown) continue;
      return;
    }
  }

  /** Runs the monster's turn(s) automatically whenever it's up, so control only ever returns to the caller on a party member's turn. */
  private resolveAutomaticTurns(): void {
    while (this.result === "ongoing" && this.currentActor.side === "monster") {
      this.runMonsterTurn();
      if (this.result !== "ongoing") return;
      this.advanceToNextLivingActor();
    }
  }

  private runMonsterTurn(): void {
    const action = this.monster.takeCombatTurn(this.rng);
    this.log.push(action.message);

    const target = this.pickTarget();
    const defended = this.defending.has(target);
    const dealt = defended ? Math.ceil(action.damage / 2) : action.damage;
    target.takeDamage(dealt);
    this.log.push(`${target.name} takes ${dealt} damage${defended ? " (defended)" : ""}.`);

    if (this.party.isDefeated) {
      this.result = "defeat";
    }
  }

  /** Melee targets the front rank while any front-rank member stands, per docs/05-combat.md#targeting--rank. */
  private pickTarget(): Character {
    const front = this.party.livingFrontRank();
    const pool = front.length > 0 ? front : this.party.livingMembers();
    return pool[Math.floor(this.rng.next() * pool.length)];
  }
}
