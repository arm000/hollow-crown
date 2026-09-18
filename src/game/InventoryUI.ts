import { CONSUMABLE_ITEMS } from "./combat/Consumable";
import { describeEquipmentEffect, EQUIPMENT_ITEMS, identifiedStatBonus, type EquipmentSlot } from "./party/Equipment";
import { classLabel, STAT_DESCRIPTIONS, STAT_LABELS, type Character, type CharacterStats } from "./party/Character";
import type { Party } from "./party/Party";
import { SKILLS } from "./party/Skills";
import type { Inventory } from "./Inventory";
import { buildMenuNav, type MenuNavCallbacks } from "./MenuNav";

const SLOTS: Array<{ slot: EquipmentSlot; label: string }> = [
  { slot: "weapon", label: "Weapon" },
  { slot: "offhand", label: "Off-hand" },
  { slot: "armor", label: "Armor" },
  { slot: "accessory", label: "Accessory" },
];

const STAT_ORDER: Array<keyof CharacterStats> = ["might", "grace", "vitality", "focus", "resolve"];

/**
 * The character-sheet DOM overlay (docs/07-technical-architecture.md
 * "UI layer" — plain DOM, same family as `CombatUI`), reachable from
 * the always-visible "Inventory" HUD button/`I` key. Player request
 * (docs/08-roadmap-phases.md Phase 7): "I want to inspect a
 * character's attributes and skills from the inventory screen so I
 * can see the effect of inventory changes. Change the inventory
 * screen to be a character sheet with attributes, skills, and
 * inventory all as one." This absorbed the whole of the previous,
 * separate `LevelUpUI` screen — its stat/skill rows, its spending
 * logic's UI, everything — rather than the two staying independent;
 * the class (and its DOM ids/HUD button) kept the `Inventory` name it
 * already had, since that's still the entry point, even though it now
 * shows considerably more than gear.
 *
 * **One character at a time, via tabs** (player request: "Focus on
 * one character at a time with tabs to go between characters"), not
 * the old scrolling list of every party member's card stacked
 * vertically — `activeCharacterIndex` picks which one `buildCharacterSheet`
 * actually renders. The shared inventory (`buildCarriedSection`)
 * renders on every tab regardless (player request: "Show the shared
 * inventory on each character sheet") — it's the same one pool no
 * matter whose tab you're looking at, so selecting a consumable or a
 * piece of gear and then switching tabs to whoever should receive it
 * is the normal flow (`selectedItemId` deliberately survives a tab
 * switch, only `rerender`s).
 *
 * **Stat/skill spending is gated behind a "Level Up" toggle**
 * (player request: "add a 'Level Up' button that unlocks the +1
 * buttons and the skill selection. Those buttons should be dismissed
 * if someone cancels the level up action, or confirms the level up
 * choices"). `editMode` is the only state this adds — there is no
 * staging/undo behind it: `onSpendStat`/`onUnlockSkill` still apply
 * immediately and permanently the instant a `+1`/`Unlock` button is
 * tapped, exactly as `LevelUpUI` always did (this game has no respec,
 * anywhere — see docs/03-party-and-characters.md#leveling). "Cancel"
 * and "Confirm" are therefore behaviorally identical: both just set
 * `editMode` back to `false`, hiding those buttons again — the
 * request is specifically about the *buttons* being dismissed, not
 * about reverting anything, and there's nothing to revert.
 *
 * Owns no equip/use/spend rules itself -- taps a carried item then
 * either a slot or the "Use" button, or a `+1`/`Unlock` button once
 * editing, and hands the pair to `onEquip`/`onUnequip`/
 * `onUseConsumable`/`onSpendStat`/`onUnlockSkill`, which call
 * `GameLogic.ts`'s matching functions. Never shows an item's
 * mechanical effect ahead of first use, only its name, per
 * docs/06-items-and-equipment.md#discovery-not-explanation.
 */
