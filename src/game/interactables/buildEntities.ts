import type { ClassId } from "../party/Character";
import { EQUIPMENT_ITEMS } from "../party/Equipment";
import { ClassGate } from "./ClassGate";
import { Door } from "./Door";
import { EquipmentPickup } from "./EquipmentPickup";
import { ExitTile } from "./ExitTile";
import { KeyItem } from "./KeyItem";
import { Lever } from "./Lever";
import { LoreItem } from "./LoreItem";
import { NpcEncounter } from "./NpcEncounter";
import { PressurePlate } from "./PressurePlate";
import { PushableBlock } from "./PushableBlock";
import { SecretWall } from "./SecretWall";
import { StairsDown } from "./StairsDown";
import type { EntitySpawn, Interactable } from "./types";

const DOOR_LINKED_TYPES = new Set(["lever", "pressurePlate"]);

/**
 * Turns raw level-data spawns into runtime `Interactable` instances.
 * Levers and pressure plates are built in a second pass since they need
 * a reference to their linked door's actual instance, not just its
 * spawn data — see docs/08-roadmap-phases.md Phase 1.
 */
export function buildEntities(spawns: EntitySpawn[]): Interactable[] {
  const doorLinkedSpawns = spawns.filter((spawn) => DOOR_LINKED_TYPES.has(spawn.type));
  const otherSpawns = spawns.filter((spawn) => !DOOR_LINKED_TYPES.has(spawn.type));

  const byPosition = new Map<string, Interactable>();
  for (const spawn of otherSpawns) {
    byPosition.set(`${spawn.x},${spawn.z}`, buildOne(spawn));
  }

  for (const spawn of doorLinkedSpawns) {
    byPosition.set(`${spawn.x},${spawn.z}`, buildDoorLinked(spawn, byPosition));
  }

  return [...byPosition.values()];
}

function buildOne(spawn: EntitySpawn): Interactable {
  const params = spawn.params ?? {};
  switch (spawn.type) {
    case "door":
      return new Door(
        spawn.x,
        spawn.z,
        params.keyId as string | undefined,
        (params.locked as boolean | undefined) ?? true,
      );
    case "keyItem":
      return new KeyItem(spawn.x, spawn.z, params.itemId as string, (params.name as string) ?? "an item");
    case "equipmentItem": {
      const item = EQUIPMENT_ITEMS[params.itemId as string];
      if (!item) throw new Error(`Unknown equipment item id: "${params.itemId}"`);
      return new EquipmentPickup(spawn.x, spawn.z, item);
    }
    case "loreItem":
      return new LoreItem(spawn.x, spawn.z, params.text as string);
    case "npc":
      return new NpcEncounter(spawn.x, spawn.z, params.name as string, params.line as string);
    case "classGate":
      return new ClassGate(
        spawn.x,
        spawn.z,
        params.requiredClass as ClassId,
        params.blockedText as string,
        params.openText as string,
      );
    case "pushableBlock":
      return new PushableBlock(spawn.x, spawn.z);
    case "secretWall":
      return new SecretWall(spawn.x, spawn.z);
    case "exit":
      return new ExitTile(spawn.x, spawn.z);
    case "stairsDown":
      return new StairsDown(spawn.x, spawn.z, params.targetLevelId as string);
    default:
      throw new Error(`Unknown entity spawn type: "${spawn.type}"`);
  }
}

function buildDoorLinked(spawn: EntitySpawn, built: Map<string, Interactable>): Interactable {
  const params = spawn.params ?? {};
  const doorX = params.doorX as number;
  const doorZ = params.doorZ as number;
  const door = built.get(`${doorX},${doorZ}`);
  if (!door || door.kind !== "door") {
    const label = spawn.type === "lever" ? "Lever" : "Pressure plate";
    throw new Error(`${label} at (${spawn.x}, ${spawn.z}) references a door at (${doorX}, ${doorZ}) that doesn't exist`);
  }

  return spawn.type === "lever"
    ? new Lever(spawn.x, spawn.z, door as Door)
    : new PressurePlate(spawn.x, spawn.z, door as Door);
}
