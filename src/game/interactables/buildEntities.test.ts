import { describe, expect, it } from "vitest";
import { buildEntities } from "./buildEntities";
import { Door } from "./Door";
import { Lever } from "./Lever";

describe("buildEntities", () => {
  it("links a lever to its target door by position", () => {
    const entities = buildEntities([
      { type: "door", x: 5, z: 5, params: { locked: true } },
      { type: "lever", x: 1, z: 1, params: { doorX: 5, doorZ: 5 } },
    ]);

    const lever = entities.find((e) => e.kind === "lever") as Lever;
    const door = entities.find((e) => e.kind === "door") as Door;

    lever.interact();
    expect(door.locked).toBe(false); // pulling the lever really did unlock that specific door
  });

  it("throws when a lever references a door that doesn't exist", () => {
    expect(() =>
      buildEntities([{ type: "lever", x: 1, z: 1, params: { doorX: 9, doorZ: 9 } }]),
    ).toThrow();
  });

  it("throws when a lever's coordinates point at a non-door entity", () => {
    expect(() =>
      buildEntities([
        { type: "exit", x: 5, z: 5 },
        { type: "lever", x: 1, z: 1, params: { doorX: 5, doorZ: 5 } },
      ]),
    ).toThrow();
  });
});
