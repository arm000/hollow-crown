import type { DungeonMap } from "./DungeonMap";
import type { InteractableManager } from "./interactables/InteractableManager";
import type { Inventory } from "./Inventory";
import type { Party } from "./party/Party";
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
  readonly party: Party;
}

export interface MoveOutcome {
  moved: boolean;
  message?: string;
  /** The tile the party ended up on, if it moved — for refreshing that tile's visual. */
  enteredTile?: { x: number; z: number };
  /** Set if a pushable block moved as a result of this action — for updating its visual. */
  pushedBlock?: { from: { x: number; z: number }; to: { x: number; z: number } };
  won: boolean;
}

/** True if (x, z) blocks movement — a registered interactable overrides the raw grid for its own tile, falling back to raw walls otherwise. */
function isBlocked(world: WorldState, x: number, z: number): boolean {
  const entity = world.interactables.at(x, z);
  if (entity) return entity.blocksMovement();
  return world.dungeon.isWall(x, z);
}

/** Attempts to push whatever pushable block sits at (blockX, blockZ) one tile further in the (dx, dz) direction. */
function tryPushBlock(
  world: WorldState,
  blockX: number,
  blockZ: number,
  dx: number,
  dz: number,
): { pushed: boolean; to?: { x: number; z: number } } {
  const beyondX = blockX + dx;
  const beyondZ = blockZ + dz;
  if (isBlocked(world, beyondX, beyondZ)) {
    return { pushed: false };
  }

  const block = world.interactables.at(blockX, blockZ);
  if (!block) return { pushed: false };
  world.interactables.moveEntity(block, beyondX, beyondZ);
  return { pushed: true, to: { x: beyondX, z: beyondZ } };
}

/** Attempts a grid step, checking dungeon walls and interactables (a locked door, an unrevealed secret wall, a pushable block) before allowing it. */
export function attemptMove(world: WorldState, dx: number, dz: number): MoveOutcome {
  const nx = world.player.gridX + dx;
  const nz = world.player.gridZ + dz;

  let pushedBlock: MoveOutcome["pushedBlock"];
  const targetEntity = world.interactables.at(nx, nz);

  if (targetEntity?.kind === "pushableBlock") {
    const pushResult = tryPushBlock(world, nx, nz, dx, dz);
    if (!pushResult.pushed) {
      return { moved: false, message: targetEntity.blockedMessage?.(), won: false };
    }
    pushedBlock = { from: { x: nx, z: nz }, to: pushResult.to! };
  } else if (isBlocked(world, nx, nz)) {
    return { moved: false, message: targetEntity?.blockedMessage?.(), won: false };
  }

  // A generic Passable object, not `world.dungeon` directly: the raw grid
  // never changes, so a revealed secret wall or an unlocked door only
  // actually opens up if the check here goes through `isBlocked` too.
  if (!world.player.tryMove(dx, dz, { isWall: (x, z) => isBlocked(world, x, z) })) {
    return { moved: false, won: false };
  }

  world.interactables.reevaluatePressurePlates(world.player.gridX, world.player.gridZ);

  const result = world.interactables.handleEnter(nx, nz, { inventory: world.inventory });
  return { moved: true, message: result.message, enteredTile: { x: nx, z: nz }, pushedBlock, won: result.isExit };
}

export interface InteractOutcome {
  message?: string;
  /** The tile whose interactable actually responded, if any — for refreshing its visual. */
  targetTile?: { x: number; z: number };
}

/**
 * Interact checks the tile the party is facing first (doors, levers,
 * secret walls), then falls back to the party's own tile (lore items,
 * floor pickups). Facing takes priority deliberately: a wall-mounted
 * fixture like a secret wall behind an item you're standing on should
 * still respond to being faced and searched, rather than the item
 * underfoot always winning.
 */
export function attemptInteract(world: WorldState): InteractOutcome {
  const ctx = { inventory: world.inventory };
  const { gridX, gridZ } = world.player;

  const [fx, fz] = world.player.forwardStep();
  const facedX = gridX + fx;
  const facedZ = gridZ + fz;
  const facedMessage = world.interactables.handleInteract(facedX, facedZ, ctx);
  if (facedMessage !== undefined) {
    return { message: facedMessage, targetTile: { x: facedX, z: facedZ } };
  }

  const hereMessage = world.interactables.handleInteract(gridX, gridZ, ctx);
  if (hereMessage !== undefined) {
    return { message: hereMessage, targetTile: { x: gridX, z: gridZ } };
  }

  return { message: "Nothing to interact with here." };
}
