import type { DungeonMap } from "./DungeonMap";
import type { InteractableManager } from "./interactables/InteractableManager";
import type { Inventory } from "./Inventory";
import type { Monster } from "./monster/Monster";
import { EQUIPMENT_ITEMS, type EquipmentSlot } from "./party/Equipment";
import type { Party } from "./party/Party";
import type { Facing, Player } from "./Player";
import type { WorldClock } from "./WorldClock";

/**
 * Everything needed to resolve a move or an interact action, with zero
 * rendering/DOM dependency — see docs/11-testing-strategy.md
 * "Architecture requirements for testability". `Game` owns the pieces
 * of this (plus the Three.js scene) and calls the functions below;
 * headless tests can drive the exact same functions directly.
 */
export interface WorldState {
  readonly player: Player;
  /** Swapped out whole on a level transition (docs/08-roadmap-phases.md Phase 4's `StairsDown`) -- not readonly like `player`/`inventory`/`party`, which persist unchanged across the whole run. */
  dungeon: DungeonMap;
  interactables: InteractableManager;
  readonly inventory: Inventory;
  readonly party: Party;
  readonly worldClock: WorldClock;
  /** Every monster placed in the current level — Phase 3 onward supports more than one type coexisting; Phase 4 replaces this list entirely on every level transition. Combat is still always one-monster-at-a-time. */
  monsters: Monster[];
}

/** Ticks the world-turn clock once (docs/04-exploration-and-world.md#world-turns) and reports which monster (if any) is now adjacent to (or on) the party's tile — combat starts with that one. */
function advanceWorldTurn(world: WorldState): Monster | undefined {
  world.worldClock.advance();
  return world.monsters.find((monster) => {
    if (monster.isDown) return false;
    const distance = Math.abs(monster.x - world.player.gridX) + Math.abs(monster.z - world.player.gridZ);
    return distance <= 1;
  });
}

export interface MoveOutcome {
  moved: boolean;
  message?: string;
  /** The tile the party ended up on, if it moved — for refreshing that tile's visual. */
  enteredTile?: { x: number; z: number };
  /** Set if a pushable block moved as a result of this action — for updating its visual. */
  pushedBlock?: { from: { x: number; z: number }; to: { x: number; z: number } };
  won: boolean;
  /** Set if the party stepped onto a `StairsDown` tile — the id of the level `Game` should load next (docs/08-roadmap-phases.md Phase 4). */
  levelTransition?: string;
  /** Set if this action's world-turn tick left a monster adjacent to (or on) the party — combat starts against that one. */
  combatTriggeredBy?: Monster;
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
  const combatTriggeredBy = advanceWorldTurn(world);

  const result = world.interactables.handleEnter(nx, nz, { inventory: world.inventory, party: world.party });
  return {
    moved: true,
    message: result.message,
    enteredTile: { x: nx, z: nz },
    pushedBlock,
    won: result.isExit,
    levelTransition: result.stairsToLevelId,
    combatTriggeredBy,
  };
}

export interface InteractOutcome {
  message?: string;
  /** The tile whose interactable actually responded, if any — for refreshing its visual. */
  targetTile?: { x: number; z: number };
  combatTriggeredBy?: Monster;
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
  const ctx = { inventory: world.inventory, party: world.party };
  const { gridX, gridZ } = world.player;

  const [fx, fz] = world.player.forwardStep();
  const facedX = gridX + fx;
  const facedZ = gridZ + fz;
  const facedMessage = world.interactables.handleInteract(facedX, facedZ, ctx);
  if (facedMessage !== undefined) {
    return { message: facedMessage, targetTile: { x: facedX, z: facedZ }, combatTriggeredBy: advanceWorldTurn(world) };
  }

  const hereMessage = world.interactables.handleInteract(gridX, gridZ, ctx);
  if (hereMessage !== undefined) {
    return { message: hereMessage, targetTile: { x: gridX, z: gridZ }, combatTriggeredBy: advanceWorldTurn(world) };
  }

  return { message: "Nothing to interact with here.", combatTriggeredBy: advanceWorldTurn(world) };
}

export interface TurnOutcome {
  combatTriggeredBy?: Monster;
}

/** Turning always succeeds once called (Game only calls this when the player isn't mid-animation), and — like every action — costs one world turn. */
export function attemptTurn(world: WorldState, direction: 1 | -1): TurnOutcome {
  world.player.turn(direction);
  return { combatTriggeredBy: advanceWorldTurn(world) };
}

export interface EquipOutcome {
  success: boolean;
  message?: string;
}

/**
 * Equips `itemId` (must currently be held in the shared inventory) onto
 * `characterName`, per docs/06-items-and-equipment.md#inventory-model —
 * the inventory screen is what calls this, not the level. Whatever was
 * already worn in that slot, if anything, goes back into the inventory
 * rather than vanishing — this is meant to be freely reversible, not a
 * one-way commitment. Doesn't cost a world turn: unlike moving or
 * interacting, this isn't something the dungeon reacts to.
 */
export function equipItem(world: WorldState, characterName: string, itemId: string): EquipOutcome {
  const item = EQUIPMENT_ITEMS[itemId];
  const character = world.party.members.find((member) => member.name === characterName);
  if (!item || !character) return { success: false };
  if (!world.inventory.consume(itemId)) return { success: false };

  const previous = character.equip(item);
  if (previous) world.inventory.add(previous.id, previous.name);
  return { success: true, message: `${character.name} equips ${item.name}.` };
}

/** Moves whatever `characterName` has worn in `slot`, if anything, back into the shared inventory. */
export function unequipItem(world: WorldState, characterName: string, slot: EquipmentSlot): EquipOutcome {
  const character = world.party.members.find((member) => member.name === characterName);
  if (!character) return { success: false };
  const item = character.unequip(slot);
  if (!item) return { success: false };

  world.inventory.add(item.id, item.name);
  return { success: true, message: `${character.name} stows ${item.name}.` };
}

export interface StartPosition {
  x: number;
  z: number;
  facing: Facing;
}

/**
 * Where the player should actually be placed when a level is entered —
 * pulled out of `Game`'s constructor specifically so it's unit
 * testable: a real shipped bug had the constructor build a level's
 * geometry via `enterLevel` and simply never call `teleportTo`,
 * leaving a fresh game's player sitting on the untouched (0, 0)
 * placeholder — a wall tile in every level, silently blocking every
 * forward/backward/strafe move while turning (which does no wall
 * check) kept working. `Game` itself still isn't unit tested (it's the
 * DOM/render shell, per docs/11-testing-strategy.md), but *this*
 * decision — which tile, which facing — has zero rendering dependency
 * and never needed to live inside the untestable part.
 */
export function resolveStartPosition(
  dungeon: DungeonMap,
  saveData?: { playerX: number; playerZ: number; playerFacing: number },
): StartPosition {
  if (saveData) {
    return { x: saveData.playerX, z: saveData.playerZ, facing: saveData.playerFacing as Facing };
  }
  const start = dungeon.findStart();
  return { x: start.x, z: start.z, facing: 1 }; // east -- the direction every hand-authored level's corridor extends from its 'S' tile
}