export class InventoryUI {
  private readonly root: HTMLElement;
  private readonly tabsEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private selectedItemId: string | undefined;
  private activeCharacterIndex = 0;
  /** Whether the `+1`/`Unlock` controls are currently shown at all — see the class doc comment's "Level Up" section. */
  private editMode = false;
  private active = false;
  /** The state from the last `render()` call, so a tap that only changes UI-local selection (not game state) can re-render without the caller passing them again. */
  private lastParty: Party | undefined;
  private lastInventory: Inventory | undefined;

  constructor(
    private readonly onEquip: (characterName: string, itemId: string) => void,
    private readonly onUnequip: (characterName: string, slot: EquipmentSlot) => void,
    private readonly onUseConsumable: (characterName: string, itemId: string) => void,
    private readonly onSpendStat: (characterName: string, stat: keyof CharacterStats) => void,
    private readonly onUnlockSkill: (characterName: string, skillId: string) => void,
    nav: MenuNavCallbacks,
  ) {
    this.root = document.createElement("div");
    this.root.id = "inventory-ui";
    this.root.hidden = true;

    const header = document.createElement("div");
    header.id = "inventory-header";
    const title = document.createElement("span");
    title.textContent = "Character";

    // Save/Bestiary/Options/Close: the shared cross-navigation row
    // every menu screen in this family shows (docs/08-roadmap-phases.md
    // Phase 7, on a player report that reaching those other screens
    // "required going through the inventory screen first") — see
    // MenuNav.ts. "Level Up" is no longer one of these destinations:
    // it was never really a separate place to navigate *to* once it's
    // just this same screen's own edit mode. Save itself doesn't close
    // the screen; Game shows a HUD confirmation instead.
    const actions = buildMenuNav("inventory", "inventory", nav);
    header.append(title, actions);

    this.tabsEl = document.createElement("div");
    this.tabsEl.id = "inventory-tabs";

    this.bodyEl = document.createElement("div");
    this.bodyEl.id = "inventory-body";

    this.root.append(header, this.tabsEl, this.bodyEl);
    document.body.appendChild(this.root);
  }

  get isActive(): boolean {
    return this.active;
  }

  /**
   * `startInEditMode`, when true, is the always-visible "Level Up" HUD
   * button's own entry point (`Game.toggleLevelUp`): jumps straight
   * into edit mode and to the first character with unspent points,
   * rather than opening on gear with the player left to find Level Up
   * themselves. Falls back to whichever tab was last active if nobody
   * currently has points (shouldn't happen given how that HUD button
   * only glows when someone does, but not a reason to crash either).
   */
  show(startInEditMode = false): void {
    this.active = true;
    this.selectedItemId = undefined;
    this.editMode = startInEditMode;
    if (startInEditMode && this.lastParty) {
      const index = this.lastParty.members.findIndex((member) => member.skillPoints > 0);
      if (index >= 0) this.activeCharacterIndex = index;
    }
    this.root.hidden = false;
  }

  hide(): void {
    this.active = false;
    this.editMode = false;
    this.root.hidden = true;
  }

  /** Refreshes the displayed state — call after every equip/unequip/use/spend/unlock, and once right after `show()`. */
  render(party: Party, inventory: Inventory): void {
    this.lastParty = party;
    this.lastInventory = inventory;
    this.activeCharacterIndex = Math.min(this.activeCharacterIndex, party.members.length - 1);
    const active = party.members[this.activeCharacterIndex];

    this.tabsEl.replaceChildren(...party.members.map((character, index) => this.buildTab(character, index)));
    this.bodyEl.replaceChildren(this.buildCharacterSheet(active, inventory), this.buildCarriedSection(inventory));
  }

  private rerender(): void {
    if (this.lastParty && this.lastInventory) this.render(this.lastParty, this.lastInventory);
  }

