import type { Character } from "./party/Character";

/**
 * Thin wrapper around the plain-DOM HUD elements declared in
 * `index.html` (see docs/07-technical-architecture.md "UI layer" — DOM
 * overlays, not in-3D UI). No polish intended yet: a message line, a
 * text inventory list, and a party status line are enough to make
 * Phase 1/2's state legible.
 */
export class Hud {
  private readonly messageEl: HTMLElement;
  private readonly inventoryEl: HTMLElement;
  private readonly partyEl: HTMLElement;
  private readonly winScreenEl: HTMLElement;

  constructor(doc: Document = document) {
    this.messageEl = getRequiredElement(doc, "hud-message");
    this.inventoryEl = getRequiredElement(doc, "hud-inventory");
    this.partyEl = getRequiredElement(doc, "hud-party");
    this.winScreenEl = getRequiredElement(doc, "win-screen");
  }

  showMessage(text: string): void {
    this.messageEl.textContent = text;
  }

  updateInventory(itemNames: string[]): void {
    this.inventoryEl.textContent = itemNames.length > 0 ? `Carrying: ${itemNames.join(", ")}` : "";
  }

  updateParty(members: Character[]): void {
    this.partyEl.textContent = members
      .map((member) => `${member.name} ${member.hp}/${member.maxHp}${member.isDown ? " (down)" : ""}`)
      .join("\n");
  }

  showWinScreen(): void {
    this.winScreenEl.hidden = false;
  }
}

function getRequiredElement(doc: Document, id: string): HTMLElement {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`Missing #${id} element`);
  return el;
}
