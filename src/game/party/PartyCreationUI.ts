import { ALL_CLASS_IDS, type CharacterStats, type ClassId } from "./Character";
import { SKILLS } from "./Skills";
import { CLASS_BASE_STATS, CREATION_ATTRIBUTE_POINTS, PORTRAIT_OPTIONS, type PartyMemberSpec } from "./roster";

/** The single starting character's defaults — accepting every default without touching anything still needs a valid spec to prefill. */
const DEFAULT_STARTER_SPEC: PartyMemberSpec = { name: "Wren", classId: "warrior", portrait: PORTRAIT_OPTIONS[0] };

const STAT_ORDER: Array<keyof CharacterStats> = ["might", "grace", "vitality", "focus", "resolve"];
const STAT_LABELS: Record<keyof CharacterStats, string> = {
  might: "Might",
  grace: "Grace",
  vitality: "Vitality",
  focus: "Focus",
  resolve: "Resolve",
};

/**
 * The Phase 3 "minimal creation/naming screen" from
 * docs/03-party-and-characters.md#party-creation-vs-pre-generated: pick
 * a class, a portrait, and a name for the *one* character the run
 * starts with. Shown once, before `Game` exists at all (see
 * `main.ts`).
 *
 * Phase 7's recruitment feature is what shrank this from four slots to
 * one: the party now starts solo and grows via `RescueEncounter`s found
 * on levels 1-3, rather than being fully assembled up front. `onConfirm`
 * still hands back a `PartyMemberSpec[]` (of length 1) rather than a
 * single spec, so `Game`'s constructor and `roster.createParty` — both
 * already generic over party size — need no change to accept it.
 *
 * Batch 9 (player request: "a character creation screen... where the
 * user can assign attribute points and pick a starting skill") added
 * the two `renderCustomize` sections below — the "full point-buy
 * attribute creation" this class's own doc comment used to flag as an
 * explicit stretch goal, now built. Both sections depend on the chosen
 * class (different base stats to show, different tier-1 skill pair),
 * so they live in `customizeEl`, rebuilt from scratch by
 * `onClassChanged` every time the class selection changes — same
 * "cheap to just redraw" convention `LevelUpUI`/`InventoryUI` already
 * use, rather than trying to patch individual rows in place.
 */
export class PartyCreationUI {
  private readonly root: HTMLElement;
  private readonly spec: PartyMemberSpec;
  private readonly customizeEl: HTMLElement;
  /** Points allocated so far, keyed by stat — summed against `CREATION_ATTRIBUTE_POINTS` to know how many are left. Reset whenever the class changes, same as `startingSkillId` below. */
  private statBonuses: Partial<Record<keyof CharacterStats, number>> = {};
  private startingSkillId: string;

