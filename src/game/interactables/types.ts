import type { Inventory } from "../Inventory";

/**
 * Raw level-data description of an interactable's placement, per
 * docs/07-technical-architecture.md's level data format. Kept separate
 * from the runtime `Interactable` classes below so level content stays
 * plain data.
 */
export interface EntitySpawn {
  type: string;
  x: number;
  z: number;
  params?: Record<string, unknown>;
}

export interface InteractionContext {
  inventory: Inventory;
}

/**
 * Something living on a dungeon tile that the party can walk into, stand
 * on, or interact with. Every concrete type implements only the pieces
 * relevant to it — a lore item has no `blocksMovement`, a pressure plate
 * has no `interact`, etc.
 */
export interface Interactable {
  readonly kind: string;
  x: number;
  z: number;

  /** True while this tile physically blocks movement into it. */
  blocksMovement(): boolean;

  /** Message shown when movement into this tile is refused, if any. */
  blockedMessage?(): string;

  /**
   * Called when the party faces this tile (or stands on it, for floor
   * items — see docs/04-exploration-and-world.md) and presses interact.
   * Returns a HUD message, if any.
   */
  interact?(ctx: InteractionContext): string | undefined;

  /** Called when the party's new grid position lands on this tile. */
  onEnter?(ctx: InteractionContext): string | undefined;

  /** True once this entity should be removed from the level (e.g. a collected key). */
  isConsumed?(): boolean;

  /** True if entering this tile should end the level in victory. */
  readonly isExit?: boolean;
}
