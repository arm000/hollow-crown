import { describe, expect, it } from "vitest";
import { ScreenFlash } from "./ScreenFlash";

describe("ScreenFlash", () => {
  it("starts inactive, zero intensity", () => {
    const flash = new ScreenFlash();
    expect(flash.isActive).toBe(false);
    expect(flash.intensity).toBe(0);
  });

  it("jumps to full intensity the moment it's played, then fades out to zero", () => {
    const flash = new ScreenFlash();
    flash.play(0x6adf7a);
    expect(flash.isActive).toBe(true);
    expect(flash.intensity).toBe(1);

    flash.update(0.1);
    const mid = flash.intensity;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);

    flash.update(10);
    expect(flash.isActive).toBe(false);
    expect(flash.intensity).toBe(0);
  });

  it("carries whatever color play() was given", () => {
    const flash = new ScreenFlash();
    flash.play(0x4a90d8);
    expect(flash.color).toBe(0x4a90d8);
  });

  it("cancel ends a fading flash immediately", () => {
    const flash = new ScreenFlash();
    flash.play(0xffffff);
    expect(flash.isActive).toBe(true);

    flash.cancel();

    expect(flash.isActive).toBe(false);
    expect(flash.intensity).toBe(0);
  });

  it("playing again restarts the fade rather than queuing", () => {
    const flash = new ScreenFlash();
    flash.play(0xff0000);
    flash.update(0.3); // most of the way faded out

    flash.play(0x00ff00);

    expect(flash.intensity).toBe(1); // back to full
    expect(flash.color).toBe(0x00ff00);
  });
});
