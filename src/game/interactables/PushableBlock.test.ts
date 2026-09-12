import { describe, expect, it } from "vitest";
import { PushableBlock } from "./PushableBlock";

describe("PushableBlock", () => {
  it("always blocks movement (until GameLogic pushes it aside)", () => {
    const block = new PushableBlock(1, 1);
    expect(block.blocksMovement()).toBe(true);
  });

  it("has a blocked message for a push that fails", () => {
    const block = new PushableBlock(1, 1);
    expect(block.blockedMessage()).toBeTruthy();
  });
});
