import type { Facing } from "./Player";
import type { MinimapCell } from "./Minimap";

const CELL_SIZE = 7; // px per grid cell -- small on purpose, this is a corner overlay, not a map screen

const CELL_COLORS: Record<Exclude<MinimapCell, "unknown">, string> = {
  wall: "#8a7d5c",
  floor: "#3a3428",
  door: "#b5813f", // a warm wood tone, distinct from both wall and floor -- doors stay legible once seen, open or closed
};

/**
 * The minimap (docs/08-roadmap-phases.md Phase 5,
 * docs/07-technical-architecture.md#ui-layer): a plain DOM overlay like
 * every other UI in this game, not an in-3D render — a `<canvas>` is
 * just the cheapest way to draw a small grid of colored squares. Always
 * mounted and visible during exploration (covered by whatever full-
 * screen overlay is active otherwise, same as `#hud-party`) rather than
 * needing its own toggle — small enough in a corner that hiding it was
 * never actually necessary.
 */
export class MinimapUI {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "minimap";
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("2D canvas context unavailable");
    this.ctx = context;
    document.body.appendChild(this.canvas);
  }

  render(grid: MinimapCell[][], player: { x: number; z: number; facing: Facing }): void {
    const height = grid.length;
    const width = grid[0]?.length ?? 0;
    this.canvas.width = width * CELL_SIZE;
    this.canvas.height = height * CELL_SIZE;

    this.ctx.fillStyle = "#05040280"; // translucent -- the wards behind it are still faintly readable
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const cell = grid[z][x];
        if (cell === "unknown") continue;
        this.ctx.fillStyle = CELL_COLORS[cell];
        this.ctx.fillRect(x * CELL_SIZE, z * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    this.drawPlayer(player);
  }

  private drawPlayer(player: { x: number; z: number; facing: Facing }): void {
    const cx = player.x * CELL_SIZE + CELL_SIZE / 2;
    const cy = player.z * CELL_SIZE + CELL_SIZE / 2;
    const r = CELL_SIZE * 0.55;

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate((Math.PI / 2) * player.facing); // 0=north, matches Player.Facing's clockwise N/E/S/W
    this.ctx.fillStyle = "#e8d9a8";
    this.ctx.beginPath();
    // A small triangle pointing in the facing direction, "north" (up) at facing 0.
    this.ctx.moveTo(0, -r);
    this.ctx.lineTo(r * 0.7, r * 0.6);
    this.ctx.lineTo(-r * 0.7, r * 0.6);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }
}
