/**
 * The five status effects (docs/05-combat.md#status-effects). Built
 * generically here and fully wired into `CombatEngine`'s turn
 * resolution, but only Bleed has an actual in-game source this phase
 * (the Rogue's Precision Strike) — Poison/Stun/Fear/Silence await a
 * monster or item that inflicts them, arriving with later monster types
 * (docs/08-roadmap-phases.md Phase 4's Screeching Wraith for Fear, for
 * instance). The mechanics themselves are real and unit-tested now, not
 * placeholder — only their in-game application sources are staged.
 */
export type StatusEffectType = "poison" | "stun" | "bleed" | "fear" | "silence";

export interface StatusEffectInstance {
  type: StatusEffectType;
  /** How many more of this combatant's own rounds this effect is active for. */
  turnsRemaining: number;
  /** Damage dealt per round tick, for poison/bleed only. */
  tickDamage?: number;
}

export class StatusEffectSet {
  private readonly effects = new Map<StatusEffectType, StatusEffectInstance>();

  /** Applies (or refreshes, if already present) an effect. */
  apply(effect: StatusEffectInstance): void {
    this.effects.set(effect.type, { ...effect });
  }

  has(type: StatusEffectType): boolean {
    return this.effects.has(type);
  }

  remove(type: StatusEffectType): void {
    this.effects.delete(type);
  }

  /** Removes every active effect — Cleric's Cleanse. */
  clearAll(): void {
    this.effects.clear();
  }

  list(): StatusEffectInstance[] {
    return [...this.effects.values()];
  }

  /** Applies this round's damage-over-time and counts down every active effect's duration, dropping any that expire. Returns total DoT damage to apply. */
  tick(): number {
    let damage = 0;
    for (const effect of this.effects.values()) {
      if (effect.tickDamage) damage += effect.tickDamage;
      effect.turnsRemaining -= 1;
    }
    for (const [type, effect] of this.effects) {
      if (effect.turnsRemaining <= 0) this.effects.delete(type);
    }
    return damage;
  }
}
