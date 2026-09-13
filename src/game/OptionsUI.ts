import type { Action } from "./InputManager";

/** A curated handful of reasonable alternatives per action, not every possible key — a dropdown, not a live "press any key" capture, so this needed no global keydown interception or event-ordering games with the rest of the input pipeline (docs/08-roadmap-phases.md Phase 6's options menu). */
const KEY_CHOICES: Record<Action, string[]> = {
  forward: ["KeyW", "ArrowUp", "KeyI"],
  backward: ["KeyS", "ArrowDown", "KeyK"],
  strafeLeft: ["KeyA", "KeyJ"],
  strafeRight: ["KeyD", "KeyL"],
  turnLeft: ["KeyQ", "ArrowLeft"],
  turnRight: ["KeyE", "ArrowRight"],
  interact: ["Space", "KeyF", "Enter"],
};

const ACTION_LABELS: Record<Action, string> = {
  forward: "Walk forward",
  backward: "Walk backward",
  strafeLeft: "Strafe left",
  strafeRight: "Strafe right",
  turnLeft: "Turn left",
  turnRight: "Turn right",
  interact: "Interact",
};

const KEY_LABELS: Record<string, string> = {
  KeyW: "W",
  KeyA: "A",
  KeyS: "S",
  KeyD: "D",
  KeyQ: "Q",
  KeyE: "E",
  KeyI: "I",
  KeyJ: "J",
  KeyK: "K",
  KeyL: "L",
  KeyF: "F",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Space: "Space",
  Enter: "Enter",
};

/**
 * The options screen (docs/08-roadmap-phases.md Phase 6): volume, mute,
 * and key rebinding, in the same DOM-overlay family as `InventoryUI`/
 * `BestiaryUI`. Opened from the inventory screen's header, same as
 * those two, rather than its own always-visible corner button — one
 * more thing that doesn't need to be reachable mid-fight or mid-run.
 * Owns no persistence itself; every change calls back to `Game`, which
 * applies it to the live `AudioManager`/`InputManager` and writes it to
 * `Settings.ts`.
 */
export class OptionsUI {
  private readonly root: HTMLElement;
  private readonly volumeSlider: HTMLInputElement;
  private readonly muteCheckbox: HTMLInputElement;

  constructor(
    private readonly onVolumeChange: (percent: number) => void,
    private readonly onMuteToggle: (muted: boolean) => void,
    private readonly onRebind: (action: Action, key: string) => void,
    private readonly onClose: () => void,
  ) {
    this.root = document.createElement("div");
    this.root.id = "options-ui";
    this.root.hidden = true;

    const header = document.createElement("div");
    header.id = "options-header";
    const title = document.createElement("span");
    title.textContent = "Options";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.id = "options-close";
    closeButton.textContent = "Close";
    closeButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.onClose();
    });
    header.append(title, closeButton);

    const body = document.createElement("div");
    body.id = "options-body";

    const volumeRow = document.createElement("div");
    volumeRow.className = "options-row";
    const volumeLabel = document.createElement("label");
    volumeLabel.textContent = "Volume";
    volumeLabel.htmlFor = "options-volume";
    this.volumeSlider = document.createElement("input");
    this.volumeSlider.type = "range";
    this.volumeSlider.id = "options-volume";
    this.volumeSlider.min = "0";
    this.volumeSlider.max = "100";
    this.volumeSlider.addEventListener("input", () => {
      this.onVolumeChange(Number(this.volumeSlider.value));
    });
    volumeRow.append(volumeLabel, this.volumeSlider);

    const muteRow = document.createElement("div");
    muteRow.className = "options-row";
    const muteLabel = document.createElement("label");
    muteLabel.textContent = "Mute";
    muteLabel.htmlFor = "options-mute";
    this.muteCheckbox = document.createElement("input");
    this.muteCheckbox.type = "checkbox";
    this.muteCheckbox.id = "options-mute";
    this.muteCheckbox.addEventListener("change", () => {
      this.onMuteToggle(this.muteCheckbox.checked);
    });
    muteRow.append(muteLabel, this.muteCheckbox);

    const keysHeading = document.createElement("div");
    keysHeading.className = "options-heading";
    keysHeading.textContent = "Controls";

    body.append(volumeRow, muteRow, keysHeading);
    for (const action of Object.keys(KEY_CHOICES) as Action[]) {
      body.appendChild(this.buildKeyRow(action));
    }

    this.root.append(header, body);
    document.body.appendChild(this.root);
  }

  private buildKeyRow(action: Action): HTMLElement {
    const row = document.createElement("div");
    row.className = "options-row";

    const label = document.createElement("label");
    label.textContent = ACTION_LABELS[action];
    label.htmlFor = `options-key-${action}`;

    const select = document.createElement("select");
    select.id = `options-key-${action}`;
    select.dataset.action = action;
    for (const key of KEY_CHOICES[action]) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = KEY_LABELS[key] ?? key;
      select.appendChild(option);
    }
    select.addEventListener("change", () => {
      this.onRebind(action, select.value);
    });

    row.append(label, select);
    return row;
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Reflects the current live settings into the controls — call once right after `show()`, and whenever a rebind happens elsewhere (there's only one options screen, but this keeps the display honest if that ever changes). */
  render(volumePercent: number, muted: boolean, keyFor: (action: Action) => string | undefined): void {
    this.volumeSlider.value = String(volumePercent);
    this.muteCheckbox.checked = muted;
    for (const action of Object.keys(KEY_CHOICES) as Action[]) {
      const select = this.root.querySelector<HTMLSelectElement>(`#options-key-${action}`);
      const current = keyFor(action);
      if (select && current && KEY_CHOICES[action].includes(current)) {
        select.value = current;
      }
    }
  }
}
