import type { CombatActionChoice, CombatEngine } from "./CombatEngine";
import { CONSUMABLE_ITEMS } from "./Consumable";
import type { Monster } from "../monster/Monster";
import type { Inventory } from "../Inventory";
import { CLASS_ABILITIES } from "../party/classes";
import type { Character } from "../party/Character";

const ACTIONS: Array<{ choice: CombatActionChoice; label: string; key: string }> = [
  { choice: "attack", label: "Attack", key: "Digit1" },
  { choice: "defend", label: "Defend", key: "Digit2" },
  { choice: "ability", label: "Ability", key: "Digit3" },
  { choice: "flee", label: "Flee", key: "Digit4" },
];

/**
 * The combat DOM overlay (docs/07-technical-architecture.md "UI layer"
 * — plain DOM, not in-3D) shown on top of the first-person view during
 * a fight, per docs/05-combat.md: no separate battle scene, the
 * corridor you were walking becomes the battlefield. Purely a view over
 * `CombatEngine` state — it owns no combat rules itself.
 */
export class CombatUI {
  private readonly root: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly logEl: HTMLElement;
  private readonly actionsEl: HTMLElement;
  private readonly itemsEl: HTMLElement;
  private readonly buttons: Map<CombatActionChoice, HTMLButtonElement> = new Map();
  private active = false;

  constructor(private readonly onAction: (choice: CombatActionChoice, itemId?: string) => void) {
    this.root = document.createElement("div");
    this.root.id = "combat-ui";
    this.root.hidden = true;

    this.statusEl = document.createElement("div");
    this.statusEl.id = "combat-status";

    this.logEl = document.createElement("div");
    this.logEl.id = "combat-log";

    this.actionsEl = document.createElement("div");
    this.actionsEl.id = "combat-actions";
    for (const { choice, label } of ACTIONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "combat-action-btn";
      button.textContent = label;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (button.disabled) return;
        this.onAction(choice);
      });
      this.actionsEl.appendChild(button);
      this.buttons.set(choice, button);
    }

    // A separate row, rebuilt every render: which items are offered
    // changes turn to turn (something gets used up), unlike the four
    // fixed actions above.
    this.itemsEl = document.createElement("div");
    this.itemsEl.id = "combat-items";

    this.root.append(this.statusEl, this.logEl, this.actionsEl, this.itemsEl);
    document.body.appendChild(this.root);

    window.addEventListener("keydown", (event) => {
      if (!this.active) return;
      const action = ACTIONS.find((a) => a.key === event.code);
      if (!action) return;
      const button = this.buttons.get(action.choice);
      if (button?.disabled) return;
      event.preventDefault();
      this.onAction(action.choice);
    });
  }

  show(): void {
    this.active = true;
    this.root.hidden = false;
  }

  hide(): void {
    this.active = false;
    this.root.hidden = true;
  }

  /** Refreshes the displayed state from the engine — call after every action. */
  render(engine: CombatEngine, monster: Monster, inventory: Inventory): void {
    this.statusEl.textContent = `${monster.name}: ${monster.hp}/${monster.maxHp} HP`;
    this.logEl.textContent = engine.log.slice(-6).join("\n");
    this.actionsEl.hidden = !engine.isPartyTurn;
    this.renderItems(engine.isPartyTurn, inventory);
    if (!engine.isPartyTurn) return;

    const actor = engine.currentActor as Character;
    const ability = CLASS_ABILITIES[actor.classId];
    const abilityButton = this.buttons.get("ability");
    if (abilityButton) {
      const canAfford = actor.mana >= ability.manaCost;
      abilityButton.disabled = !canAfford;
      abilityButton.textContent = ability.manaCost > 0 ? `${ability.name} (${ability.manaCost} MP)` : ability.name;
      abilityButton.title = ability.description;
    }
  }

  private renderItems(isPartyTurn: boolean, inventory: Inventory): void {
    this.itemsEl.replaceChildren();
    const usable = inventory.entries().filter((entry) => CONSUMABLE_ITEMS[entry.id]);
    if (!isPartyTurn || usable.length === 0) {
      this.itemsEl.hidden = true;
      return;
    }
    this.itemsEl.hidden = false;

    for (const { id, name, count } of usable) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "combat-action-btn combat-item-btn";
      button.textContent = `${name} x${count}`;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.onAction("item", id);
      });
      this.itemsEl.appendChild(button);
    }
  }
}
