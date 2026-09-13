import type { Action } from "./InputManager";

/**
 * Local device preferences — volume, mute, and key rebinds
 * (docs/08-roadmap-phases.md Phase 6's options menu). Deliberately
 * separate from `SaveGame.ts`'s save slot: these describe how *this
 * device/browser* likes to play, not where a given run has gotten to,
 * so they live under their own `localStorage` key and persist across
 * "New Game" the same way a real game's settings would, independent of
 * any save.
 */

const SETTINGS_KEY = "hollow-crown-settings";

export interface Settings {
  /** 0-100. */
  volume: number;
  muted: boolean;
  /** Only the actions a player has actually rebound — anything absent keeps `InputManager`'s default key(s), per that class's own doc comments. */
  keyBindings: Partial<Record<Action, string>>;
}

function defaultSettings(): Settings {
  return { volume: 100, muted: false, keyBindings: {} };
}

/** Never throws: a missing or corrupted settings blob just falls back to defaults, the same defensive stance `SaveGame.loadFromStorage` takes. */
export function loadSettings(storage: Storage = window.localStorage): Settings {
  const raw = storage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings();
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...defaultSettings(), ...parsed, keyBindings: { ...parsed.keyBindings } };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings, storage: Storage = window.localStorage): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
