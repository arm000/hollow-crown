import type { EntitySpawn, InteractionContext, Interactable } from "./types";
import { buildEntities } from "./buildEntities";

function key(x: number, z: number): string {
  return `${x},${z}`;
}

export interface EnterResult {
  message?: string;
  isExit: boolean;
}

/**
 * Owns every interactable in the current level and answers the handful
 * of questions `Game` needs to resolve movement and the interact action:
 * what's at a tile, does it block movement, and what happens when the
 * party enters it or interacts with it.
 */
export class InteractableManager {
  private readonly byPosition = new Map<string, Interactable>();

  constructor(entities: Interactable[]) {
    for (const entity of entities) {
      this.byPosition.set(key(entity.x, entity.z), entity);
    }
  }

  static fromSpawns(spawns: EntitySpawn[]): InteractableManager {
    return new InteractableManager(buildEntities(spawns));
  }

  at(x: number, z: number): Interactable | undefined {
    return this.byPosition.get(key(x, z));
  }

  private remove(entity: Interactable): void {
    this.byPosition.delete(key(entity.x, entity.z));
  }

  /** True if a party can move into (x, z) right now. */
  canEnter(x: number, z: number): boolean {
    return !(this.at(x, z)?.blocksMovement() ?? false);
  }

  blockedMessage(x: number, z: number): string | undefined {
    return this.at(x, z)?.blockedMessage?.();
  }

  /** Resolves whatever is at (x, z) reacting to the party arriving there. */
  handleEnter(x: number, z: number, ctx: InteractionContext): EnterResult {
    const entity = this.at(x, z);
    if (!entity?.onEnter) return { isExit: false };
    const message = entity.onEnter(ctx);
    const isExit = entity.isExit === true;
    if (entity.isConsumed?.()) this.remove(entity);
    return { message, isExit };
  }

  /** Resolves an explicit interact action against whatever is at (x, z), if it supports one. */
  handleInteract(x: number, z: number, ctx: InteractionContext): string | undefined {
    const entity = this.at(x, z);
    if (!entity?.interact) return undefined;
    const message = entity.interact(ctx);
    if (entity.isConsumed?.()) this.remove(entity);
    return message;
  }
}
