import { EQUIPMENT_ITEMS, type EquipmentSlot } from "./party/Equipment";
import type { Character } from "./party/Character";
import type { Party } from "./party/Party";
import type { Inventory } from "./Inventory";
import { buildMenuNav, type MenuNavCallbacks } from "./MenuNav";

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
  private readonly levelUpButton: HTMLButtonElement;
  private selectedItemId: string | undefined;
  private active = false;
  /** The state from the last `render()` call, so a tap that only changes UI-local selection (not game state) can re-render without the caller passing them again. */
  private lastParty: Party | undefined;
  private lastInventory: Inventory | undefined;

  constructor(
    private readonly onEquip: (characterName: string, itemId: string) => void,
    private readonly onUnequip: (characterName: string, slot: EquipmentSlot) => void,
    nav: MenuNavCallbacks,
  ) {
    this.root = document.createElement("div");
    this.root.id = "inventory-ui";
    this.root.hidden = true;

    const header = document.createElement("div");
    header.id = "inventory-header";
    const title = document.createElement("span");
    title.textContent = "Inventory";

    // Save/Bestiary/Level Up/Options/Close: the shared cross-navigation
    // row every menu screen in this family shows now (docs/08-roadmap-phases.md
    // Phase 7, on a player report that reaching those other screens
    // "required going through the inventory screen first") — see
    // MenuNav.ts. Save itself doesn't close the screen; Game shows a
    // HUD confirmation instead.
    const actions = buildMenuNav("inventory", "inventory", nav);
    header.append(title, actions);
    this.levelUpButton = actions.querySelector<HTMLButtonElement>("#inventory-levelUp")!;

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

    // A visible reason to actually open the screen -- otherwise a
    // level-up's points would sit unspent indefinitely with nothing
    // drawing attention to them (docs/08-roadmap-phases.md Phase 7).
    const totalPoints = party.members.reduce((sum, member) => sum + member.skillPoints, 0);
    this.levelUpButton.textContent = totalPoints > 0 ? `Level Up (${totalPoints})` : "Level Up";
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
