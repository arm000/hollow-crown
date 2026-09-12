import { describe, expect, it } from "vitest";
import { Door } from "./Door";
import { PressurePlate } from "./PressurePlate";

describe("PressurePlate", () => {
  it("never blocks movement", () => {
    const door = new Door(5, 5, undefined, true);
    const plate = new PressurePlate(1, 1, door);
    expect(plate.blocksMovement()).toBe(false);
  });

  it("unlocks its linked door once occupied", () => {
    const door = new Door(5, 5, undefined, true);
    const plate = new PressurePlate(1, 1, door);

    plate.setOccupied(true);

    expect(door.locked).toBe(false);
  });

  it("re-locks its linked door once vacated", () => {
    const door = new Door(5, 5, undefined, true);
    const plate = new PressurePlate(1, 1, door);
    plate.setOccupied(true);

    plate.setOccupied(false);

    expect(door.locked).toBe(true);
  });

  it("setting the same occupied state twice does not re-toggle the door", () => {
    const door = new Door(5, 5, undefined, false); // starts unlocked
    const plate = new PressurePlate(1, 1, door);

    plate.setOccupied(false); // already unoccupied, no-op
    plate.setOccupied(false);

    expect(door.locked).toBe(false); // untouched, not flipped back to locked
  });
});
