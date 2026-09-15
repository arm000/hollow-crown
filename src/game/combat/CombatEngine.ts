import type { Inventory } from "../Inventory";
import type { Monster } from "../monster/Monster";
import type { Character } from "../party/Character";
import type { Party } from "../party/Party";
import { defaultSkillId, SKILLS } from "../party/Skills";
import { rollInt, type Rng } from "../Rng";
import { CONSUMABLE_ITEMS } from "./Consumable";
import { applyResistance } from "./DamageType";

export type CombatActionChoice = "attack" | "defend" | "flee" | "ability" | "item";
export type CombatResult = "ongoing" | "victory" | "defeat" | "fled";
export type Combatant = Character | Monster;

const BLEED_DURATION = 2;
const BLEED_TICK_DAMAGE = 3;
/** Warrior's Second Wind: a third of max HP, rounded to the nearest whole point. */
const SECOND_WIND_FRACTION = 1 / 3;
/** Warrior's Rally Cry: a flat heal per living party member, deliberately smaller per-target than Second Wind's own since it lands on everyone at once. */
const RALLY_CRY_HEAL = 6;
/** Rogue's Ambush: bonus flat damage added only while the target hasn't taken any damage yet this fight. */
const AMBUSH_BONUS = 8;
/** Rogue's Feint: an immediate flee attempt, better odds than a plain Flee's `30 + resolve*5` but deliberately short of Smoke Bomb's guaranteed 100% -- a tier-1 taste of the same escape identity Smoke Bomb (tier 2, unlockCost 8) later perfects. */
const FEINT_FLEE_BONUS = 25;

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
  /**
   * Cleric's Ward: deliberately a *separate* set from `defending`, not
   * just Ward adding to that one too. `defending` clears the instant
   * its owner's own next turn starts (see `submitAction`'s
   * `this.defending.delete(actor)`) — exactly right for self-Defend/
   * Guard, since a character can never act again before facing the
   * monster's next turn first. Ward is cast *on someone else*, though,
   * and that ally's own turn often comes up before the monster's does
   * — reusing `defending` would let it get silently cleared by the
   * target's own action before ever blocking a hit. `warded` instead
   * only ever clears when the monster's attack actually consumes it
   * (`runMonsterTurn`) or a new round starts (`rollInitiative`), never
   * on the target's own turn.
   */
  private readonly warded = new Set<Character>();
  /** Set by Warrior's Guard — the monster's next attack targets this character instead of the normal pick. */
  private tauntedBy: Character | undefined;

  constructor(
    private readonly party: Party,
    private readonly monster: Monster,
    private readonly rng: Rng,
    private readonly inventory?: Inventory,
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

  /**
   * `turnQueue`'s current position (docs/08-roadmap-phases.md Phase 6's
   * initiative tracker, added on a player request to "plan ahead"): 0
   * is whoever acted first this round. A combat UI zips this together
   * with `turnQueue` to show the round as past/current/upcoming, so the
   * party can see the monster's turn coming and decide whether to
   * Defend now rather than after the fact.
   */
  get currentTurnIndex(): number {
    return this.turnIndex;
  }

  /**
   * Applies `choice` for whoever's turn it currently is (must be a
   * party member's turn). `itemId` is required for, and only used by,
   * the "item" choice. `skillId` is only used by "ability" — omitted,
   * it falls back to the actor's class's original default skill (see
   * `resolveAbility`), which is what every existing single-skill-per-class
   * caller (this engine's own tests included) still means by a bare
   * "ability" choice; `CombatUI` always passes one explicitly once a
   * character can know more than one.
   */
  submitAction(choice: CombatActionChoice, itemId?: string, skillId?: string): void {
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
        this.resolveAbility(actor, skillId);
        break;
      }
      case "item": {
        this.resolveItem(actor, itemId);
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
    // A skill can end the fight outright without a kill -- Rogue's
    // Smoke Bomb sets "fled" directly from inside resolveAbility, the
    // same as a successful ordinary Flee already does. Either way,
    // nothing past this point (advancing the turn order, ticking
    // status effects for a round that no longer matters) should run.
    if (this.result !== "ongoing") return;

    this.finishPartyTurn();
  }

  private finishPartyTurn(): void {
    this.advanceToNextLivingActor();
    this.resolveAutomaticTurns();
  }

  /**
   * Resolves whichever skill `skillId` names, defaulting to the actor's
   * class's original signature skill when omitted (see `submitAction`'s
   * doc comment). Looked up against `SKILLS[actor.classId]` rather than
   * trusting `skillId` blindly, so a stale id from a UI bug can't ask
   * this engine to run another class's skill — the class boundary is
   * enforced here, not just by which buttons `CombatUI` happens to draw.
   */
  private resolveAbility(actor: Character, skillId: string | undefined): void {
    const resolvedId = skillId ?? defaultSkillId(actor.classId);
    const skill = SKILLS[actor.classId].find((candidate) => candidate.id === resolvedId);
    if (!skill) {
      this.log.push(`${actor.name} doesn't know that.`);
      return;
    }
    if (!actor.knowsSkill(skill.id)) {
      this.log.push(`${actor.name} hasn't learned ${skill.name} yet.`);
      return;
    }
    if (!actor.isSkillReady(skill.id)) {
      this.log.push(`${actor.name} can't use ${skill.name} again yet (${actor.cooldownRemaining(skill.id)} turn${actor.cooldownRemaining(skill.id) === 1 ? "" : "s"} left).`);
      return;
    }
    if (actor.statusEffects.has("silence")) {
      this.log.push(`${actor.name} tries to use ${skill.name}, but the silence swallows it!`);
      return;
    }
    if (actor.mana < skill.manaCost) {
      this.log.push(`${actor.name} doesn't have enough mana for ${skill.name}.`);
      return;
    }
    actor.mana -= skill.manaCost;
    actor.startCooldown(skill.id, skill.cooldown);

    switch (skill.id) {
      case "warrior-guard": {
        this.tauntedBy = actor;
        this.defending.add(actor);
        this.log.push(`${actor.name} bellows a challenge, daring ${this.monster.name} to strike!`);
        break;
      }
      case "warrior-secondWind": {
        const healed = Math.round(actor.maxHp * SECOND_WIND_FRACTION);
        actor.heal(healed);
        this.log.push(`${actor.name} catches a second wind, recovering ${healed} HP.`);
        break;
      }
      case "warrior-rallyCry": {
        let totalHealed = 0;
        for (const member of this.party.livingMembers()) {
          const before = member.hp;
          member.heal(RALLY_CRY_HEAL);
          totalHealed += member.hp - before;
          member.statusEffects.remove("fear");
        }
        this.log.push(`${actor.name} bellows a rally cry — the party steadies, healing ${totalHealed} HP total.`);
        break;
      }
      case "warrior-powerStrike": {
        const rawDamage = Math.round(actor.effectiveStats.might * 1.5) + rollInt(this.rng, 1, 6);
        const damage = applyResistance(rawDamage, this.monster.resistances, "physical");
        this.monster.takeDamage(damage);
        this.log.push(`${actor.name} lands a Power Strike for ${damage} damage.`);
        break;
      }
      case "rogue-precisionStrike": {
        const rawDamage = actor.effectiveStats.might + rollInt(this.rng, 1, 4) + 2;
        this.monster.takeDamage(rawDamage); // ignores resistance entirely -- that's the point
        this.monster.statusEffects.apply({ type: "bleed", turnsRemaining: BLEED_DURATION, tickDamage: BLEED_TICK_DAMAGE });
        this.log.push(`${actor.name}'s Precision Strike finds a weak point for ${rawDamage} damage and draws blood!`);
        break;
      }
      case "rogue-feint": {
        const chance = 30 + actor.effectiveStats.resolve * 5 + FEINT_FLEE_BONUS;
        if (rollInt(this.rng, 1, 100) <= chance) {
          // Same "set result, just break" pattern as Smoke Bomb below --
          // submitAction's own post-switch check already stops short
          // the moment `result` isn't "ongoing" anymore.
          this.result = "fled";
          this.log.push(`${actor.name} spots an opening — the party slips away!`);
        } else {
          this.log.push(`${actor.name} tries to create an opening, but ${this.monster.name} doesn't bite.`);
        }
        break;
      }
      case "rogue-smokeBomb": {
        this.result = "fled";
        this.log.push(`${actor.name} cracks a smoke bomb underfoot — the party vanishes into the haze!`);
        break;
      }
      case "rogue-ambush": {
        const isFirstStrike = this.monster.hp === this.monster.maxHp;
        const rawDamage = actor.effectiveStats.might + rollInt(this.rng, 1, 6) + (isFirstStrike ? AMBUSH_BONUS : 0);
        const damage = applyResistance(rawDamage, this.monster.resistances, "physical");
        this.monster.takeDamage(damage);
        this.log.push(
          isFirstStrike
            ? `${actor.name} ambushes ${this.monster.name} before it can react for ${damage} damage!`
            : `${actor.name} strikes for ${damage} damage — the moment for an ambush has passed.`,
        );
        break;
      }
      case "mage-firebolt": {
        const rawDamage = actor.effectiveStats.focus + rollInt(this.rng, 1, 6);
        const damage = applyResistance(rawDamage, this.monster.resistances, "fire");
        this.monster.takeDamage(damage);
        this.log.push(`${actor.name} hurls a Firebolt for ${damage} fire damage.`);
        break;
      }
      case "mage-arcaneBarrier": {
        this.warded.add(actor);
        this.log.push(`${actor.name} raises a shimmering arcane barrier, ready to blunt the next blow.`);
        break;
      }
      case "mage-frostLance": {
        const rawDamage = Math.ceil(actor.effectiveStats.focus / 2) + rollInt(this.rng, 1, 3);
        const damage = applyResistance(rawDamage, this.monster.resistances, "physical");
        this.monster.takeDamage(damage);
        this.monster.statusEffects.apply({ type: "stun", turnsRemaining: 1 });
        this.log.push(`${actor.name}'s Frost Lance deals ${damage} damage and freezes ${this.monster.name} solid!`);
        break;
      }
      case "mage-cinderNova": {
        const rawDamage = Math.round(actor.effectiveStats.focus * 1.5) + rollInt(this.rng, 1, 8);
        const damage = applyResistance(rawDamage, this.monster.resistances, "fire");
        this.monster.takeDamage(damage);
        this.log.push(`${actor.name} unleashes a Cinder Nova, scorching ${this.monster.name} for ${damage} fire damage!`);
        break;
      }
      case "cleric-cleanse": {
        const target = this.pickCleanseTarget(actor);
        const hadEffects = target.statusEffects.list().length > 0;
        target.statusEffects.clearAll();
        this.log.push(
          hadEffects ? `${actor.name} cleanses ${target.name}.` : `${actor.name} finds nothing to cleanse.`,
        );
        break;
      }
      case "cleric-radiantSpark": {
        const rawDamage = Math.ceil(actor.effectiveStats.focus / 2) + rollInt(this.rng, 1, 4);
        const damage = applyResistance(rawDamage, this.monster.resistances, "holy");
        this.monster.takeDamage(damage);
        this.log.push(`${actor.name} calls down a Radiant Spark for ${damage} holy damage.`);
        break;
      }
      case "cleric-smite": {
        const rawDamage = actor.effectiveStats.focus + rollInt(this.rng, 1, 4);
        const damage = applyResistance(rawDamage, this.monster.resistances, "holy");
        this.monster.takeDamage(damage);
        this.log.push(`${actor.name} smites ${this.monster.name} for ${damage} holy damage.`);
        break;
      }
      case "cleric-ward": {
        const target = this.pickWardTarget();
        this.warded.add(target);
        this.log.push(`${actor.name} wards ${target.name}, ready to blunt the next blow.`);
        break;
      }
    }
  }

  /** Uses a consumable on `actor` — cure items target the user; there's no ally-targeting UI yet (docs/06-items-and-equipment.md#combat-countering-consumables). */
  private resolveItem(actor: Character, itemId: string | undefined): void {
    const item = itemId ? CONSUMABLE_ITEMS[itemId] : undefined;
    if (!item || !this.inventory) {
      this.log.push(`${actor.name} has nothing usable to hand.`);
      return;
    }
    if (!this.inventory.consume(itemId!)) {
      this.log.push(`${actor.name} reaches for ${item.name}, but there's none left.`);
      return;
    }
    // Using it *is* the identification moment (docs/06-items-and-equipment.md's
    // "identified by use") -- the log below already names it truthfully
    // regardless; this is what makes the inventory/combat-item lists
    // stop showing the mystery name for any stock still held.
    this.inventory.identify(itemId!);

    if (item.effect.kind === "cure") {
      const hadEffect = actor.statusEffects.has(item.effect.status);
      actor.statusEffects.remove(item.effect.status);
      // Always names the status, "nothing to cure" outcome included --
      // player request: an item's real properties should be learnable
      // "from then on" once used, and a use that happens to land on
      // someone without the status would otherwise never actually say
      // what the item is *for*.
      this.log.push(
        hadEffect
          ? `${actor.name} uses ${item.name} — the ${item.effect.status} fades.`
          : `${actor.name} uses ${item.name}, but there's no ${item.effect.status} to cure.`,
      );
    } else {
      const damage = applyResistance(item.effect.amount, this.monster.resistances, item.effect.damageType);
      this.monster.takeDamage(damage);
      this.log.push(`${actor.name} uses ${item.name} for ${damage} ${item.effect.damageType} damage.`);
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

  /** Ward's target: whoever's proportionally lowest on HP, the living party member likeliest to actually need the protection — a different heuristic than `pickCleanseTarget`'s "most afflicted," since HP and status effects aren't the same kind of trouble. */
  private pickWardTarget(): Character {
    const living = this.party.livingMembers();
    let best = living[0];
    let bestRatio = best.hp / best.maxHp;
    for (const candidate of living) {
      const ratio = candidate.hp / candidate.maxHp;
      if (ratio < bestRatio) {
        best = candidate;
        bestRatio = ratio;
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
          // The monster's own HP is already shown persistently
          // elsewhere (CombatUI.statusEl), so the "X/Y HP left" note
          // (player request: "list how much current HP they have
          // left") is only worth repeating in the log for a party
          // member -- the one place that number isn't already on
          // screen at a glance mid-fight.
          const hpNote = combatant.side === "party" ? ` — ${combatant.hp}/${combatant.maxHp} HP left` : "";
          this.log.push(`${combatant.name} takes ${dotDamage} damage from lingering wounds${hpNote}.`);
        }
      }
      // Skill cooldowns tick the same round boundary status effects do
      // -- monsters have none of their own (only `Character` tracks
      // skill cooldowns), so this is its own loop over party members
      // rather than folded into the combatants loop above.
      for (const member of this.party.livingMembers()) member.tickCooldowns();
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

    // A self-heal turn (the Court Alchemist's "heavy" slot) has no
    // target at all -- Monster.takeCombatTurn already logged what
    // happened via action.message, there's nothing more to resolve.
    if (action.damage <= 0) return;

    const target = this.pickTarget();
    // Ward is consumed right here, by the hit it was cast to blunt --
    // not by any turn boundary, unlike `defending` (see `warded`'s doc
    // comment on the field).
    const warded = this.warded.delete(target);
    const defended = this.defending.has(target) || warded;
    const baseDamage = defended ? Math.ceil(action.damage / 2) : action.damage;
    const dealt = applyResistance(baseDamage, target.effectiveResistances, "physical");
    target.takeDamage(dealt);
    // Player request: "list how much current HP they have left" --
    // `target` is always a party member here (the monster's own HP is
    // already shown persistently in CombatUI.statusEl, not repeated
    // per hit in the log).
    this.log.push(
      `${target.name} takes ${dealt} damage${defended ? " (defended)" : ""} — ${target.hp}/${target.maxHp} HP left.`,
    );

    if (action.statusEffect) {
      target.statusEffects.apply(action.statusEffect);
      this.log.push(`${target.name} is overcome with ${action.statusEffect.type}!`);
    }

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
