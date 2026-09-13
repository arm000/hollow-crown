import { describe, expect, it } from "vitest";
import { applyResistance, resistanceMultiplier } from "./DamageType";

describe("resistanceMultiplier", () => {
  it("is neutral (1) for an unlisted damage type", () => {
    expect(resistanceMultiplier({ fire: 2 }, "physical")).toBe(1);
  });

  it("is neutral (1) with no resistance map at all", () => {
    expect(resistanceMultiplier(undefined, "physical")).toBe(1);
  });

  it("returns the listed multiplier for a resisted or weak type", () => {
    expect(resistanceMultiplier({ physical: 0.5, fire: 2 }, "physical")).toBe(0.5);
    expect(resistanceMultiplier({ physical: 0.5, fire: 2 }, "fire")).toBe(2);
  });
});

describe("applyResistance", () => {
  it("halves damage against a 0.5 resistance", () => {
    expect(applyResistance(10, { physical: 0.5 }, "physical")).toBe(5);
  });

  it("doubles damage against a weakness", () => {
    expect(applyResistance(10, { fire: 2 }, "fire")).toBe(20);
  });

  it("leaves damage unchanged with no resistance entry", () => {
    expect(applyResistance(7, {}, "physical")).toBe(7);
  });

  it("never returns negative damage", () => {
    expect(applyResistance(1, { physical: -5 }, "physical")).toBe(0);
  });

  it("rounds to a whole number", () => {
    expect(applyResistance(7, { physical: 0.5 }, "physical")).toBe(4); // 3.5 rounds to 4
  });
});
