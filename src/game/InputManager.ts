export type Action =
  | "forward"
  | "backward"
  | "strafeLeft"
  | "strafeRight"
  | "turnLeft"
  | "turnRight";

const KEY_TO_ACTION: Record<string, Action> = {
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
};

/**
 * Turns keydown events into a small FIFO queue of discrete grid actions.
 * Key repeat is ignored — one press queues exactly one step or turn —
 * which keeps quick taps responsive while a held key doesn't flood
 * the queue with a move the player never asked to repeat.
 */
export class InputManager {
  private queue: Action[] = [];

  constructor(target: Window = window) {
    target.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      const action = KEY_TO_ACTION[event.code];
      if (!action) return;
      event.preventDefault();
      this.queue.push(action);
    });
  }

  /** Removes and returns the next queued action, if any. */
  next(): Action | undefined {
    return this.queue.shift();
  }
}
