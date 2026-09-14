const FLASH_DURATION = 0.4;

/**
 * Pure animation math for a self/party-targeted skill's placeholder VFX
 * (docs/14-asset-inventory.md, on a player request for spell-effect
 * placeholders) — the party isn't rendered in this first-person view,
 * so a skill like Second Wind or Ward has no character mesh to show an
 * effect on the way a monster-targeted skill's hit flash does; a brief
 * colored screen-wide tint is the placeholder instead. No DOM access of
 * its own; `Game.ts` reads `color`/`intensity` every frame and applies
 * them to `#combat-flash` (see `Hud.ts`'s `setScreenFlash`) — the same
 * "pure state, dumb renderer applies it" split every other placeholder
 * animation class in this project uses.
 */
export class ScreenFlash {
  private t = 1;
  private _color = 0xffffff;

  get isActive(): boolean {
    return this.t < 1;
  }

  /** Meaningless (but harmless) to read once `isActive` is false — `intensity` is already 0 there. */
  get color(): number {
    return this._color;
  }

  /** 0-1, fading linearly from a full flash down to nothing — 0 once inactive. */
  get intensity(): number {
    return this.t >= 1 ? 0 : 1 - this.t;
  }

  /** Starts a new flash, replacing whatever (if anything) was already fading out. */
  play(color: number): void {
    this._color = color;
    this.t = 0;
  }

  update(deltaSeconds: number): void {
    if (this.t >= 1) return;
    this.t = Math.min(1, this.t + deltaSeconds / FLASH_DURATION);
  }

  /** Ends whatever's fading out immediately — a fresh encounter starting shouldn't carry over a stale flash from the last one, same reasoning as `MonsterAnimator.reset()`. */
  cancel(): void {
    this.t = 1;
  }
}
