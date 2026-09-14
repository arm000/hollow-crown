import type { Character, CharacterStats } from "./party/Character";
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
 * `BestiaryUI`/`OptionsUI`, opened from the inventory screen's header
 * alongside them, and purely a view over `Party` state: it owns no
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
    private readonly onClose: () => void,
  ) {
    this.root = document.createElement("div");
    this.root.id = "levelup-ui";
    this.root.hidden = true;

    const header = document.createElement("div");
    header.id = "levelup-header";
    const title = document.createElement("span");
    title.textContent = "Level Up";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.id = "levelup-close";
    closeButton.textContent = "Close";
    closeButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.onClose();
    });
    header.append(title, closeButton);

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

  private buildStatRow(character: Character, stat: keyof CharacterStats): HTMLElement {
    const row = document.createElement("div");
    row.className = "levelup-row";

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

    const label = document.createElement("span");
    label.title = skill.description;
    row.appendChild(label);

    if (character.knowsSkill(skill.id)) {
      label.textContent = `${skill.name} — known`;
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
