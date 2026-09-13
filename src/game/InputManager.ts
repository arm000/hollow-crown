export type Action =
  | "forward"
  | "backward"
  | "strafeLeft"
  | "strafeRight"
  | "turnLeft"
  | "turnRight"
  | "interact";

/** Every `Action` value, for callers (the options screen, `Settings` persistence) that need to iterate all of them rather than hardcode the union — e.g. `Game.persistSettings` reading `keyFor` back for each one. */
export const ACTIONS: Action[] = [
  "forward",
  "backward",
  "strafeLeft",
  "strafeRight",
  "turnLeft",
  "turnRight",
  "interact",
];

/** The out-of-the-box bindings — unchanged from before key rebinding existed (docs/08-roadmap-phases.md Phase 6). Several actions have two default keys (WASD plus arrow-key fallbacks); rebinding an action replaces *all* of its current keys with the one chosen, per `rebind`'s doc comment, so a rebound action ends up with exactly one key, not the new one layered on top of a stale default. */
const DEFAULT_KEY_TO_ACTION: Record<string, Action> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "backward",
  ArrowDown: "backward",
  KeyA: "strafeLeft",
  KeyD: "strafeRight",
  KeyQ: "turnLeft",
  KeyE: "turnRight",
  ArrowLeft: "turnLeft",
  ArrowRight: "turnRight",
  Space: "interact",
};

/**
 * Turns input events into a small FIFO queue of discrete grid actions.
 * Keyboard key repeat is ignored — one press queues exactly one step or
 * turn — which keeps quick taps responsive while a held key doesn't
 * flood the queue with a move the player never asked to repeat.
 *
 * This is the single input pipeline for the whole game: keyboard is one
 * producer into the queue, on-screen touch controls (see
 * `TouchControls`) are another, both via `push()`. Nothing downstream
 * needs to know which one produced an action.
 */
export class InputManager {
  private readonly keyToAction: Map<string, Action>;
  private queue: Action[] = [];

  /** `keyBindingOverrides` (action -> key code) is applied on top of the defaults — e.g. from `Settings.loadSettings()` — so a fresh install behaves exactly as it always did while a returning player's saved rebinds stick. */
  constructor(target: Window = window, keyBindingOverrides: Partial<Record<Action, string>> = {}) {
    this.keyToAction = new Map(Object.entries(DEFAULT_KEY_TO_ACTION) as Array<[string, Action]>);
    for (const [action, key] of Object.entries(keyBindingOverrides) as Array<[Action, string]>) {
      this.rebind(action, key);
    }

    target.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      const action = this.keyToAction.get(event.code);
      if (!action) return;
      event.preventDefault();
      this.push(action);
    });
  }

  /** Queues an action, e.g. from a touch control tap. */
  push(action: Action): void {
    this.queue.push(action);
  }

  /** Removes and returns the next queued action, if any. */
  next(): Action | undefined {
    return this.queue.shift();
  }

  /**
   * Drops everything queued so far. Keydown capture here is unconditional
   * -- this class has no idea whether `Game` is currently exploring, in
   * combat, or looking at a menu -- so whoever *does* know (`Game`) is
   * responsible for calling this on every transition away from or back
   * to exploring. Otherwise movement keys pressed while, say, the
   * inventory screen is open just sit in the queue and all fire at once,
   * one per frame, the moment exploration resumes.
   */
  clear(): void {
    this.queue = [];
  }

  /** Rebinds `action` to `key`, first removing every key currently mapped to it (including both of a default pair like W/ArrowUp) — an action always resolves to exactly the key(s) explicitly chosen from here on, not the new one layered on top of stale defaults. */
  rebind(action: Action, key: string): void {
    for (const [existingKey, existingAction] of this.keyToAction) {
      if (existingAction === action) this.keyToAction.delete(existingKey);
    }
    this.keyToAction.set(key, action);
  }

  /** The key currently bound to `action`, for an options screen to display. If more than one key maps to it (an untouched default pair), returns whichever was inserted first — good enough to show "the" binding, not an exhaustive list. */
  keyFor(action: Action): string | undefined {
    for (const [key, boundAction] of this.keyToAction) {
      if (boundAction === action) return key;
    }
    return undefined;
  }
}
