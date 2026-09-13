import type { ClassId } from "./Character";
import { CLASS_ABILITIES } from "./classes";
import { DEFAULT_PARTY_SPEC, PORTRAIT_OPTIONS, type PartyMemberSpec } from "./roster";

const CLASS_OPTIONS: ClassId[] = ["warrior", "rogue", "mage", "cleric"];

/**
 * The Phase 3 "minimal creation/naming screen" from
 * docs/03-party-and-characters.md#party-creation-vs-pre-generated: pick
 * a class and a portrait per slot, assign a name. Shown once, before
 * `Game` exists at all (see `main.ts`) — full point-buy attribute
 * creation is an explicit stretch goal, not built here. Every slot
 * starts prefilled with `DEFAULT_PARTY_SPEC`, so accepting every
 * default without touching anything reproduces the exact party earlier
 * phases hardcoded.
 */
export class PartyCreationUI {
  private readonly root: HTMLElement;
  private readonly specs: PartyMemberSpec[];

  constructor(private readonly onConfirm: (specs: PartyMemberSpec[]) => void) {
    this.specs = DEFAULT_PARTY_SPEC.map((spec) => ({ ...spec }));

    this.root = document.createElement("div");
    this.root.id = "party-creation";

    const title = document.createElement("div");
    title.id = "party-creation-title";
    title.textContent = "THE HOLLOW CROWN";

    const subtitle = document.createElement("div");
    subtitle.id = "party-creation-subtitle";
    subtitle.textContent = "Assemble your party";

    const slotsEl = document.createElement("div");
    slotsEl.id = "party-creation-slots";
    this.specs.forEach((spec, index) => slotsEl.appendChild(this.buildSlot(spec, index)));

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.id = "party-creation-confirm";
    confirmButton.textContent = "Descend";
    confirmButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.confirm();
    });

    this.root.append(title, subtitle, slotsEl, confirmButton);
    document.body.appendChild(this.root);
  }

  private buildSlot(spec: PartyMemberSpec, index: number): HTMLElement {
    const card = document.createElement("div");
    card.className = "party-creation-slot";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "party-creation-name";
    nameInput.value = spec.name;
    nameInput.maxLength = 16;
    nameInput.addEventListener("input", () => {
      this.specs[index].name = nameInput.value;
    });

    const classRow = document.createElement("div");
    classRow.className = "party-creation-row";
    const classButtons = new Map<ClassId, HTMLButtonElement>();
    for (const classId of CLASS_OPTIONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "party-creation-choice-btn";
      button.textContent = classLabel(classId);
      // The class's signature ability, same description CombatUI already
      // shows as a tooltip mid-fight -- a class's role is public
      // information, unlike an item's mechanical effect (see
      // docs/06-items-and-equipment.md#discovery-not-explanation, which
      // only ever applies to items).
      button.title = CLASS_ABILITIES[classId].description;
      if (classId === spec.classId) button.classList.add("selected");
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.specs[index].classId = classId;
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
        this.specs[index].portrait = portrait;
        for (const [p, btn] of portraitButtons) btn.classList.toggle("selected", p === portrait);
      });
      portraitButtons.set(portrait, button);
      portraitRow.appendChild(button);
    }

    card.append(nameInput, classRow, portraitRow);
    return card;
  }

  private confirm(): void {
    // A blank name falls back to that slot's default rather than
    // blocking the player with a validation error over something this
    // minor.
    const finalSpecs = this.specs.map((spec, index) => ({
      ...spec,
      name: spec.name.trim() || DEFAULT_PARTY_SPEC[index].name,
    }));
    document.body.removeChild(this.root);
    this.onConfirm(finalSpecs);
  }
}

function classLabel(classId: ClassId): string {
  return classId.charAt(0).toUpperCase() + classId.slice(1);
}
