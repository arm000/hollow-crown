import { describe, expect, it } from "vitest";
import { Door } from "./Door";
import { SequenceRune, type RuneSequenceState } from "./SequenceRune";

/** Builds a 3-rune group (order 0, 1, 2) sharing one state object and one locked door, mirroring how `buildEntities.ts` wires a real level's spawns together. */
function newGroup(): { runes: SequenceRune[]; door: Door; state: RuneSequenceState } {
  const door = new Door(9, 9, undefined, true);
  const state: RuneSequenceState = { progress: 0 };
  const runes = [
    new SequenceRune(1, 1, 0, 3, state, door),
    new SequenceRune(2, 1, 1, 3, state, door),
    new SequenceRune(3, 1, 2, 3, state, door),
  ];
  return { runes, door, state };
}

describe("SequenceRune", () => {
  it("never blocks movement", () => {
    expect(newGroup().runes[0].blocksMovement()).toBe(false);
  });

  it("stepping the runes in order unlocks the linked door only on the last one", () => {
    const { runes, door } = newGroup();

    expect(runes[0].onEnter()).toBe("The rune glows and holds.");
    expect(door.locked).toBe(true);

    expect(runes[1].onEnter()).toBe("The rune glows and holds.");
    expect(door.locked).toBe(true);

    expect(runes[2].onEnter()).toBe("The final rune flares bright — a lock gives way somewhere nearby.");
    expect(door.locked).toBe(false);
  });

  it("stepping on a rune out of turn resets the whole group", () => {
    const { runes, door } = newGroup();
    runes[0].onEnter();

    const message = runes[2].onEnter(); // skips rune 1 entirely
    expect(message).toBe("Wrong rune — every light in the sequence gutters out at once.");

    // Has to start over from rune 0 -- rune 1 no longer counts as "next".
    expect(runes[1].onEnter()).toBe("Wrong rune — every light in the sequence gutters out at once.");
    expect(door.locked).toBe(true);
  });

  it("revisiting an already-passed rune is a harmless no-op, not a reset", () => {
    const { runes, door } = newGroup();
    runes[0].onEnter();
    runes[1].onEnter();

    expect(runes[0].onEnter()).toBe("This rune is already lit, and stays that way.");

    // Progress survives the revisit -- the last rune still finishes the group.
    expect(runes[2].onEnter()).toBe("The final rune flares bright — a lock gives way somewhere nearby.");
    expect(door.locked).toBe(false);
  });

  it("does nothing once the group is already solved", () => {
    const { runes } = newGroup();
    runes[0].onEnter();
    runes[1].onEnter();
    runes[2].onEnter();

    expect(runes[0].onEnter()).toBeUndefined();
    expect(runes[2].onEnter()).toBeUndefined();
  });

  it("wrong-rune-first (before anything is lit) still resets cleanly, not a no-op", () => {
    const { runes, door } = newGroup();

    const message = runes[1].onEnter(); // rune 1 before rune 0
    expect(message).toBe("Wrong rune — every light in the sequence gutters out at once.");
    expect(door.locked).toBe(true);

    // Rune 0 still works correctly afterward.
    expect(runes[0].onEnter()).toBe("The rune glows and holds.");
  });
});
