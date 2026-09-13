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
  private readonly defeatScreenEl: HTMLElement;
  private readonly inventoryToggleEl: HTMLElement;

  constructor(doc: Document = document) {
    this.messageEl = getRequiredElement(doc, "hud-message");
    this.inventoryEl = getRequiredElement(doc, "hud-inventory");
    this.partyEl = getRequiredElement(doc, "hud-party");
    this.winScreenEl = getRequiredElement(doc, "win-screen");
    this.defeatScreenEl = getRequiredElement(doc, "defeat-screen");
    this.inventoryToggleEl = getRequiredElement(doc, "inventory-toggle");
  }

  showMessage(text: string): void {
    this.messageEl.textContent = text;
  }

  updateInventory(itemNames: string[]): void {
    this.inventoryEl.textContent = itemNames.length > 0 ? `Carrying: ${itemNames.join(", ")}` : "";
  }

  updateParty(members: Character[]): void {
    this.partyEl.textContent = members
      .map((member) => {
        const status = `${member.name} Lv${member.level} ${member.hp}/${member.maxHp}${member.isDown ? " (down)" : ""}`;
        const gear = member.listEquipment();
        return gear.length > 0 ? `${status} [${gear.map((item) => item.name).join(", ")}]` : status;
      })
      .join("\n");
  }

  showWinScreen(): void {
    this.winScreenEl.hidden = false;
  }

  /** Phase 2's defeat stub (docs/08-roadmap-phases.md#phase-2--party--turn-based-combat) — ends the run, no revive system yet. */
  showDefeatScreen(): void {
    this.defeatScreenEl.hidden = false;
  }

  /** Wires the always-visible "Inventory" button (works by mouse click or touch tap alike, unlike the touch-only move/turn pads) — `Game` decides whether the tap is actually allowed to open anything right now. */
  onInventoryToggle(callback: () => void): void {
    this.inventoryToggleEl.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      callback();
    });
  }
}

function getRequiredElement(doc: Document, id: string): HTMLElement {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`Missing #${id} element`);
  return el;
}
