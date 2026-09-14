import type { BestiaryEntry } from "./monster/BestiaryEntry";
import { buildMenuNav, type MenuNavCallbacks } from "./MenuNav";

/**
 * The bestiary/codex screen (docs/05-combat.md#the-bestiary,
 * docs/08-roadmap-phases.md Phase 4): once a monster type has been
 * encountered (win, lose, or flee), its resistance/weakness, inflicted
 * status, and signature mechanic become visible here — small scope, a
 * list + detail view, but this is what turns "I got lucky" into
 * "I remembered its weakness" on a repeat encounter. Purely a view over
 * whatever `Game` has recorded as encountered; owns no tracking logic
 * itself, same division of labor as `CombatUI`/`InventoryUI`.
 */
export class BestiaryUI {
  private readonly root: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private active = false;

  constructor(nav: MenuNavCallbacks) {
    this.root = document.createElement("div");
    this.root.id = "bestiary-ui";
    this.root.hidden = true;

    const header = document.createElement("div");
    header.id = "bestiary-header";
    const title = document.createElement("span");
    title.textContent = "Bestiary";
    // The shared cross-navigation row every menu screen in this family
    // shows (see MenuNav.ts) -- Options/Level Up are one tap from here
    // now, not a detour back through Inventory first.
    header.append(title, buildMenuNav("bestiary", "bestiary", nav));

    this.bodyEl = document.createElement("div");
    this.bodyEl.id = "bestiary-body";

    this.root.append(header, this.bodyEl);
    document.body.appendChild(this.root);
  }

  get isActive(): boolean {
    return this.active;
  }

  show(): void {
    this.active = true;
    this.root.hidden = false;
  }

  hide(): void {
    this.active = false;
    this.root.hidden = true;
  }

  render(entries: BestiaryEntry[]): void {
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.id = "bestiary-empty";
      empty.textContent = "Nothing encountered yet.";
      this.bodyEl.replaceChildren(empty);
      return;
    }

    this.bodyEl.replaceChildren(...entries.map((entry) => this.buildEntry(entry)));
  }

  private buildEntry(entry: BestiaryEntry): HTMLElement {
    const card = document.createElement("div");
    card.className = "bestiary-entry";

    const name = document.createElement("div");
    name.className = "bestiary-entry-name";
    name.textContent = entry.name;
    card.appendChild(name);

    const lines: string[] = [];
    for (const { damageType, multiplier } of entry.resistances) {
      const label = damageType.charAt(0).toUpperCase() + damageType.slice(1);
      lines.push(multiplier < 1 ? `Resistant to ${label} (${multiplier}×)` : `Weak to ${label} (${multiplier}×)`);
    }
    if (entry.inflicts) {
      const status = entry.inflicts.charAt(0).toUpperCase() + entry.inflicts.slice(1);
      lines.push(`Its heavy strike inflicts ${status}`);
    }
    if (entry.healsOnHeavyTurn) {
      lines.push(`Heals itself instead of attacking every other turn`);
    }
    if (lines.length === 0) {
      lines.push("No known resistances or special mechanics — a straightforward fight.");
    }

    for (const line of lines) {
      const lineEl = document.createElement("div");
      lineEl.className = "bestiary-entry-line";
      lineEl.textContent = line;
      card.appendChild(lineEl);
    }

    return card;
  }
}
