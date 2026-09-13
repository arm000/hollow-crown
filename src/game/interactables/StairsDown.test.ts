import { describe, expect, it } from "vitest";
import { StairsDown } from "./StairsDown";

describe("StairsDown", () => {
  it("never blocks movement", () => {
    expect(new StairsDown(1, 1, "level-2").blocksMovement()).toBe(false);
  });

  it("carries its target level id for GameLogic/InteractableManager to read", () => {
    const stairs = new StairsDown(1, 1, "level-3");
    expect(stairs.stairsToLevelId).toBe("level-3");
  });

  it("returns a flavor message on enter", () => {
    const stairs = new StairsDown(1, 1, "level-2");
    expect(stairs.onEnter()).toBeTruthy();
  });
});
