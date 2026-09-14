/**
 * The four full-screen menu overlays (Inventory/Bestiary/Level Up/
 * Options) used to each build their own ad hoc header — Inventory had
 * Save/Bestiary/Level Up/Options/Close, but the other three only ever
 * had a lone Close button, so reaching Options or Level Up from
 * Bestiary meant closing all the way back to exploration and
 * re-opening Inventory first. Player report: "it's weird that all
 * these screens like options and levelup require going through the
 * inventory screen first." This is the shared fix: every one of the
 * four screens now shows the exact same row of "jump straight to
 * sibling screen" buttons (this screen's own destination left out —
 * no point offering a button back to yourself), so any menu is one tap
 * from any other, and the fact that Inventory happens to be the one
 * reachable from exploration's always-visible HUD button/`I` key
 * stops mattering once you're actually browsing menus.
 */
export type MenuDestination = "inventory" | "bestiary" | "levelUp" | "options";

export interface MenuNavCallbacks {
  onOpenInventory: () => void;
  onOpenBestiary: () => void;
  onOpenLevelUp: () => void;
  onOpenOptions: () => void;
  onSave: () => void;
  /** Always returns straight to exploration, never to another menu screen — same "Close means fully done here" convention every screen in this family has always used. */
  onClose: () => void;
}

const DESTINATIONS: Array<{ id: MenuDestination; label: string }> = [
  { id: "inventory", label: "Inventory" },
  { id: "bestiary", label: "Bestiary" },
  { id: "levelUp", label: "Level Up" },
  { id: "options", label: "Options" },
];

/**
 * Builds the shared header-actions row: Save, then every destination
 * except `current` (the screen this row is being built for), then
 * Close. `idPrefix` keeps each screen's real DOM ids distinct (e.g.
 * `bestiary-options`), matching this project's existing per-screen id
 * convention rather than introducing shared classes for something CSS
 * still needs to address by id.
 */
export function buildMenuNav(idPrefix: string, current: MenuDestination, callbacks: MenuNavCallbacks): HTMLElement {
  const actions = document.createElement("div");
  actions.className = "menu-nav-actions";

  actions.appendChild(buildButton(idPrefix, "save", "Save", callbacks.onSave));

  const openers: Record<MenuDestination, () => void> = {
    inventory: callbacks.onOpenInventory,
    bestiary: callbacks.onOpenBestiary,
    levelUp: callbacks.onOpenLevelUp,
    options: callbacks.onOpenOptions,
  };
  for (const { id, label } of DESTINATIONS) {
    if (id === current) continue;
    actions.appendChild(buildButton(idPrefix, id, label, openers[id]));
  }

  actions.appendChild(buildButton(idPrefix, "close", "Close", callbacks.onClose));
  return actions;
}

function buildButton(idPrefix: string, idSuffix: string, label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.id = `${idPrefix}-${idSuffix}`;
  button.className = "menu-nav-btn";
  button.textContent = label;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    onClick();
  });
  return button;
}
