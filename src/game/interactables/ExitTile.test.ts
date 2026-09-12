import { describe, expect, it } from "vitest";
import { ExitTile } from "./ExitTile";

describe("ExitTile", () => {
  it("never blocks movement", () => {
    const exit = new ExitTile(1, 1);
    expect(exit.blocksMovement()).toBe(false);
  });

  it("is flagged as the win trigger", () => {
    const exit = new ExitTile(1, 1);
    expect(exit.isExit).toBe(true);
  });

  it("returns a message on enter", () => {
    const exit = new ExitTile(1, 1);
    expect(exit.onEnter()).toBe("You found the way out.");
  });
});
