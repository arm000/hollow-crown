/**
 * Thin wrapper around the plain-DOM HUD elements declared in
 * `index.html` (see docs/07-technical-architecture.md "UI layer" — DOM
 * overlays, not in-3D UI). No polish intended yet: a message line and a
 * text inventory list are enough to make Phase 1's interactables legible.
 */
export class Hud {
  private readonly messageEl: HTMLElement;
  private readonly inventoryEl: HTMLElement;
  private readonly winScreenEl: HTMLElement;

  constructor(doc: Document = document) {
    this.messageEl = getRequiredElement(doc, "hud-message");
    this.inventoryEl = getRequiredElement(doc, "hud-inventory");
    this.winScreenEl = getRequiredElement(doc, "win-screen");
  }

  showMessage(text: string): void {
    this.messageEl.textContent = text;
  }

  updateInventory(itemNames: string[]): void {
    this.inventoryEl.textContent = itemNames.length > 0 ? `Carrying: ${itemNames.join(", ")}` : "";
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
