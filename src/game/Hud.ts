import type { Character } from "./party/Character";

/**
 * The v1 ending (docs/08-roadmap-phases.md Phase 6's scope decision:
 * only Act 1, The Sunken Wards, ships — see
 * docs/02-setting-and-story.md#structure). Written to close the story
 * on its own terms, not as a mid-campaign cliffhanger: Steward Marrow's
 * defeat is a real, self-contained resolution, while the deeper acts
 * stay a deliberate, unresolved specter rather than a sequel hook —
 * "the horror is absence" (docs/02-setting-and-story.md#tone) applies
 * to what the ending doesn't answer, too.
 */
const WIN_EPILOGUE =
  "Steward Marrow's watch is over. Whatever waited here for guests who were never coming has, at last, stopped waiting.\n\n" +
  "You climb back toward daylight with proof enough of what Ashveil actually lost — and the growing, unshakeable sense that the Sunken Wards were only ever the shallowest room in a much colder house.\n\n" +
  "Somewhere below, the Long Court is still sinking. You do not go looking for it. Not yet.";

/**
 * Thin wrapper around the plain-DOM HUD elements declared in
 * `index.html` (see docs/07-technical-architecture.md "UI layer" — DOM
 * overlays, not in-3D UI). No polish intended yet: a message line, a
 * text inventory list, and a party status line are enough to make
 * Phase 1/2's state legible.
 */
export class Hud {
  private readonly messageEl: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly inventoryEl: HTMLElement;
  private readonly partyEl: HTMLElement;
  private readonly winScreenEl: HTMLElement;
  private readonly winScreenEpilogueEl: HTMLElement;
  private readonly defeatScreenEl: HTMLElement;
  private readonly defeatScreenLogEl: HTMLElement;
  private readonly inventoryToggleEl: HTMLElement;
  private readonly muteToggleEl: HTMLElement;
  private readonly bestiaryToggleEl: HTMLElement;
  private readonly levelUpToggleEl: HTMLElement;
  private readonly optionsToggleEl: HTMLElement;
  private readonly combatFlashEl: HTMLElement;

  constructor(doc: Document = document) {
    this.messageEl = getRequiredElement(doc, "hud-message");
    this.levelEl = getRequiredElement(doc, "hud-level");
    this.inventoryEl = getRequiredElement(doc, "hud-inventory");
    this.partyEl = getRequiredElement(doc, "hud-party");
    this.winScreenEl = getRequiredElement(doc, "win-screen");
    this.winScreenEpilogueEl = getRequiredElement(doc, "win-screen-epilogue");
    this.defeatScreenEl = getRequiredElement(doc, "defeat-screen");
    this.defeatScreenLogEl = getRequiredElement(doc, "defeat-screen-log");
    this.inventoryToggleEl = getRequiredElement(doc, "inventory-toggle");
    this.muteToggleEl = getRequiredElement(doc, "mute-toggle");
    this.bestiaryToggleEl = getRequiredElement(doc, "bestiary-toggle");
    this.levelUpToggleEl = getRequiredElement(doc, "levelup-toggle");
    this.optionsToggleEl = getRequiredElement(doc, "options-toggle");
    this.combatFlashEl = getRequiredElement(doc, "combat-flash");
  }

  showMessage(text: string): void {
    this.messageEl.textContent = text;
  }

  /** The current level's name (docs/08-roadmap-phases.md Phase 5) — environmental flavor, per docs/02-setting-and-story.md, not required reading. */
  updateLevelName(name: string): void {
    this.levelEl.textContent = name;
  }

  updateInventory(itemNames: string[]): void {
    this.inventoryEl.textContent = itemNames.length > 0 ? `Carrying: ${itemNames.join(", ")}` : "";
  }

  updateParty(members: Character[]): void {
    this.partyEl.textContent = members
      .map((member) => {
        const status = `${member.portrait} ${member.name} Lv${member.level} ${member.hp}/${member.maxHp}${member.isDown ? " (down)" : ""}`;
        const gear = member.listEquipment();
        return gear.length > 0 ? `${status} [${gear.map((item) => item.name).join(", ")}]` : status;
      })
      .join("\n");
  }

  showWinScreen(): void {
    this.winScreenEpilogueEl.textContent = WIN_EPILOGUE;
    this.winScreenEl.hidden = false;
  }

  /**
   * Phase 2's defeat stub (docs/08-roadmap-phases.md#phase-2--party--turn-based-combat)
   * — ends the run, no revive system yet. `finalLog`, when given
   * (player report: "When the party dies I can't read the combat log
   * to see what happened"), is the fight's last several lines, shown
   * directly on the screen itself rather than depending on whatever's
   * still visible underneath — `CombatUI.hide()` (called by
   * `Game.checkCombatEnd` right before this) tears down the whole
   * combat overlay, log included, the instant a fight ends, win or
   * lose.
   */
  showDefeatScreen(finalLog: string[] = []): void {
    this.defeatScreenLogEl.textContent = finalLog.join("\n");
    this.defeatScreenEl.hidden = false;
  }

  /** Wires the always-visible "Inventory" button (works by mouse click or touch tap alike, unlike the touch-only move/turn pads) — `Game` decides whether the tap is actually allowed to open anything right now. */
  onInventoryToggle(callback: () => void): void {
    this.inventoryToggleEl.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      callback();
    });
  }

  /** Wires the always-visible mute button (docs/08-roadmap-phases.md Phase 5's procedural audio) — same click-or-tap pattern as the Inventory button. */
  onMuteToggle(callback: () => void): void {
    this.muteToggleEl.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      callback();
    });
  }

  updateMuteButton(muted: boolean): void {
    this.muteToggleEl.textContent = muted ? "🔇" : "🔊";
  }

  /**
   * Wires the always-visible Bestiary/Level Up/Options buttons
   * (`#quick-menu` in index.html — docs/08-roadmap-phases.md Phase 7,
   * on a player report that those screens were only reachable by
   * opening Inventory first) — same click-or-tap pattern as
   * `onInventoryToggle`/`onMuteToggle` above.
   */
  onBestiaryToggle(callback: () => void): void {
    this.bestiaryToggleEl.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      callback();
    });
  }

  onLevelUpToggle(callback: () => void): void {
    this.levelUpToggleEl.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      callback();
    });
  }

  onOptionsToggle(callback: () => void): void {
    this.optionsToggleEl.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      callback();
    });
  }

  /**
   * Drives `#combat-flash` (docs/14-asset-inventory.md, on a player
   * request for spell-effect placeholders): a self/party-targeted
   * skill's placeholder VFX, since there's no character mesh in this
   * first-person view to show an effect on the way a monster-targeted
   * skill's hit flash does. Called every frame from `Game.tick()`
   * regardless of `intensity` — 0 is a harmless, invisible no-op, same
   * as every other per-frame animation sync in this project.
   */
  setScreenFlash(color: number, intensity: number): void {
    this.combatFlashEl.style.backgroundColor = `#${color.toString(16).padStart(6, "0")}`;
    // Never fully opaque even at intensity 1 -- this is a tint the
    // player reads combat through, not a whiteout that hides it.
    this.combatFlashEl.style.opacity = String(intensity * 0.35);
  }
}

function getRequiredElement(doc: Document, id: string): HTMLElement {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`Missing #${id} element`);
  return el;
}
