import type { CombatActionChoice, CombatEngine } from "./CombatEngine";
import type { Monster } from "../monster/Monster";

const ACTIONS: Array<{ choice: CombatActionChoice; label: string; key: string }> = [
  { choice: "attack", label: "Attack", key: "Digit1" },
  { choice: "defend", label: "Defend", key: "Digit2" },
  { choice: "flee", label: "Flee", key: "Digit3" },
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
  private active = false;

  constructor(private readonly onAction: (choice: CombatActionChoice) => void) {
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
        this.onAction(choice);
      });
      this.actionsEl.appendChild(button);
    }

    this.root.append(this.statusEl, this.logEl, this.actionsEl);
    document.body.appendChild(this.root);

    window.addEventListener("keydown", (event) => {
      if (!this.active) return;
      const action = ACTIONS.find((a) => a.key === event.code);
      if (!action) return;
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
  render(engine: CombatEngine, monster: Monster): void {
    this.statusEl.textContent = `${monster.name}: ${monster.hp}/${monster.maxHp} HP`;
    this.logEl.textContent = engine.log.slice(-6).join("\n");
    this.actionsEl.hidden = !engine.isPartyTurn;
  }
}
