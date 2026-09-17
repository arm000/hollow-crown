import { describe, expect, it } from "vitest";
import { buildEntities } from "./buildEntities";
import { Door } from "./Door";
import { Lever } from "./Lever";
import type { SequenceRune } from "./SequenceRune";
import type { Trap } from "./Trap";

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

  it("builds a trap from plain spawn data", () => {
    const entities = buildEntities([
      { type: "trap", x: 3, z: 3, params: { damageType: "physical", amount: 5, message: "Spikes!" } },
    ]);
    const trap = entities.find((e) => e.kind === "trap") as Trap;
    expect(trap.x).toBe(3);
    expect(trap.z).toBe(3);
  });

  it("groups sequence runes sharing a sequenceId into one puzzle, each linked to the same door", () => {
    const entities = buildEntities([
      { type: "door", x: 9, z: 9, params: { locked: true } },
      { type: "sequenceRune", x: 1, z: 1, params: { sequenceId: "test", order: 0, doorX: 9, doorZ: 9 } },
      { type: "sequenceRune", x: 2, z: 1, params: { sequenceId: "test", order: 1, doorX: 9, doorZ: 9 } },
    ]);

    const door = entities.find((e) => e.kind === "door") as Door;
    const runes = entities.filter((e) => e.kind === "sequenceRune") as SequenceRune[];
    expect(runes).toHaveLength(2);

    expect(runes.find((r) => r.x === 1)!.onEnter()).toBe("The rune glows and holds.");
    expect(door.locked).toBe(true);
    expect(runes.find((r) => r.x === 2)!.onEnter()).toContain("flares bright");
    expect(door.locked).toBe(false);
  });

  it("keeps two different rune groups (different sequenceId) fully independent", () => {
    const entities = buildEntities([
      { type: "door", x: 8, z: 8, params: { locked: true } },
      { type: "door", x: 9, z: 9, params: { locked: true } },
      { type: "sequenceRune", x: 1, z: 1, params: { sequenceId: "a", order: 0, doorX: 8, doorZ: 8 } },
      { type: "sequenceRune", x: 1, z: 2, params: { sequenceId: "b", order: 0, doorX: 9, doorZ: 9 } },
    ]);

    const runeA = entities.find((e) => e.kind === "sequenceRune" && e.x === 1 && e.z === 1) as SequenceRune;
    const doorA = entities.find((e) => e.kind === "door" && e.x === 8) as Door;
    const doorB = entities.find((e) => e.kind === "door" && e.x === 9) as Door;

    runeA.onEnter(); // solves group "a" alone (it's the only rune in it)
    expect(doorA.locked).toBe(false);
    expect(doorB.locked).toBe(true); // untouched -- a completely separate group
  });

  it("throws when a sequence rune references a door that doesn't exist", () => {
    expect(() =>
      buildEntities([{ type: "sequenceRune", x: 1, z: 1, params: { sequenceId: "test", order: 0, doorX: 9, doorZ: 9 } }]),
    ).toThrow();
  });
});
