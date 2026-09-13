import type { Monster } from "../monster/Monster";
import { CLASS_ABILITIES } from "../party/classes";
import type { Character } from "../party/Character";
import type { Party } from "../party/Party";
import { rollInt, type Rng } from "../Rng";
import { applyResistance } from "./DamageType";

export type CombatActionChoice = "attack" | "defend" | "flee" | "ability";
export type CombatResult = "ongoing" | "victory" | "defeat" | "fled";
export type Combatant = Character | Monster;

const BLEED_DURATION = 2;
const BLEED_TICK_DAMAGE = 3;

/**
 * Resolves one encounter turn-by-turn: initiative order, Attack/Defend/
 * Flee/Ability (Item arrives with Phase 3's equipment/consumables batch),
 * and the monster's AI turn — see docs/05-combat.md. Zero rendering/DOM
 * dependency, per docs/11-testing-strategy.md, so a headless test can
 * drive an entire fight the same way `Game` does.
 */
export class CombatEngine {
  readonly log: string[] = [];
  result: CombatResult = "ongoing";

  private turnOrder: Combatant[] = [];
  private turnIndex = 0;
  private readonly defending = new Set<Character>();
  /** Set by Warrior's Guard — the monster's next attack targets this character instead of the normal pick. */
  private tauntedBy: Character | undefined;

  constructor(
    private readonly party: Party,
    private readonly monster: Monster,
    private readonly rng: Rng,
  ) {
    this.rollInitiative(false); // first round: nothing has ticked yet
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
    this.defending.delete(actor); // Defend/Guard last until this character's next action, which is now.

    if (actor.statusEffects.has("fear") && choice !== "defend") {
      this.defending.add(actor); // forced to Defend instead of acting, per docs/05-combat.md#status-effects
      this.log.push(`${actor.name} is too afraid to do anything but brace!`);
      this.finishPartyTurn();
      return;
    }

    switch (choice) {
      case "attack": {
        const rawDamage = actor.effectiveStats.might + rollInt(this.rng, 1, 4);
        const damage = applyResistance(rawDamage, this.monster.resistances, "physical");
        this.monster.takeDamage(damage);
        this.log.push(`${actor.name} attacks for ${damage} damage.`);
        break;
      }
      case "defend": {
        this.defending.add(actor);
        this.log.push(`${actor.name} braces to defend.`);
        break;
      }
      case "ability": {
        this.resolveAbility(actor);
        break;
      }
      case "flee": {
        const chance = 30 + actor.effectiveStats.resolve * 5;
        if (rollInt(this.rng, 1, 100) <= chance) {
          this.result = "fled";
          this.log.push(`${actor.name} leads the party in a hasty retreat!`);
          return;
        }
        this.log.push(`${actor.name} tries to flee, but can't get clear!`);
        break;
      }
    }

    if (this.monster.isDown) {
      this.result = "victory";
      this.log.push(`${this.monster.name} is defeated!`);
      return;
    }

    this.finishPartyTurn();
  }

  private finishPartyTurn(): void {
    this.advanceToNextLivingActor();
    this.resolveAutomaticTurns();
  }

