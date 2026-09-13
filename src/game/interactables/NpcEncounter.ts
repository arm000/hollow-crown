import type { Interactable } from "./types";

/**
 * A "sparse NPC encounter" (docs/02-setting-and-story.md#how-story-is-delivered):
 * a non-hostile figure worth one memorable exchange, not a branching
 * dialogue tree — mechanically almost identical to `LoreItem` (interact
 * -> a fixed line, re-readable), but kept as its own `kind` so a figure
 * reads distinctly from an inert page both in the level data and in
 * `InteractableMesh`'s placeholder geometry, and so a later phase could
 * give NPCs conditional hostility or a quest flag without conflating
 * that with journal entries.
 */
export class NpcEncounter implements Interactable {
  readonly kind = "npc";

  constructor(
    public x: number,
    public z: number,
    private readonly name: string,
    private readonly line: string,
  ) {}

  blocksMovement(): boolean {
    return false;
  }

  interact(): string {
    return `${this.name}: "${this.line}"`;
  }
}
