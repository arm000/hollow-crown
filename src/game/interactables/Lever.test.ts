import { describe, expect, it } from "vitest";
import { Door } from "./Door";
import { Lever } from "./Lever";

describe("Lever", () => {
  it("never blocks movement", () => {
    const door = new Door(5, 5, undefined, true);
    const lever = new Lever(1, 1, door);
    expect(lever.blocksMovement()).toBe(false);
  });

  it("unlocks its linked door on the first pull", () => {
    const door = new Door(5, 5, undefined, true);
    const lever = new Lever(1, 1, door);

    const message = lever.interact();

    expect(door.locked).toBe(false);
    expect(message).toBe("You pull the lever. Something unlocks nearby.");
  });

  it("re-locks the door if pulled again (a toggle, not a one-shot)", () => {
    const door = new Door(5, 5, undefined, true);
    const lever = new Lever(1, 1, door);
    lever.interact();

    const message = lever.interact();

    expect(door.locked).toBe(true);
    expect(message).toBe("You push the lever. Something locks nearby.");
  });
});
