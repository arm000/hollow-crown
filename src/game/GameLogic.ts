import type { DungeonMap } from "./DungeonMap";
import type { InteractableManager } from "./interactables/InteractableManager";
import type { Inventory } from "./Inventory";
import type { Player } from "./Player";

/**
 * Everything needed to resolve a move or an interact action, with zero
 * rendering/DOM dependency — see docs/11-testing-strategy.md
 * "Architecture requirements for testability". `Game` owns the pieces
 * of this (plus the Three.js scene) and calls the functions below;
 * headless tests can drive the exact same functions directly.
 */
export interface WorldState {
  readonly player: Player;
  readonly dungeon: DungeonMap;
  readonly interactables: InteractableManager;
  readonly inventory: Inventory;
}

export interface MoveOutcome {
  moved: boolean;
  message?: string;
  /** The tile the party ended up on, if it moved — for refreshing that tile's visual. */
  enteredTile?: { x: number; z: number };
  won: boolean;
}

/** Attempts a grid step, checking dungeon walls and interactables (a locked door, say) before allowing it. */
export function attemptMove(world: WorldState, dx: number, dz: number): MoveOutcome {
  const nx = world.player.gridX + dx;
  const nz = world.player.gridZ + dz;

  if (world.dungeon.isWall(nx, nz)) {
    return { moved: false, won: false };
  }

  if (!world.interactables.canEnter(nx, nz)) {
    return { moved: false, message: world.interactables.blockedMessage(nx, nz), won: false };
  }

  if (!world.player.tryMove(dx, dz, world.dungeon)) {
    return { moved: false, won: false };
  }

  const result = world.interactables.handleEnter(nx, nz, { inventory: world.inventory });
  return { moved: true, message: result.message, enteredTile: { x: nx, z: nz }, won: result.isExit };
}

export interface InteractOutcome {
  message?: string;
  /** The tile whose interactable actually responded, if any — for refreshing its visual. */
  targetTile?: { x: number; z: number };
}

/** Interact checks the party's own tile first (lore items, floor pickups), then the tile it's facing (doors, levers). */
export function attemptInteract(world: WorldState): InteractOutcome {
  const ctx = { inventory: world.inventory };
  const { gridX, gridZ } = world.player;

  const hereMessage = world.interactables.handleInteract(gridX, gridZ, ctx);
  if (hereMessage !== undefined) {
    return { message: hereMessage, targetTile: { x: gridX, z: gridZ } };
  }

  const [fx, fz] = world.player.forwardStep();
  const facedX = gridX + fx;
  const facedZ = gridZ + fz;
  const facedMessage = world.interactables.handleInteract(facedX, facedZ, ctx);
  if (facedMessage !== undefined) {
    return { message: facedMessage, targetTile: { x: facedX, z: facedZ } };
  }

  return { message: "Nothing to interact with here." };
}
