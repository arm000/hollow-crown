import { describe, expect, it } from "vitest";
import { WorldClock, type Tickable } from "./WorldClock";

function spyTickable(): Tickable & { calls: number } {
  return {
    calls: 0,
    tick() {
      this.calls++;
    },
  };
}

describe("WorldClock", () => {
  it("ticks every registered entity once per advance", () => {
    const clock = new WorldClock();
    const a = spyTickable();
    const b = spyTickable();
    clock.register(a);
    clock.register(b);

    clock.advance();

    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });

  it("ticks in registration order", () => {
    const clock = new WorldClock();
    const order: string[] = [];
    clock.register({ tick: () => order.push("first") });
    clock.register({ tick: () => order.push("second") });

    clock.advance();

    expect(order).toEqual(["first", "second"]);
  });

  it("advancing multiple times ticks each entity once per advance", () => {
    const clock = new WorldClock();
    const a = spyTickable();
    clock.register(a);

    clock.advance();
    clock.advance();
    clock.advance();

    expect(a.calls).toBe(3);
  });

  it("stops ticking an unregistered entity", () => {
    const clock = new WorldClock();
    const a = spyTickable();
    clock.register(a);
    clock.unregister(a);

    clock.advance();

    expect(a.calls).toBe(0);
  });

  it("clear() unregisters everything at once", () => {
    const clock = new WorldClock();
    const a = spyTickable();
    const b = spyTickable();
    clock.register(a);
    clock.register(b);

    clock.clear();
    clock.advance();

    expect(a.calls).toBe(0);
    expect(b.calls).toBe(0);
  });

  it("clear() doesn't stop entities registered afterward", () => {
    const clock = new WorldClock();
    clock.clear(); // clearing an already-empty clock is a safe no-op
    const a = spyTickable();
    clock.register(a);

    clock.advance();

    expect(a.calls).toBe(1);
  });
});
