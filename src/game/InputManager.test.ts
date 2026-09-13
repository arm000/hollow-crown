import { describe, expect, it, vi } from "vitest";
import { InputManager } from "./InputManager";

/**
 * A minimal stand-in for `Window` that only implements what InputManager
 * actually uses, so these tests run in plain Node with no DOM/browser
 * involved — no jsdom, no `window` global.
 */
class FakeEventTarget {
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  addEventListener(type: string, listener: (event: unknown) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }

  dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }
}

function fakeKeydown(code: string, repeat = false) {
  return { code, repeat, preventDefault: vi.fn() };
}

describe("InputManager", () => {
  it("queues actions in FIFO order via push()", () => {
    const input = new InputManager(new FakeEventTarget() as unknown as Window);
    input.push("forward");
    input.push("turnLeft");
    expect(input.next()).toBe("forward");
    expect(input.next()).toBe("turnLeft");
    expect(input.next()).toBeUndefined();
  });

  it("maps a known keydown to its action and prevents the default", () => {
    const target = new FakeEventTarget();
    const input = new InputManager(target as unknown as Window);
    const event = fakeKeydown("KeyW");

    target.dispatch("keydown", event);

    expect(input.next()).toBe("forward");
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("ignores an unmapped key entirely", () => {
    const target = new FakeEventTarget();
    const input = new InputManager(target as unknown as Window);
    const event = fakeKeydown("KeyZ");

    target.dispatch("keydown", event);

    expect(input.next()).toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("ignores a repeated keydown so holding a key doesn't flood the queue", () => {
    const target = new FakeEventTarget();
    const input = new InputManager(target as unknown as Window);

    target.dispatch("keydown", fakeKeydown("KeyW", false));
    target.dispatch("keydown", fakeKeydown("KeyW", true));
    target.dispatch("keydown", fakeKeydown("KeyW", true));

    expect(input.next()).toBe("forward");
    expect(input.next()).toBeUndefined();
  });

  it("maps ArrowUp/ArrowDown the same as W/S (forward/backward)", () => {
    const target = new FakeEventTarget();
    const input = new InputManager(target as unknown as Window);

    target.dispatch("keydown", fakeKeydown("KeyW"));
    target.dispatch("keydown", fakeKeydown("ArrowUp"));
    target.dispatch("keydown", fakeKeydown("KeyS"));
    target.dispatch("keydown", fakeKeydown("ArrowDown"));

    expect(input.next()).toBe("forward");
    expect(input.next()).toBe("forward");
    expect(input.next()).toBe("backward");
    expect(input.next()).toBe("backward");
  });

  it("clear() drops everything queued so far", () => {
    const input = new InputManager(new FakeEventTarget() as unknown as Window);
    input.push("forward");
    input.push("turnLeft");

    input.clear();

    expect(input.next()).toBeUndefined();
  });

  it("maps ArrowLeft/ArrowRight the same as Q/E (turn), not A/D (strafe)", () => {
    // A deliberate asymmetry in the key map: A/D strafe, but the arrow
    // keys mirror the dedicated turn keys instead of strafe.
    const target = new FakeEventTarget();
    const input = new InputManager(target as unknown as Window);

    target.dispatch("keydown", fakeKeydown("KeyQ"));
    target.dispatch("keydown", fakeKeydown("ArrowLeft"));
    target.dispatch("keydown", fakeKeydown("KeyE"));
    target.dispatch("keydown", fakeKeydown("ArrowRight"));

    expect(input.next()).toBe("turnLeft");
    expect(input.next()).toBe("turnLeft");
    expect(input.next()).toBe("turnRight");
    expect(input.next()).toBe("turnRight");
  });
});