  /**
   * `onContinue`, when given, means a save exists (see
   * `SaveGame.hasSave` / `main.ts`) — a "Continue" button appears above
   * the usual creation flow, bypassing it entirely to resume that save
   * instead of building a fresh party. Omit it to skip straight to
   * "New Game" only, e.g. when no save exists yet.
   */
  constructor(
    private readonly onConfirm: (specs: PartyMemberSpec[]) => void,
    private readonly onContinue?: () => void,
  ) {
    this.spec = { ...DEFAULT_STARTER_SPEC };
    this.startingSkillId = SKILLS[this.spec.classId][0].id;
    this.customizeEl = document.createElement("div");
    this.customizeEl.className = "party-creation-customize";

    this.root = document.createElement("div");
    this.root.id = "party-creation";

    const title = document.createElement("div");
    title.id = "party-creation-title";
    title.textContent = "THE HOLLOW CROWN";

    const subtitle = document.createElement("div");
    subtitle.id = "party-creation-subtitle";
    subtitle.textContent = "Who descends?";

    const slotsEl = document.createElement("div");
    slotsEl.id = "party-creation-slots";
    slotsEl.appendChild(this.buildSlot(this.spec));

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.id = "party-creation-confirm";
    confirmButton.textContent = "Descend";
    confirmButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.confirm();
    });

    if (this.onContinue) {
      const continueButton = document.createElement("button");
      continueButton.type = "button";
      continueButton.id = "party-creation-continue";
      continueButton.textContent = "Continue";
      continueButton.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        document.body.removeChild(this.root);
        this.onContinue!();
      });

      const newGameLabel = document.createElement("div");
      newGameLabel.id = "party-creation-new-game-label";
      newGameLabel.textContent = "— or start over —";

      this.root.append(title, continueButton, newGameLabel, subtitle, slotsEl, this.buildHint(), confirmButton);
    } else {
      this.root.append(title, subtitle, slotsEl, this.buildHint(), confirmButton);
    }
    document.body.appendChild(this.root);
  }

  /** A one-line reminder that this isn't the whole party — the other three classic roster members wait to be found on the way down (docs/03-party-and-characters.md#party-creation-vs-pre-generated), so a player expecting the old four-slot screen isn't left wondering where everyone went. */
  private buildHint(): HTMLElement {
    const hint = document.createElement("div");
    hint.id = "party-creation-hint";
    hint.textContent = "You descend alone. Others wait to be found — and freed — below.";
    return hint;
  }

  private buildSlot(spec: PartyMemberSpec): HTMLElement {
    const card = document.createElement("div");
    card.className = "party-creation-slot";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "party-creation-name";
    nameInput.value = spec.name;
    nameInput.maxLength = 16;
    nameInput.addEventListener("input", () => {
      this.spec.name = nameInput.value;
    });

    const classRow = document.createElement("div");
    classRow.className = "party-creation-row";
    const classButtons = new Map<ClassId, HTMLButtonElement>();
    for (const classId of ALL_CLASS_IDS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "party-creation-choice-btn";
      button.textContent = classLabel(classId);
      // The class's default signature skill, same description CombatUI
      // already shows as a tooltip mid-fight -- a class's role is
      // public information, unlike an item's mechanical effect (see
      // docs/06-items-and-equipment.md#discovery-not-explanation, which
      // only ever applies to items). A second skill exists to unlock
      // via leveling (Skills.ts) but isn't spoiled here -- this is
      // about knowing a class's role up front, not its whole kit.
      button.title = SKILLS[classId][0].description;
      if (classId === spec.classId) button.classList.add("selected");
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (classId === this.spec.classId) return;
        this.spec.classId = classId;
        for (const [id, btn] of classButtons) btn.classList.toggle("selected", id === classId);
        this.onClassChanged();
      });
      classButtons.set(classId, button);
      classRow.appendChild(button);
    }

    const portraitRow = document.createElement("div");
    portraitRow.className = "party-creation-row";
    const portraitButtons = new Map<string, HTMLButtonElement>();
    for (const portrait of PORTRAIT_OPTIONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "party-creation-choice-btn party-creation-portrait-btn";
      button.textContent = portrait;
      if (portrait === spec.portrait) button.classList.add("selected");
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.spec.portrait = portrait;
        for (const [p, btn] of portraitButtons) btn.classList.toggle("selected", p === portrait);
      });
      portraitButtons.set(portrait, button);
      portraitRow.appendChild(button);
    }

    this.renderCustomize();
    card.append(nameInput, classRow, portraitRow, this.customizeEl);
    return card;
  }

  /** Attribute points and starting skill both depend on the chosen class -- reset and re-render whenever it changes, rather than trying to carry allocations across a class swap that may not even share the same tier-1 skill ids. */
  private onClassChanged(): void {
    this.statBonuses = {};
    this.startingSkillId = SKILLS[this.spec.classId][0].id;
    this.renderCustomize();
  }

  private renderCustomize(): void {
    this.customizeEl.replaceChildren(this.buildStatsSection(), this.buildSkillSection());
  }

  private pointsSpent(): number {
    return Object.values(this.statBonuses).reduce((sum: number, n) => sum + (n ?? 0), 0);
  }

  /** The attribute-point allocator (player request: "assign attribute points") -- same +1-per-point mechanic as `LevelUpUI.buildStatRow`, just spending a fixed creation-time pool instead of `Character.skillPoints` earned from leveling (that pool is `roster.CREATION_ATTRIBUTE_POINTS`, granted for real once `createCharacterFromSpec` builds the actual `Character` — see that function's doc comment for why any points left unspent here aren't lost). */
  private buildStatsSection(): HTMLElement {
    const section = document.createElement("div");
    section.className = "party-creation-section";

    const remaining = CREATION_ATTRIBUTE_POINTS - this.pointsSpent();
    const heading = document.createElement("div");
    heading.className = "party-creation-heading";
    heading.textContent = `Attributes — ${remaining} point${remaining === 1 ? "" : "s"} left`;
    section.appendChild(heading);

    const base = CLASS_BASE_STATS[this.spec.classId].stats;
    for (const stat of STAT_ORDER) {
      const bonus = this.statBonuses[stat] ?? 0;
      const row = document.createElement("div");
      row.className = "party-creation-stat-row";

      const label = document.createElement("span");
      label.textContent = `${STAT_LABELS[stat]}: ${base[stat] + bonus}`;
      row.appendChild(label);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "party-creation-choice-btn";
      button.textContent = "+1";
      button.disabled = remaining <= 0;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (button.disabled) return;
        this.statBonuses[stat] = bonus + 1;
        this.renderCustomize();
      });
      row.appendChild(button);

      section.appendChild(row);
    }

    return section;
  }

  /** The starting-skill picker (player request: "pick a starting skill") -- a real, permanent choice between the class's two tier-1 options (`Skills.ts`'s indices 0-1: an offense-leaning skill and a defense/utility-leaning one), same mutually-exclusive-fork mechanism the tier-2 skills use later via leveling, just made here instead. */
  private buildSkillSection(): HTMLElement {
    const section = document.createElement("div");
    section.className = "party-creation-section";

    const heading = document.createElement("div");
    heading.className = "party-creation-heading";
    heading.textContent = "Starting skill";
    section.appendChild(heading);

    const tier1Options = SKILLS[this.spec.classId].slice(0, 2);
    const row = document.createElement("div");
    row.className = "party-creation-row";
    for (const skill of tier1Options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "party-creation-choice-btn";
      button.textContent = skill.name;
      if (skill.id === this.startingSkillId) button.classList.add("selected");
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.startingSkillId = skill.id;
        this.renderCustomize();
      });
      row.appendChild(button);
    }
    section.appendChild(row);

    const description = document.createElement("div");
    description.className = "party-creation-skill-description";
    description.textContent = tier1Options.find((skill) => skill.id === this.startingSkillId)!.description;
    section.appendChild(description);

    return section;
  }

  private confirm(): void {
    // A blank name falls back to the default rather than blocking the
    // player with a validation error over something this minor.
    const finalSpec: PartyMemberSpec = {
      ...this.spec,
      name: this.spec.name.trim() || DEFAULT_STARTER_SPEC.name,
      statBonuses: { ...this.statBonuses },
      startingSkillId: this.startingSkillId,
    };
    document.body.removeChild(this.root);
    this.onConfirm([finalSpec]);
  }
}

function classLabel(classId: ClassId): string {
  return classId.charAt(0).toUpperCase() + classId.slice(1);
}
