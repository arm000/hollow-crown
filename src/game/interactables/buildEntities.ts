import { Door } from "./Door";
import { ExitTile } from "./ExitTile";
import { KeyItem } from "./KeyItem";
import { Lever } from "./Lever";
import { LoreItem } from "./LoreItem";
import type { EntitySpawn, Interactable } from "./types";

/**
 * Turns raw level-data spawns into runtime `Interactable` instances.
 * Levers are built in a second pass since they need a reference to
 * their linked door's actual instance, not just its spawn data — see
 * docs/08-roadmap-phases.md Phase 1.
 */
export function buildEntities(spawns: EntitySpawn[]): Interactable[] {
  const leverSpawns = spawns.filter((spawn) => spawn.type === "lever");
  const otherSpawns = spawns.filter((spawn) => spawn.type !== "lever");

  const byPosition = new Map<string, Interactable>();
  for (const spawn of otherSpawns) {
    byPosition.set(`${spawn.x},${spawn.z}`, buildOne(spawn));
  }

  for (const spawn of leverSpawns) {
    byPosition.set(`${spawn.x},${spawn.z}`, buildLever(spawn, byPosition));
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
    case "loreItem":
      return new LoreItem(spawn.x, spawn.z, params.text as string);
    case "exit":
      return new ExitTile(spawn.x, spawn.z);
    default:
      throw new Error(`Unknown entity spawn type: "${spawn.type}"`);
  }
}

function buildLever(spawn: EntitySpawn, built: Map<string, Interactable>): Lever {
  const params = spawn.params ?? {};
  const doorX = params.doorX as number;
  const doorZ = params.doorZ as number;
  const door = built.get(`${doorX},${doorZ}`);
  if (!door || door.kind !== "door") {
    throw new Error(`Lever at (${spawn.x}, ${spawn.z}) references a door at (${doorX}, ${doorZ}) that doesn't exist`);
  }
  return new Lever(spawn.x, spawn.z, door as Door);
}
