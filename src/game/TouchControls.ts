import type { Action, InputManager } from "./InputManager";

interface ButtonSpec {
  action: Action;
  label: string;
  className: string;
}

const MOVE_BUTTONS: ButtonSpec[] = [
  { action: "forward", label: "▲", className: "tp-up" },
  { action: "strafeLeft", label: "◀", className: "tp-left" },
  { action: "interact", label: "USE", className: "tp-interact" },
  { action: "strafeRight", label: "▶", className: "tp-right" },
  { action: "backward", label: "▼", className: "tp-down" },
];

const TURN_BUTTONS: ButtonSpec[] = [
  { action: "turnLeft", label: "↺", className: "tp-turn-left" },
  { action: "turnRight", label: "↻", className: "tp-turn-right" },
];

/**
 * On-screen buttons mirroring the keyboard action set, so the game is
 * fully playable by touch alone (see docs/04-exploration-and-world.md
 * "Input & touch controls"). Always mounted; whether a touch device
 * shows them *at all* is left entirely to CSS (`@media (hover: none)
 * and (pointer: coarse)` in index.html) rather than JS device sniffing.
 *
 * `show`/`hide` add a second, narrower condition on top of that: move
 * and turn don't mean anything mid-fight (combat is entirely
 * tap-a-combat-button), so `Game.ts` hides these for the duration of
 * one (player report: on mobile, "the controls draw over the combat
 * log making it hard to read" — `#combat-ui`'s own bottom-pinned
 * layout put the log/action row in the exact same screen region these
 * pads already occupied). The CSS media query above still gates
 * whether a touch device shows them *outside* combat; `hidden` only
 * ever narrows that further, never widens it back on for a
 * mouse-driven desktop.
 */
export class TouchControls {
  private readonly root: HTMLElement;

  constructor(private readonly input: InputManager) {
    this.root = document.createElement("div");
    this.root.id = "touch-controls";
    this.root.append(
      this.buildPad("move-pad", MOVE_BUTTONS),
      this.buildPad("turn-pad", TURN_BUTTONS),
    );
    document.body.appendChild(this.root);
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private buildPad(id: string, buttons: ButtonSpec[]): HTMLDivElement {
    const pad = document.createElement("div");
    pad.className = "touch-pad";
    pad.id = id;

    for (const { action, label, className } of buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tp-btn ${className}`;
      button.textContent = label;
      button.setAttribute("aria-label", action);

      // pointerdown (not click) fires immediately on touch, and unifies
      // touch/mouse/pen so this also works if someone clicks these with
      // a mouse. preventDefault stops the tap from also firing a
      // synthetic mouse event or triggering scroll/zoom gestures.
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.input.push(action);
      });
      button.addEventListener("contextmenu", (event) => event.preventDefault());

      pad.appendChild(button);
    }

    return pad;
  }
}
