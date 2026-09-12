import { describe, expect, it } from "vitest";
import { SecretWall } from "./SecretWall";

describe("SecretWall", () => {
  it("blocks movement while hidden", () => {
    const wall = new SecretWall(1, 1);
    expect(wall.blocksMovement()).toBe(true);
  });

  it("stops blocking movement once found", () => {
    const wall = new SecretWall(1, 1);
    wall.interact();
    expect(wall.blocksMovement()).toBe(false);
  });

  it("returns a discovery message the first time, a neutral one after", () => {
    const wall = new SecretWall(1, 1);
    expect(wall.interact()).toBe("You find a hidden passage!");
    expect(wall.interact()).not.toBe("You find a hidden passage!");
  });
});
