import { buildMenuNav, type MenuNavCallbacks } from "./MenuNav";
import { classLabel, STAT_DESCRIPTIONS, type Character, type CharacterStats } from "./party/Character";
import type { Party } from "./party/Party";
import { SKILLS } from "./party/Skills";

const STAT_ORDER: Array<keyof CharacterStats> = ["might", "grace", "vitality", "focus", "resolve"];
const STAT_LABELS: Record<keyof CharacterStats, string> = {
  might: "Might",
  grace: "Grace",
  vitality: "Vitality",
  focus: "Focus",
  resolve: "Resolve",
};

/**
 * The level-up allocation screen (docs/08-roadmap-phases.md Phase 7,
 * on a player request): where `Character.skillPoints` actually get
 * spent, on either a stat (+1 per point, via `spendStatPoint`) or a
 * class's second skill (a flat cost, via `unlockSkill`) — see
 * `GameLogic.ts` for both. Same DOM-overlay family as `InventoryUI`/
 * `BestiaryUI`/`OptionsUI`, reachable from any of them and back per
 * `MenuNav.ts`, and purely a view over `Party` state: it owns no
 * spending rules itself, same division of labor as every other screen
 * in this family.
 */
export class LevelUpUI {
  private readonly root: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private active = false;

  constructor(
    private readonly onSpendStat: (characterName: string, stat: keyof CharacterStats) => void,
    private readonly onUnlockSkill: (characterName: string, skillId: string) => void,
    nav: MenuNavCallbacks,
  ) {
    this.root = document.createElement("div");
    this.root.id = "levelup-ui";
    this.root.hidden = true;

    const header = document.createElement("div");
    header.id = "levelup-header";
    const title = document.createElement("span");
    title.textContent = "Level Up";
    header.append(title, buildMenuNav("levelup", "levelUp", nav));

    this.bodyEl = document.createElement("div");
    this.bodyEl.id = "levelup-body";

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

  /** Rebuilds the whole screen from scratch — call after `show()` and after every spend, same "cheap to just redraw" convention `InventoryUI`/`OptionsUI` already use. */
  render(party: Party): void {
    this.bodyEl.replaceChildren(...party.members.map((character) => this.buildCharacterCard(character)));
  }

  private buildCharacterCard(character: Character): HTMLElement {
    const card = document.createElement("div");
    card.className = "levelup-character";

    const header = document.createElement("div");
    header.className = "levelup-character-header";
    header.textContent = `${character.portrait} ${character.name} (Lv${character.level})`;
    const points = document.createElement("span");
    points.className = "levelup-points";
    points.textContent = `${character.skillPoints} point${character.skillPoints === 1 ? "" : "s"}`;
    header.appendChild(points);
    card.appendChild(header);
    card.appendChild(this.buildMetaRow(character));

    const statsHeading = document.createElement("div");
    statsHeading.className = "levelup-heading";
    statsHeading.textContent = "Stats";
    card.appendChild(statsHeading);

    for (const stat of STAT_ORDER) {
      card.appendChild(this.buildStatRow(character, stat));
    }

    const skillsHeading = document.createElement("div");
    skillsHeading.className = "levelup-heading";
    skillsHeading.textContent = "Skills";
    card.appendChild(skillsHeading);

    for (const skill of SKILLS[character.classId]) {
      card.appendChild(this.buildSkillRow(character, skill.id));
    }

    return card;
  }

  /**
   * Class and current HP/Mana (player request: "The level up screen
   * should show each character's class and HP / Mana Points") — a
   * point spent on Vitality or Focus changes these numbers right on
   * this same screen (`Character.spendPointOnStat`'s max-HP/Mana
   * nudge), so seeing them here, not just elsewhere in the HUD, is
   * what actually lets a player judge the effect of that choice in
   * context. Mana is omitted for a class with none (Warrior, Rogue) —
   * `maxMana` for those is always 0 and always will be, so "0/0 Mana"
   * would just be noise, not information.
   */
  private buildMetaRow(character: Character): HTMLElement {
    const row = document.createElement("div");
    row.className = "levelup-meta";
    const parts = [classLabel(character.classId), `${character.hp}/${character.maxHp} HP`];
    if (character.maxMana > 0) parts.push(`${character.mana}/${character.maxMana} Mana`);
    row.textContent = parts.join(" — ");
    return row;
  }

  private buildStatRow(character: Character, stat: keyof CharacterStats): HTMLElement {
    const row = document.createElement("div");
    row.className = "levelup-row";
    // On the row, not just the label, so hovering the +1 button (the
    // part a player's cursor is actually headed for) shows it too.
    row.title = STAT_DESCRIPTIONS[stat];

    const label = document.createElement("span");
    label.textContent = `${STAT_LABELS[stat]}: ${character.stats[stat]}`;
    row.appendChild(label);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "levelup-btn";
    button.textContent = "+1";
    button.disabled = character.skillPoints <= 0;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (button.disabled) return;
      this.onSpendStat(character.name, stat);
    });
    row.appendChild(button);

    return row;
  }

  private buildSkillRow(character: Character, skillId: string): HTMLElement {
    const skill = SKILLS[character.classId].find((candidate) => candidate.id === skillId)!;
    const row = document.createElement("div");
    row.className = "levelup-row";
    // On the row too, not just the label -- same reasoning as
    // buildStatRow's own row.title: hovering the Unlock button itself
    // should show it, not just the label text next to it.
    row.title = skill.description;

    const label = document.createElement("span");
    label.title = skill.description;
    row.appendChild(label);

    if (character.knowsSkill(skill.id)) {
      label.textContent = `${skill.name} — known`;
      return row;
    }

    // A skill locked out by the other side of its own fork already
    // being chosen (docs/08-roadmap-phases.md Phase 7's "real build
    // fork, not a checklist") shows why, but offers no button — there's
    // no respec, `GameLogic.unlockSkill` would just refuse it anyway.
    if (skill.exclusiveWith && character.knowsSkill(skill.exclusiveWith)) {
      const chosen = SKILLS[character.classId].find((candidate) => candidate.id === skill.exclusiveWith)!;
      label.textContent = `${skill.name} — unavailable (chose ${chosen.name})`;
      return row;
    }

    label.textContent = `${skill.name} (${skill.unlockCost} points)`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "levelup-btn";
    button.textContent = "Unlock";
    button.disabled = character.skillPoints < skill.unlockCost;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (button.disabled) return;
      this.onUnlockSkill(character.name, skill.id);
    });
    row.appendChild(button);

    return row;
  }
}
