/** Something that advances once per world turn — a monster's patrol/AI step, a timed hazard, etc. */
export interface Tickable {
  tick(): void;
}

/**
 * One player action (a step, a turn, an interact, or a combat action)
 * is one world turn — see docs/04-exploration-and-world.md#world-turns.
 * Everything registered here advances exactly once, in registration
 * order, right after the player's action resolves. This is what makes
 * monster movement read as turn-based rather than real-time, using the
 * same clock exploration already runs on.
 */
export class WorldClock {
  private readonly tickables: Tickable[] = [];

  register(tickable: Tickable): void {
    this.tickables.push(tickable);
  }

  unregister(tickable: Tickable): void {
    const index = this.tickables.indexOf(tickable);
    if (index !== -1) this.tickables.splice(index, 1);
  }

  /** Ticks every registered entity once, in registration order. */
  advance(): void {
    for (const tickable of this.tickables) tickable.tick();
  }
}
