import { Door } from "./Door";
import { ExitTile } from "./ExitTile";
import { KeyItem } from "./KeyItem";
import type { EntitySpawn, Interactable } from "./types";

/**
 * Turns raw level-data spawns into runtime `Interactable` instances.
 * New entity types get a case here as they're added (Lever, PressurePlate,
 * PushableBlock, SecretWall, LoreItem — see docs/08-roadmap-phases.md
 * Phase 1).
 */
export function buildEntities(spawns: EntitySpawn[]): Interactable[] {
  return spawns.map(buildOne);
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
    case "exit":
      return new ExitTile(spawn.x, spawn.z);
    default:
      throw new Error(`Unknown entity spawn type: "${spawn.type}"`);
  }
}
