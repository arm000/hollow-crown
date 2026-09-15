import type { Combatant, CombatActionChoice, CombatEngine } from "./CombatEngine";
import { CONSUMABLE_ITEMS } from "./Consumable";
import type { Monster } from "../monster/Monster";
import type { Inventory } from "../Inventory";
import type { Character } from "../party/Character";
import { SKILLS } from "../party/Skills";

/** `Combatant` narrowed to whichever side has a `portrait` — only `Character` does; a monster's pill falls back to a plain icon instead. */
function portraitOf(combatant: Combatant): string {
  return combatant.side === "party" ? combatant.portrait : "💀";
}

/**
 * Attack/Defend/Flee keep their fixed hotkeys; a class's skills (one or
 * two, once a second is unlocked — docs/08-roadmap-phases.md Phase 7)
 * no longer fit one static "Ability" slot, so they get their own row
 * below, built fresh every render the same way `renderItems` already
 * builds the consumables row — tap/click only, no hotkey, matching that
 * row's existing precedent rather than inventing a new one.
 */
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
  private readonly initiativeEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly logEl: HTMLElement;
  private readonly actionsEl: HTMLElement;
  private readonly skillsEl: HTMLElement;
  private readonly itemsEl: HTMLElement;
  private readonly buttons: Map<CombatActionChoice, HTMLButtonElement> = new Map();
  private active = false;

  constructor(private readonly onAction: (choice: CombatActionChoice, itemId?: string, skillId?: string) => void) {
    this.root = document.createElement("div");
    this.root.id = "combat-ui";
    this.root.hidden = true;

    // The initiative tracker (docs/08-roadmap-phases.md Phase 6, added
    // on a player request to "plan ahead"): one pill per combatant in
    // this round's `turnQueue`, in order, so the party can see the
    // monster's turn coming and choose to Defend ahead of it rather
    // than reacting after the fact. Rebuilt every render (the same
    // "cheap to just redraw" choice `renderItems` already makes below)
    // since who's still alive, and where the current turn sits, can
    // both change from one render to the next.
    this.initiativeEl = document.createElement("div");
    this.initiativeEl.id = "combat-initiative";

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

    // The current actor's known skills -- rebuilt every render, same
    // reasoning as itemsEl below: who's acting, and what they know,
    // both change turn to turn.
    this.skillsEl = document.createElement("div");
    this.skillsEl.id = "combat-skills";

    // A separate row, rebuilt every render: which items are offered
    // changes turn to turn (something gets used up), unlike the fixed
    // actions above.
    this.itemsEl = document.createElement("div");
    this.itemsEl.id = "combat-items";

    this.root.append(this.initiativeEl, this.statusEl, this.logEl, this.actionsEl, this.skillsEl, this.itemsEl);
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
    this.renderInitiative(engine);
    this.statusEl.textContent = `${monster.name}: ${monster.hp}/${monster.maxHp} HP`;
    this.logEl.textContent = engine.log.slice(-6).join("\n");
    this.actionsEl.hidden = !engine.isPartyTurn;
    this.renderSkills(engine.isPartyTurn ? (engine.currentActor as Character) : undefined);
    this.renderItems(engine.isPartyTurn, inventory);
  }

  /**
   * One button per skill the current actor actually knows (docs/08-roadmap-phases.md
   * Phase 7) — one for most of the game, two once a character's second
   * skill is unlocked. `undefined` (not this actor's turn, or combat
   * over) just clears the row, same as `renderItems` does for its own
   * "nothing to show right now" case.
   */
  private renderSkills(actor: Character | undefined): void {
    this.skillsEl.replaceChildren();
    if (!actor) {
      this.skillsEl.hidden = true;
      return;
    }
    this.skillsEl.hidden = false;

    const known = new Set(actor.listKnownSkillIds());
    for (const skill of SKILLS[actor.classId]) {
      if (!known.has(skill.id)) continue;
      const onCooldown = !actor.isSkillReady(skill.id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "combat-action-btn combat-skill-btn";
      button.textContent = onCooldown
        ? `${skill.name} (${actor.cooldownRemaining(skill.id)}↻)`
        : skill.manaCost > 0
          ? `${skill.name} (${skill.manaCost} MP)`
          : skill.name;
      button.title = onCooldown
        ? `${skill.description} -- recharging, ${actor.cooldownRemaining(skill.id)} more turn${actor.cooldownRemaining(skill.id) === 1 ? "" : "s"}.`
        : skill.description;
      button.disabled = onCooldown || actor.mana < skill.manaCost;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (button.disabled) return;
        this.onAction("ability", undefined, skill.id);
      });
      this.skillsEl.appendChild(button);
    }
  }

  /**
   * One pill per entry in `engine.turnQueue`, in order: `"acted"` for
   * anyone whose slot already passed this round (index before
   * `currentTurnIndex`), `"current"` for whoever's turn it is right
   * now, and plain/upcoming for everyone still to come. A combatant who
   * went down mid-round (a monster's attack landing between their name
   * being rolled into the order and their turn actually arriving) still
   * reads live off the combatant itself, not a snapshot, so a downed
   * ally's pill reflects that immediately rather than lagging a render.
   */
  private renderInitiative(engine: CombatEngine): void {
    this.initiativeEl.replaceChildren();
    const queue = engine.turnQueue;
    const currentIndex = engine.currentTurnIndex;

    queue.forEach((combatant, index) => {
      const pill = document.createElement("div");
      pill.className = "initiative-pill";
      if (combatant.isDown) pill.classList.add("down");
      else if (index === currentIndex) pill.classList.add("current");
      else if (index < currentIndex) pill.classList.add("acted");

      const icon = document.createElement("span");
      icon.className = "initiative-icon";
      icon.textContent = portraitOf(combatant);

      const name = document.createElement("span");
      name.className = "initiative-name";
      name.textContent = combatant.name;

      pill.append(icon, name);
      this.initiativeEl.appendChild(pill);
    });
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