  private resolveAbility(actor: Character): void {
    const ability = CLASS_ABILITIES[actor.classId];

    if (actor.statusEffects.has("silence")) {
      this.log.push(`${actor.name} tries to use ${ability.name}, but the silence swallows it!`);
      return;
    }
    if (actor.mana < ability.manaCost) {
      this.log.push(`${actor.name} doesn't have enough mana for ${ability.name}.`);
      return;
    }
    actor.mana -= ability.manaCost;

    switch (actor.classId) {
      case "warrior": {
        this.tauntedBy = actor;
        this.defending.add(actor);
        this.log.push(`${actor.name} bellows a challenge, daring ${this.monster.name} to strike!`);
        break;
      }
      case "rogue": {
        const rawDamage = actor.effectiveStats.might + rollInt(this.rng, 1, 4) + 2;
        this.monster.takeDamage(rawDamage); // ignores resistance entirely -- that's the point
        this.monster.statusEffects.apply({ type: "bleed", turnsRemaining: BLEED_DURATION, tickDamage: BLEED_TICK_DAMAGE });
        this.log.push(`${actor.name}'s Precision Strike finds a weak point for ${rawDamage} damage and draws blood!`);
        break;
      }
      case "mage": {
        const rawDamage = actor.effectiveStats.focus + rollInt(this.rng, 1, 6);
        const damage = applyResistance(rawDamage, this.monster.resistances, "fire");
        this.monster.takeDamage(damage);
        this.log.push(`${actor.name} hurls a Firebolt for ${damage} fire damage.`);
        break;
      }
      case "cleric": {
        const target = this.pickCleanseTarget(actor);
        const hadEffects = target.statusEffects.list().length > 0;
        target.statusEffects.clearAll();
        this.log.push(
          hadEffects ? `${actor.name} cleanses ${target.name}.` : `${actor.name} finds nothing to cleanse.`,
        );
        break;
      }
    }
  }

  private pickCleanseTarget(caster: Character): Character {
    let best = caster;
    let bestCount = caster.statusEffects.list().length;
    for (const candidate of this.party.livingMembers()) {
      const count = candidate.statusEffects.list().length;
      if (count > bestCount) {
        best = candidate;
        bestCount = count;
      }
    }
    return best;
  }

  /** Rolls a fresh turn order. Only ticks status effects (DoT + duration countdown) when `tickEffects` is true — i.e. an actual round just finished — never for the very first round, or a 1-turn effect (Stun, say) would expire before it ever got to block anything. */
  private rollInitiative(tickEffects: boolean): void {
    this.defending.clear();
    const combatants: Combatant[] = [...this.party.livingMembers(), this.monster];

    if (tickEffects) {
      for (const combatant of combatants) {
        const dotDamage = combatant.statusEffects.tick();
        if (dotDamage > 0) {
          combatant.takeDamage(dotDamage);
          this.log.push(`${combatant.name} takes ${dotDamage} damage from lingering wounds.`);
        }
      }
      if (this.monster.isDown) {
        this.result = "victory";
        return;
      }
      if (this.party.isDefeated) {
        this.result = "defeat";
        return;
      }
    }

    const scored = combatants.map((combatant) => ({
      combatant,
      score: combatant.initiativeStat + rollInt(this.rng, 1, 6),
    }));
    scored.sort((a, b) => b.score - a.score);
    this.turnOrder = scored.map((entry) => entry.combatant);
    this.turnIndex = 0;
  }

  /** Moves to the next combatant still able to act, rolling a new round (ticking status effects for the round that just ended) once the order is exhausted. */
  private advanceToNextLivingActor(): void {
    for (;;) {
      this.turnIndex++;
      if (this.turnIndex >= this.turnOrder.length) {
        this.rollInitiative(true);
        if (this.result !== "ongoing") return;
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
    if (this.monster.statusEffects.has("stun")) {
      this.log.push(`${this.monster.name} is stunned and can't act!`);
      return;
    }

    const action = this.monster.takeCombatTurn(this.rng);
    this.log.push(action.message);

    const target = this.pickTarget();
    const defended = this.defending.has(target);
    const baseDamage = defended ? Math.ceil(action.damage / 2) : action.damage;
    const dealt = applyResistance(baseDamage, target.effectiveResistances, "physical");
    target.takeDamage(dealt);
    this.log.push(`${target.name} takes ${dealt} damage${defended ? " (defended)" : ""}.`);

    if (this.party.isDefeated) {
      this.result = "defeat";
    }
  }

  /** Melee targets whoever's taunting it, else the front rank while any front-rank member stands, per docs/05-combat.md#targeting--rank. */
  private pickTarget(): Character {
    if (this.tauntedBy && !this.tauntedBy.isDown) {
      const target = this.tauntedBy;
      this.tauntedBy = undefined;
      return target;
    }
    const front = this.party.livingFrontRank();
    const pool = front.length > 0 ? front : this.party.livingMembers();
    return pool[Math.floor(this.rng.next() * pool.length)];
  }
}
