import { describe, expect, it } from "vitest";
import { StatusEffectSet } from "./StatusEffect";

describe("StatusEffectSet", () => {
  it("has no effects initially", () => {
    const effects = new StatusEffectSet();
    expect(effects.has("stun")).toBe(false);
    expect(effects.list()).toEqual([]);
  });

  it("has an effect once applied", () => {
    const effects = new StatusEffectSet();
    effects.apply({ type: "stun", turnsRemaining: 1 });
    expect(effects.has("stun")).toBe(true);
  });

  it("remove clears one specific effect", () => {
    const effects = new StatusEffectSet();
    effects.apply({ type: "stun", turnsRemaining: 1 });
    effects.apply({ type: "fear", turnsRemaining: 1 });
    effects.remove("stun");
    expect(effects.has("stun")).toBe(false);
    expect(effects.has("fear")).toBe(true);
  });

  it("clearAll removes every effect at once", () => {
    const effects = new StatusEffectSet();
    effects.apply({ type: "stun", turnsRemaining: 1 });
    effects.apply({ type: "poison", turnsRemaining: 3, tickDamage: 2 });
    effects.clearAll();
    expect(effects.list()).toEqual([]);
  });

  it("tick sums damage-over-time across all DoT effects", () => {
    const effects = new StatusEffectSet();
    effects.apply({ type: "poison", turnsRemaining: 2, tickDamage: 2 });
    effects.apply({ type: "bleed", turnsRemaining: 2, tickDamage: 3 });
    expect(effects.tick()).toBe(5);
  });

  it("tick returns 0 for effects with no tick damage (stun/fear/silence)", () => {
    const effects = new StatusEffectSet();
    effects.apply({ type: "stun", turnsRemaining: 2 });
    expect(effects.tick()).toBe(0);
  });

  it("an effect expires once its duration reaches zero", () => {
    const effects = new StatusEffectSet();
    effects.apply({ type: "stun", turnsRemaining: 1 });
    effects.tick();
    expect(effects.has("stun")).toBe(false);
  });

  it("an effect with more than one turn remaining survives a tick", () => {
    const effects = new StatusEffectSet();
    effects.apply({ type: "bleed", turnsRemaining: 2, tickDamage: 3 });
    effects.tick();
    expect(effects.has("bleed")).toBe(true);
    effects.tick();
    expect(effects.has("bleed")).toBe(false);
  });

  it("re-applying an effect refreshes its duration rather than stacking", () => {
    const effects = new StatusEffectSet();
    effects.apply({ type: "bleed", turnsRemaining: 1, tickDamage: 3 });
    effects.apply({ type: "bleed", turnsRemaining: 2, tickDamage: 3 });
    expect(effects.tick()).toBe(3); // one tick's worth, not doubled
    expect(effects.has("bleed")).toBe(true); // still has a turn left from the refresh
  });
});
