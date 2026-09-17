import { applyResistance, type DamageType } from "../combat/DamageType";
import type { StatusEffectInstance } from "../combat/StatusEffect";
import type { InteractionContext, Interactable } from "./types";

/**
 * A hazard tile, invisible until triggered — docs/04-exploration-and-world.md's
 * long-planned "Pit / hazard tile: ... damages on entry unless
 * disarmed" interactable, finally built (player request: "each dungeon
 * level should be ... [have] increasingly difficult monsters and
 * traps"). Deliberately renders with no mesh at all (see
 * `InteractableMesh.ts`'s `default` case) — a trap you can see coming
 * isn't a trap, it's a floor decoration.
 *
 * **Single-target only, on purpose**: unlike a monster's attack, there
 * is no defeat-screen check anywhere in exploration (`GameLogic.ts` has
 * none — only `CombatEngine` ever resolves `Party.isDefeated`), so a
 * trap that could ever hit the *whole* party at once could theoretically
 * zero every member simultaneously with nothing to catch it, softlocking
 * a run with no fight to end and no defeat screen to show. Always hits
 * whoever's leading (the front rank, or anyone if the front rank has
 * fallen) — the same "someone specific gets hurt, not everyone" shape
 * every monster attack already has.
 *
 * **The Rogue's documented job is trap disarm**
 * (docs/03-party-and-characters.md's class table: "handles lockpicking
 * & trap disarm out of combat") — made literal here the same
 * deterministic way `ClassGate` already makes "Rogue handles
 * lockpicking" literal: a living Rogue in the party disarms every trap
 * automatically, no roll, no separate interact action. Exploration
 * stays fully deterministic end to end (no other tile in the game rolls
 * dice) — this is a party-composition payoff, not a stealth mechanic.
 *
 * Fires once per level, like a real trap that's already been sprung —
 * re-entering the tile afterward does nothing, so backtracking through
 * an already-triggered corridor is never punished twice.
 */
export class Trap implements Interactable {
  readonly kind = "trap";
  private sprung = false;

  constructor(
    public x: number,
    public z: number,
    private readonly damageType: DamageType,
    private readonly amount: number,
    private readonly triggerMessage: string,
    private readonly statusEffect?: StatusEffectInstance,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  onEnter(ctx: InteractionContext): string | undefined {
    if (this.sprung) return undefined;
    this.sprung = true;

    const rogue = ctx.party.livingMembers().find((member) => member.classId === "rogue");
    if (rogue) {
      return `${rogue.name} spots the mechanism a heartbeat before it triggers and disarms it.`;
    }

    const target = ctx.party.livingFrontRank()[0] ?? ctx.party.livingMembers()[0];
    if (!target) return this.triggerMessage; // shouldn't happen (a run always ends before every member is down), but never crash exploration over it

    const parts = [this.triggerMessage];
    if (this.amount > 0) {
      const dealt = applyResistance(this.amount, target.effectiveResistances, this.damageType);
      target.takeDamage(dealt);
      parts.push(`${target.name} takes ${dealt} damage — ${target.hp}/${target.maxHp} HP left.`);
    }
    if (this.statusEffect) {
      target.statusEffects.apply(this.statusEffect);
      parts.push(`${target.name} is afflicted with ${this.statusEffect.type}!`);
    }
    return parts.join(" ");
  }
}