  private buildTab(character: Character, index: number): HTMLElement {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "inventory-tab-btn";
    tab.textContent =
      character.skillPoints > 0 ? `${character.portrait} ${character.name} (${character.skillPoints})` : `${character.portrait} ${character.name}`;
    if (index === this.activeCharacterIndex) tab.classList.add("selected");
    tab.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (index === this.activeCharacterIndex) return;
      this.activeCharacterIndex = index;
      this.rerender();
    });
    return tab;
  }

  private buildCharacterSheet(character: Character, inventory: Inventory): HTMLElement {
    const section = document.createElement("div");
    section.id = "inventory-sheet";

    const header = document.createElement("div");
    header.className = "inventory-sheet-header";
    header.textContent = `${character.portrait} ${character.name} (Lv${character.level})${character.isDown ? " — down" : ""}`;
    const points = document.createElement("span");
    points.className = "inventory-points";
    points.textContent = `${character.skillPoints} point${character.skillPoints === 1 ? "" : "s"}`;
    header.appendChild(points);
    section.appendChild(header);
    section.appendChild(this.buildMetaRow(character));
    section.appendChild(this.buildLevelUpControls());

    const useRow = this.buildUseConsumableRow(character);
    if (useRow) section.appendChild(useRow);

    section.appendChild(this.buildHeading("Stats"));
    for (const stat of STAT_ORDER) section.appendChild(this.buildStatRow(character, stat, inventory));

    section.appendChild(this.buildHeading("Skills"));
    for (const skill of SKILLS[character.classId]) section.appendChild(this.buildSkillRow(character, skill.id));

    section.appendChild(this.buildHeading("Equipment"));
    for (const row of this.buildEquipmentRows(character, inventory)) section.appendChild(row);

    return section;
  }

  private buildHeading(text: string): HTMLElement {
    const heading = document.createElement("div");
    heading.className = "inventory-heading";
    heading.textContent = text;
    return heading;
  }

  /**
   * Class and current HP/Mana (player request, back when this lived on
   * the separate Level Up screen: "The level up screen should show
   * each character's class and HP / Mana Points") — a point spent on
   * Vitality or Focus changes these numbers right on this same sheet
   * (`Character.spendPointOnStat`'s max-HP/Mana nudge), so seeing them
   * here is what actually lets a player judge the effect of that
   * choice in context. Mana is omitted for a class with none (Warrior,
   * Rogue) — `maxMana` for those is always 0 and always will be, so
   * "0/0 Mana" would just be noise, not information.
   */
  private buildMetaRow(character: Character): HTMLElement {
    const row = document.createElement("div");
    row.className = "inventory-meta";
    const parts = [classLabel(character.classId), `${character.hp}/${character.maxHp} HP`];
    if (character.maxMana > 0) parts.push(`${character.mana}/${character.maxMana} Mana`);
    row.textContent = parts.join(" — ");
    return row;
  }

  /**
   * The "Level Up" toggle, and what replaces it once tapped (player
   * request: "add a 'Level Up' button that unlocks the +1 buttons and
   * the skill selection. Those buttons should be dismissed if someone
   * cancels the level up action, or confirms the level up choices").
   * Cancel and Confirm are deliberately identical in effect — see the
   * class doc comment's "Level Up" section for why there's nothing to
   * actually undo.
   */
  private buildLevelUpControls(): HTMLElement {
    const row = document.createElement("div");
    row.className = "inventory-row inventory-levelup-row";

    if (!this.editMode) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inventory-btn";
      button.textContent = "Level Up";
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.editMode = true;
        this.rerender();
      });
      row.appendChild(button);
      return row;
    }

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "inventory-btn inventory-btn-cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.editMode = false;
      this.rerender();
    });
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "inventory-btn inventory-btn-confirm";
    confirm.textContent = "Confirm";
    confirm.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.editMode = false;
      this.rerender();
    });
    row.append(cancel, confirm);
    return row;
  }

  /**
   * The stat's own displayed number reflects identified equipment's
   * bonus (`Equipment.identifiedStatBonus`), colored to call it out
   * (player request: "when I've identified an item, the impact on
   * attributes should be visible when I equip/unequip the item, the
   * attribute value should change and change color to show it was
   * modified by an item"). Equip/unequip already calls `render()` (via
   * `Game.handleEquip`/`handleUnequip`), so the number and its color
   * update the instant either happens — no separate wiring needed here.
   */
  private buildStatRow(character: Character, stat: keyof CharacterStats, inventory: Inventory): HTMLElement {
    const wrapper = document.createElement("div");

    const row = document.createElement("div");
    row.className = "inventory-row";

    // One flex child, not two -- `.inventory-row` is `justify-content:
    // space-between` between exactly this and the `+1` button (when
    // shown), so the label and its value have to share a single
    // element or `space-between` would shove them apart from each
    // other instead of just away from the button.
    const labelWrap = document.createElement("span");
    const label = document.createElement("span");
    label.textContent = `${STAT_LABELS[stat]}: `;
    labelWrap.appendChild(label);

    const identifiedBonus = identifiedStatBonus(character, stat, inventory);
    const value = document.createElement("span");
    value.textContent = `${character.stats[stat] + identifiedBonus}`;
    if (identifiedBonus !== 0) {
      value.className = identifiedBonus > 0 ? "inventory-stat-boosted" : "inventory-stat-reduced";
      value.textContent += ` (${identifiedBonus > 0 ? "+" : ""}${identifiedBonus})`;
    }
    labelWrap.appendChild(value);
    row.appendChild(labelWrap);

    if (this.editMode) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inventory-btn";
      button.textContent = "+1";
      button.disabled = character.skillPoints <= 0;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (button.disabled) return;
        this.onSpendStat(character.name, stat);
      });
      row.appendChild(button);
    }
    wrapper.appendChild(row);

    // Always visible, not a hover tooltip -- player report: "The
    // tooltips don't work on mobile touch screen because I can't
    // hover over."
    const description = document.createElement("div");
    description.className = "inventory-description";
    description.textContent = STAT_DESCRIPTIONS[stat];
    wrapper.appendChild(description);

    return wrapper;
  }

  private buildSkillRow(character: Character, skillId: string): HTMLElement {
    const skill = SKILLS[character.classId].find((candidate) => candidate.id === skillId)!;
    const wrapper = document.createElement("div");

    const row = document.createElement("div");
    row.className = "inventory-row";

    const label = document.createElement("span");
    row.appendChild(label);

    // Always visible, not a hover tooltip -- same reasoning as
    // buildStatRow's own description. Shown regardless of known/
    // locked/unlockable state, same as the label text next to it
    // always is.
    const description = document.createElement("div");
    description.className = "inventory-description";
    description.textContent = skill.description;

    const finish = (): HTMLElement => {
      wrapper.append(row, description);
      return wrapper;
    };

    if (character.knowsSkill(skill.id)) {
      label.textContent = `${skill.name} — known`;
      return finish();
    }

    // A skill locked out by the other side of its own fork already
    // being chosen (docs/08-roadmap-phases.md Phase 7's "real build
    // fork, not a checklist") shows why, but offers no button — there's
    // no respec, `GameLogic.unlockSkill` would just refuse it anyway.
    if (skill.exclusiveWith && character.knowsSkill(skill.exclusiveWith)) {
      const chosen = SKILLS[character.classId].find((candidate) => candidate.id === skill.exclusiveWith)!;
      label.textContent = `${skill.name} — unavailable (chose ${chosen.name})`;
      return finish();
    }

    label.textContent = `${skill.name} (${skill.unlockCost} points)`;
    if (this.editMode) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inventory-btn";
      button.textContent = "Unlock";
      button.disabled = character.skillPoints < skill.unlockCost;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (button.disabled) return;
        this.onUnlockSkill(character.name, skill.id);
      });
      row.appendChild(button);
    }

    return finish();
  }

  /** A cure consumable, once selected from `Carried`, shows a single "Use" button targeting whichever character's tab is currently active — there's only one character visible at a time now, so there's no longer a per-character list of buttons to choose from (docs/08-roadmap-phases.md Phase 7's original "use consumables outside combat" feature); switching tabs before tapping it is how a player targets someone else. `undefined` when nothing selected, or the selection isn't a usable cure item. */
  private buildUseConsumableRow(character: Character): HTMLElement | undefined {
    const consumable = this.selectedItemId ? CONSUMABLE_ITEMS[this.selectedItemId] : undefined;
    if (!consumable || consumable.effect.kind !== "cure") return undefined;

    const row = document.createElement("div");
    row.className = "inventory-row";
    const useButton = document.createElement("button");
    useButton.type = "button";
    useButton.className = "inventory-use-btn";
    useButton.textContent = `Use ${consumable.name}`;
    useButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      // Cleared *before* the callback, not after: `onUseConsumable`
      // synchronously triggers `Game.refreshInventoryUI` -> `render`
      // -- clearing the selection only afterward left that re-render
      // still seeing the just-used item as selected, so this same
      // "Use" button got redrawn right back, live and clickable, even
      // though the item was already gone (player report: "the potion
      // disappears but the button stays").
      this.selectedItemId = undefined;
      this.onUseConsumable(character.name, consumable.id);
    });
    row.appendChild(useButton);
    return row;
  }

  private buildEquipmentRows(character: Character, inventory: Inventory): HTMLElement[] {
    const selectedEquipment = this.selectedItemId ? EQUIPMENT_ITEMS[this.selectedItemId] : undefined;
    const rows: HTMLElement[] = [];

    for (const { slot, label } of SLOTS) {
      const worn = character.equippedIn(slot);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "inventory-slot-btn";
      row.textContent = worn ? `${label}: ${worn.name}` : `${label}: (empty)`;
      if (selectedEquipment && selectedEquipment.slot === slot) row.classList.add("match");
      row.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.handleSlotClick(character, slot, worn !== undefined);
      });
      rows.push(row);

      // A worn item is never in `Carried` (it's in a slot instead), so
      // it needs its own copy of the same "show the effect once
      // identified" treatment `buildCarriedSection` gives an item
      // still sitting in the bag -- without this, equipping something
      // and never taking it back off meant its description never
      // showed up anywhere at all (player report: "I used a rusted
      // sword in combat and it's effect still doesn't show").
      if (worn && inventory.isIdentified(worn.id)) {
        const description = document.createElement("div");
        description.className = "inventory-description";
        description.textContent = describeEquipmentEffect(worn);
        rows.push(description);
      }
    }
    return rows;
  }

  private buildCarriedSection(inventory: Inventory): HTMLElement {
    const section = document.createElement("div");
    section.id = "inventory-carried";

    section.appendChild(this.buildHeading("Carried"));

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
      const consumable = CONSUMABLE_ITEMS[id];
      const usableConsumable = consumable?.effect.kind === "cure" ? consumable : undefined;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inventory-item-btn";
      button.textContent = count > 1 ? `${name} x${count}` : name;

      if (gearItem || usableConsumable) {
        if (id === this.selectedItemId) button.classList.add("selected");
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          this.selectedItemId = this.selectedItemId === id ? undefined : id;
          this.rerender();
        });
      } else {
        // A key item, or a damage consumable with nothing to throw it
        // at outside combat -- there's nothing to equip or use it on
        // right now, so it's shown for reference only, same idea as
        // the HUD's "Carrying:" line, not a dead-looking disabled
        // control.
        button.classList.add("not-equippable");
      }
      section.appendChild(button);

      // A consumable's real effect stays hidden until it's actually
      // been used once, and a piece of gear's until it's actually been
      // worn once -- see docs/06-items-and-equipment.md#discovery-not-explanation.
      const description = consumable?.description ?? (gearItem ? describeEquipmentEffect(gearItem) : undefined);
      if (description && inventory.isIdentified(id)) {
        const descriptionEl = document.createElement("div");
        descriptionEl.className = "inventory-description";
        descriptionEl.textContent = description;
        section.appendChild(descriptionEl);
      }
    }
    return section;
  }

  private handleSlotClick(character: Character, slot: EquipmentSlot, hasItem: boolean): void {
    if (this.selectedItemId) {
      const item = EQUIPMENT_ITEMS[this.selectedItemId];
      if (!item || item.slot !== slot) return; // no equipment selected (a consumable is, instead), or the wrong slot for it -- ignore the tap either way
      // Same ordering fix as the "Use" button above: cleared before
      // the callback, since `onEquip` synchronously re-renders too.
      const itemId = this.selectedItemId;
      this.selectedItemId = undefined;
      this.onEquip(character.name, itemId);
      return;
    }
    if (hasItem) this.onUnequip(character.name, slot);
  }
}
