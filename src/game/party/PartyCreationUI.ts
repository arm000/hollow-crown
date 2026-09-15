import { ALL_CLASS_IDS, type ClassId } from "./Character";
import { SKILLS } from "./Skills";
import { PORTRAIT_OPTIONS, type PartyMemberSpec } from "./roster";

/** The single starting character's defaults — accepting every default without touching anything still needs a valid spec to prefill. */
const DEFAULT_STARTER_SPEC: PartyMemberSpec = { name: "Wren", classId: "warrior", portrait: PORTRAIT_OPTIONS[0] };

/**
 * The Phase 3 "minimal creation/naming screen" from
 * docs/03-party-and-characters.md#party-creation-vs-pre-generated: pick
 * a class, a portrait, and a name for the *one* character the run
 * starts with. Shown once, before `Game` exists at all (see
 * `main.ts`) — full point-buy attribute creation is an explicit
 * stretch goal, not built here.
 *
 * Phase 7's recruitment feature is what shrank this from four slots to
 * one: the party now starts solo and grows via `RescueEncounter`s found
 * on levels 1-3, rather than being fully assembled up front. `onConfirm`
 * still hands back a `PartyMemberSpec[]` (of length 1) rather than a
 * single spec, so `Game`'s constructor and `roster.createParty` — both
 * already generic over party size — need no change to accept it.
 */
export class PartyCreationUI {
  private readonly root: HTMLElement;
  private readonly spec: PartyMemberSpec;

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
        this.spec.classId = classId;
        for (const [id, btn] of classButtons) btn.classList.toggle("selected", id === classId);
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

    card.append(nameInput, classRow, portraitRow);
    return card;
  }

  private confirm(): void {
    // A blank name falls back to the default rather than blocking the
    // player with a validation error over something this minor.
    const finalSpec = { ...this.spec, name: this.spec.name.trim() || DEFAULT_STARTER_SPEC.name };
    document.body.removeChild(this.root);
    this.onConfirm([finalSpec]);
  }
}

function classLabel(classId: ClassId): string {
  return classId.charAt(0).toUpperCase() + classId.slice(1);
}
