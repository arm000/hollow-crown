import { describe, expect, it } from "vitest";
import { loadSettings, saveSettings } from "./Settings";

/** Same minimal in-memory `Storage` stand-in as `SaveGame.test.ts` — this project's Vitest environment is plain Node, no real `localStorage`. */
class FakeStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("loadSettings", () => {
  it("returns sensible defaults when nothing has been saved", () => {
    expect(loadSettings(new FakeStorage())).toEqual({ volume: 100, muted: false, keyBindings: {} });
  });

  it("returns undefined-safe defaults for corrupted JSON, never throws", () => {
    const storage = new FakeStorage();
    storage.setItem("hollow-crown-settings", "{not valid json");
    expect(() => loadSettings(storage)).not.toThrow();
    expect(loadSettings(storage)).toEqual({ volume: 100, muted: false, keyBindings: {} });
  });
});

describe("saveSettings / loadSettings round-trip", () => {
  it("round-trips volume, mute, and key bindings exactly", () => {
    const storage = new FakeStorage();
    const settings = { volume: 42, muted: true, keyBindings: { interact: "KeyF", forward: "KeyI" } };

    saveSettings(settings, storage);

    expect(loadSettings(storage)).toEqual(settings);
  });

  it("a settings blob missing newer fields still loads with defaults filled in", () => {
    const storage = new FakeStorage();
    storage.setItem("hollow-crown-settings", JSON.stringify({ volume: 60 }));

    expect(loadSettings(storage)).toEqual({ volume: 60, muted: false, keyBindings: {} });
  });
});
