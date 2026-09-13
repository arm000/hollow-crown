import type { EntitySpawn, InteractionContext, Interactable } from "./types";
import { buildEntities } from "./buildEntities";

function key(x: number, z: number): string {
  return `${x},${z}`;
}

export interface EnterResult {
  message?: string;
  isExit: boolean;
  /** Set when the entered tile is a `StairsDown` — the id of the level to load next. */
  stairsToLevelId?: string;
}

/**
 * Owns every interactable in the current level and answers the handful
 * of questions `Game`/`GameLogic` need to resolve movement and the
 * interact action: what's at a tile, does it block movement, and what
 * happens when the party enters it or interacts with it.
 *
 * Pressure plates are tracked separately from everything else, not
 * keyed into the same position map: a plate's tile can simultaneously
 * hold a pushed block (or the party) sitting on top of it, and this
 * manager only ever stores one entity per grid position otherwise.
 */
export class InteractableManager {
  private readonly byPosition = new Map<string, Interactable>();
  private readonly pressurePlates: Interactable[] = [];

  constructor(entities: Interactable[]) {
    for (const entity of entities) {
      if (entity.kind === "pressurePlate") {
        this.pressurePlates.push(entity);
      } else {
        this.byPosition.set(key(entity.x, entity.z), entity);
      }
    }
  }

  static fromSpawns(spawns: EntitySpawn[]): InteractableManager {
    return new InteractableManager(buildEntities(spawns));
  }

  at(x: number, z: number): Interactable | undefined {
    return this.byPosition.get(key(x, z));
  }

  /** Every entity in the level, pressure plates included — for building placeholder visuals up front (see `Game.buildEntityMeshes`). */
  allEntities(): Interactable[] {
    return [...this.byPosition.values(), ...this.pressurePlates];
  }

  private remove(entity: Interactable): void {
    this.byPosition.delete(key(entity.x, entity.z));
  }

  /** Moves a tracked entity (a pushed block) to a new position. */
  moveEntity(entity: Interactable, newX: number, newZ: number): void {
    this.byPosition.delete(key(entity.x, entity.z));
    entity.x = newX;
    entity.z = newZ;
    this.byPosition.set(key(newX, newZ), entity);
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
    const stairsToLevelId = entity.stairsToLevelId;
    if (entity.isConsumed?.()) this.remove(entity);
    return { message, isExit, stairsToLevelId };
  }

  /** Resolves an explicit interact action against whatever is at (x, z), if it supports one. */
  handleInteract(x: number, z: number, ctx: InteractionContext): string | undefined {
    const entity = this.at(x, z);
    if (!entity?.interact) return undefined;
    const message = entity.interact(ctx);
    if (entity.isConsumed?.()) this.remove(entity);
    return message;
  }

  /**
   * Recomputes every pressure plate's occupied state from scratch: is
   * the party standing on it, or is a pushable block sitting there.
   * Call after any move that could have changed either. Self-correcting
   * by design — there's no separate "on exit" event to keep in sync.
   */
  reevaluatePressurePlates(playerX: number, playerZ: number): void {
    if (this.pressurePlates.length === 0) return;

    const blockPositions = new Set<string>();
    for (const entity of this.byPosition.values()) {
      if (entity.kind === "pushableBlock") blockPositions.add(key(entity.x, entity.z));
    }

    for (const plate of this.pressurePlates) {
      const occupied = (plate.x === playerX && plate.z === playerZ) || blockPositions.has(key(plate.x, plate.z));
      plate.setOccupied?.(occupied);
    }
  }
}
