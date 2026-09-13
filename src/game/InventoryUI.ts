import { EQUIPMENT_ITEMS, type EquipmentSlot } from "./party/Equipment";
import type { Character } from "./party/Character";
import type { Party } from "./party/Party";
import type { Inventory } from "./Inventory";

const SLOTS: Array<{ slot: EquipmentSlot; label: string }> = [
  { slot: "weapon", label: "Weapon" },
  { slot: "offhand", label: "Off-hand" },
  { slot: "armor", label: "Armor" },
  { slot: "accessory", label: "Accessory" },
];

/**
 * The inventory/equip DOM overlay (docs/07-technical-architecture.md
 * "UI layer" — plain DOM, same family as `CombatUI`): view what the
 * party carries and, per docs/08-roadmap-phases.md Phase 3 batch 4,
 * actually choose who wears what rather than a level auto-equipping it.
 * Owns no equip rules itself -- taps a carried item then a slot, and
 * hands both to `onEquip`/`onUnequip`, which call `GameLogic.ts`'s
 * `equipItem`/`unequipItem`. Never shows an item's mechanical effect,
 * only its name, per docs/06-items-and-equipment.md#discovery-not-explanation.
 */
export class InventoryUI {
  private readonly root: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private selectedItemId: string | undefined;
  private active = false;
  /** The state from the last `render()` call, so a tap that only changes UI-local selection (not game state) can re-render without the caller passing them again. */
  private lastParty: Party | undefined;
  private lastInventory: Inventory | undefined;

  constructor(
    private readonly onEquip: (characterName: string, itemId: string) => void,
    private readonly onUnequip: (characterName: string, slot: EquipmentSlot) => void,
    private readonly onClose: () => void,
    private readonly onSave: () => void,
    private readonly onOpenBestiary: () => void,
  ) {
    this.root = document.createElement("div");
    this.root.id = "inventory-ui";
    this.root.hidden = true;

    const header = document.createElement("div");
    header.id = "inventory-header";
    const title = document.createElement("span");
    title.textContent = "Inventory";

    // A natural "pause menu" spot for Save (docs/08-roadmap-phases.md
    // Phase 4) -- this screen is already the one place exploration
    // fully stops, so saving here needs no separate always-visible
    // corner button. Doesn't close the screen; Game shows a HUD
    // confirmation instead.
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.id = "inventory-save";
    saveButton.textContent = "Save";
    saveButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.onSave();
    });

    const bestiaryButton = document.createElement("button");
    bestiaryButton.type = "button";
    bestiaryButton.id = "inventory-bestiary";
    bestiaryButton.textContent = "Bestiary";
    bestiaryButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.onOpenBestiary();
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.id = "inventory-close";
    closeButton.textContent = "Close";
    // Notifies Game rather than calling this.hide() directly -- Game
    // owns the mode transition (back to "explore") and the input-queue
    // clear that goes with it (see InputManager.clear()); hide() here
    // is just the DOM half of closing, which Game still calls itself
    // once it's done its side, same as the Escape-key/toggle-button path.
    closeButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.onClose();
    });

    const actions = document.createElement("div");
    actions.id = "inventory-header-actions";
    actions.append(saveButton, bestiaryButton, closeButton);
    header.append(title, actions);

    this.bodyEl = document.createElement("div");
    this.bodyEl.id = "inventory-body";

    this.root.append(header, this.bodyEl);
    document.body.appendChild(this.root);
  }

  get isActive(): boolean {
    return this.active;
  }

  show(): void {
    this.active = true;
    this.selectedItemId = undefined;
    this.root.hidden = false;
  }

  hide(): void {
    this.active = false;
    this.root.hidden = true;
  }

  /** Refreshes the displayed state — call after every equip/unequip, and once right after `show()`. */
  render(party: Party, inventory: Inventory): void {
    this.lastParty = party;
    this.lastInventory = inventory;
    this.bodyEl.replaceChildren(this.buildCarriedSection(inventory), this.buildPartySection(party));
  }

  private rerender(): void {
    if (this.lastParty && this.lastInventory) this.render(this.lastParty, this.lastInventory);
  }

  private buildCarriedSection(inventory: Inventory): HTMLElement {
    const section = document.createElement("div");
    section.id = "inventory-carried";

    const heading = document.createElement("div");
    heading.className = "inventory-heading";
    heading.textContent = "Carried";
    section.appendChild(heading);

    const entries = inventory.entries();
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inventory-empty";
      empty.textContent = "Nothing carried.";
      section.appendChild(empty);
      return section;
    }

    for (const { id, name, count } of entries) {
      const gearItem = EQUIPMENT_ITEMS[id];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inventory-item-btn";
      button.textContent = count > 1 ? `${name} x${count}` : name;

      if (!gearItem) {
        // A key item or consumable -- there's nothing to equip it into,
        // so it's shown for reference only, same idea as the HUD's
        // "Carrying:" line, not a dead-looking disabled control.
        button.classList.add("not-equippable");
      } else {
        if (id === this.selectedItemId) button.classList.add("selected");
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          this.selectedItemId = this.selectedItemId === id ? undefined : id;
          this.rerender();
        });
      }
      section.appendChild(button);
    }
    return section;
  }

  private buildPartySection(party: Party): HTMLElement {
    const section = document.createElement("div");
    section.id = "inventory-party";

    const selectedItem = this.selectedItemId ? EQUIPMENT_ITEMS[this.selectedItemId] : undefined;

    for (const character of party.members) {
      const card = document.createElement("div");
      card.className = "inventory-character";

      const name = document.createElement("div");
      name.className = "inventory-character-name";
      name.textContent = `${character.portrait} ${character.name} (Lv${character.level})${character.isDown ? " — down" : ""}`;
      card.appendChild(name);

      for (const { slot, label } of SLOTS) {
        const worn = character.equippedIn(slot);
        const row = document.createElement("button");
        row.type = "button";
        row.className = "inventory-slot-btn";
        row.textContent = worn ? `${label}: ${worn.name}` : `${label}: (empty)`;
        if (selectedItem && selectedItem.slot === slot) row.classList.add("match");
        row.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          this.handleSlotClick(character, slot, worn !== undefined);
        });
        card.appendChild(row);
      }
      section.appendChild(card);
    }
    return section;
  }

  private handleSlotClick(character: Character, slot: EquipmentSlot, hasItem: boolean): void {
    if (this.selectedItemId) {
      const item = EQUIPMENT_ITEMS[this.selectedItemId];
      if (item.slot !== slot) return; // wrong slot for the selected item -- ignore the tap
      this.onEquip(character.name, this.selectedItemId);
      this.selectedItemId = undefined;
      return;
    }
    if (hasItem) this.onUnequip(character.name, slot);
  }
}
