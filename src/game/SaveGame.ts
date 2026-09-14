import type { WorldState } from "./GameLogic";
import { Inventory } from "./Inventory";
import { Character, type CharacterStats, type ClassId, type Rank } from "./party/Character";
import { EQUIPMENT_ITEMS, type EquipmentSlot } from "./party/Equipment";
import { Party } from "./party/Party";

/**
 * `localStorage`-backed save/load (docs/08-roadmap-phases.md Phase 4,
 * docs/07-technical-architecture.md#save-system): party state, current
 * level id, and party grid position/facing. Single save slot for v1 --
 * every save overwrites the last, no autosave/scumming prevention.
 *
 * Deliberately *not* saved: per-level interactable state (which doors
 * are unlocked, which secrets found) and monster state. The design doc
 * only ever asks for "party state, current level id, and party grid
 * position/facing" -- reloading re-enters the saved level fresh, same
 * as walking into it via its stairs, rather than reconstructing a
 * snapshot of exactly which levers were pulled. That's a large surface
 * area for very little payoff at this scope; revisit only if it's
 * actually missed.
 */

const SAVE_KEY = "hollow-crown-save";
const SAVE_VERSION = 1;

const EQUIPMENT_SLOTS: EquipmentSlot[] = ["weapon", "offhand", "armor", "accessory"];

export interface SerializedCharacter {
  name: string;
  classId: ClassId;
  rank: Rank;
  portrait: string;
  stats: CharacterStats;
  maxHp: number;
  maxMana: number;
  hp: number;
  mana: number;
  level: number;
  xp: number;
  /** Item id per slot -- only slots actually worn are present. */
  equipment: Partial<Record<EquipmentSlot, string>>;
  /** Unspent skill points (docs/08-roadmap-phases.md Phase 7) -- absent on a save written before this field existed, same fallback convention `identifiedItemIds` already set below. */
  skillPoints?: number;
  /** Every skill id this character has unlocked, tier-1 default included -- absent (or, defensively, empty) on an old save falls back to just the class default via `Character`'s own constructor, not to nothing. */
  knownSkillIds?: string[];
}

export interface SerializedInventoryEntry {
  id: string;
  name: string;
  count: number;
}

export interface SaveData {
  version: number;
  levelId: string;
  playerX: number;
  playerZ: number;
  playerFacing: number;
  party: SerializedCharacter[];
  /** Always the *true* item names (`Inventory.rawEntries`), never whatever an unidentified item currently displays as — see `identifiedItemIds` below for how identification state itself round-trips. */
  inventory: SerializedInventoryEntry[];
  /** Item ids identified so far (docs/08-roadmap-phases.md Phase 5's unidentified-items stretch batch) — paired with `inventory` so a reload doesn't silently re-hide (or reveal) anything. Defaults to empty for saves written before this field existed. */
  identifiedItemIds: string[];
}

function serializeCharacter(character: Character): SerializedCharacter {
  const equipment: Partial<Record<EquipmentSlot, string>> = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const item = character.equippedIn(slot);
    if (item) equipment[slot] = item.id;
  }
  return {
    name: character.name,
    classId: character.classId,
    rank: character.rank,
    portrait: character.portrait,
    stats: { ...character.stats },
    maxHp: character.maxHp,
    maxMana: character.maxMana,
    hp: character.hp,
    mana: character.mana,
    level: character.level,
    xp: character.xp,
    equipment,
    skillPoints: character.skillPoints,
    knownSkillIds: character.listKnownSkillIds(),
  };
}

function deserializeCharacter(data: SerializedCharacter): Character {
  const character = new Character(
    data.name,
    data.classId,
    data.rank,
    { ...data.stats },
    data.maxHp,
    data.maxMana,
    data.portrait,
  );
  character.hp = data.hp;
  character.mana = data.mana;
  character.level = data.level;
  character.xp = data.xp;
  character.skillPoints = data.skillPoints ?? 0;
  // Absent/empty on a save written before skills existed -- leave the
  // constructor's own default (just the class's tier-1 skill) alone
  // rather than restoring to nothing.
  if (data.knownSkillIds && data.knownSkillIds.length > 0) {
    character.restoreKnownSkillIds(data.knownSkillIds);
  }
  for (const slot of EQUIPMENT_SLOTS) {
    const itemId = data.equipment[slot];
    const item = itemId ? EQUIPMENT_ITEMS[itemId] : undefined;
    if (item) character.equip(item);
  }
  return character;
}

/** Snapshots everything a save needs to restore a run — see the module doc for what's deliberately left out. */
export function serialize(world: WorldState, levelId: string): SaveData {
  return {
    version: SAVE_VERSION,
    levelId,
    playerX: world.player.gridX,
    playerZ: world.player.gridZ,
    playerFacing: world.player.facing,
    party: world.party.members.map(serializeCharacter),
    inventory: world.inventory.rawEntries(),
    identifiedItemIds: world.inventory.identifiedIds(),
  };
}

export function deserializeParty(data: SaveData): Party {
  return new Party(data.party.map(deserializeCharacter));
}

export function deserializeInventory(data: SaveData): Inventory {
  const inventory = new Inventory();
  for (const entry of data.inventory) inventory.add(entry.id, entry.name, entry.count);
  for (const itemId of data.identifiedItemIds ?? []) inventory.identify(itemId);
  return inventory;
}

/** `storage` defaults to the real `localStorage`, injectable for headless tests the same way `Hud`/`InputManager` take a `Document`/`Window` — see docs/11-testing-strategy.md. */
export function saveToStorage(data: SaveData, storage: Storage = window.localStorage): void {
  storage.setItem(SAVE_KEY, JSON.stringify(data));
}

/** Returns `undefined` for a missing or corrupted save rather than throwing — a broken save should never be able to crash the boot flow, only fall back to starting fresh. */
export function loadFromStorage(storage: Storage = window.localStorage): SaveData | undefined {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as SaveData;
  } catch {
    return undefined;
  }
}

export function hasSave(storage: Storage = window.localStorage): boolean {
  return storage.getItem(SAVE_KEY) !== null;
}
