import * as THREE from "three";
import type { DungeonMap } from "./DungeonMap";
import type { DungeonMeshMaterials } from "./DungeonMesh";
import { SeededRng } from "./Rng";

/**
 * Procedurally-drawn pixel-art wall/floor/ceiling textures
 * (docs/08-roadmap-phases.md Phase 5's "environmental art pass",
 * docs/10-visual-style-guide.md) — this project has no art-authoring
 * pipeline or image-generation tool, so textures are canvas-drawn code
 * rather than hand-painted assets. Kept in its own module, separate
 * from `DungeonMesh.ts`'s pure, headlessly-testable geometry logic,
 * since `document`/`HTMLCanvasElement` don't exist in the Vitest `node`
 * environment those tests run in — only `Game.ts` (never unit tested,
 * per docs/11-testing-strategy.md) ever calls this.
 */

const TEXTURE_SIZE = 32; // px, per docs/10-visual-style-guide.md#asset-specs
const PIXELS_PER_SIDE = 8; // the "chunky pixel" grid resolution drawn within each texture
const PIXEL_SCALE = TEXTURE_SIZE / PIXELS_PER_SIDE;

function hexParts(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function shade(hex: number, amount: number): string {
  const [r, g, b] = hexParts(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(r + amount)}, ${clamp(g + amount)}, ${clamp(b + amount)})`;
}

interface StoneTextureOptions {
  baseColor: number;
  /** Deterministic — the same seed always draws the same texture (stable across reloads), matching how `SeededRng` is used everywhere else in this project for reproducibility, not literal per-frame randomness. */
  seed: number;
  /** Draws a darker line every Nth chunky pixel in both axes, for a stone-block look. 0 disables it (the ceiling's plainer texture). */
  mortarEvery?: number;
  /** Max brightness swing per chunky pixel. */
  jitter?: number;
  /** An occasional fleck of a second color — moss, for Act 1's "damp stone" palette (docs/10-visual-style-guide.md#palette). */
  accentColor?: number;
  accentChance?: number;
}

/**
 * Draws one small pixel-art-style tile: a base color with per-"chunky
 * pixel" brightness jitter plus mortar lines, leaning directly into
 * docs/10-visual-style-guide.md's "bold silhouettes and flat color
 * blocks over fine texture noise" pillar rather than fighting it with a
 * smooth procedural gradient a real texture tool might produce.
 */
function drawStoneTexture(options: StoneTextureOptions): HTMLCanvasElement {
  const { baseColor, seed, mortarEvery = 4, jitter = 16, accentColor, accentChance = 0 } = options;
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas; // no 2D context available -- caller still gets a (blank) canvas rather than throwing

  const rng = new SeededRng(seed);
  for (let py = 0; py < PIXELS_PER_SIDE; py++) {
    for (let px = 0; px < PIXELS_PER_SIDE; px++) {
      const isMortar = mortarEvery > 0 && (px % mortarEvery === 0 || py % mortarEvery === 0);
      const jitterAmount = (rng.next() - 0.5) * 2 * jitter;
      const useAccent = accentColor !== undefined && rng.next() < accentChance;
      ctx.fillStyle = shade(useAccent ? accentColor : baseColor, isMortar ? jitterAmount - 30 : jitterAmount);
      ctx.fillRect(px * PIXEL_SCALE, py * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
    }
  }
  return canvas;
}

/** Wraps a canvas as a texture configured exactly per docs/10-visual-style-guide.md#texture-filtering — nearest filtering, no mipmaps, everywhere, no exceptions. */
function toPixelTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * Act 1's ("The Sunken Wards") wall/floor/ceiling materials — "damp
 * stone grays and mosses," per docs/10-visual-style-guide.md#palette —
 * as `MeshLambertMaterial` (diffuse-only, no PBR specular response,
 * per that doc's "Materials" section, both the correct look for flat
 * pixel art and cheaper to shade on a mobile GPU). All 4 current levels
 * are Act 1 (docs/08-roadmap-phases.md Phase 5), so there's only the
 * one palette to build so far — later Acts get their own factory here
 * when they exist, not a parameter threaded through this one.
 *
 * Floor/ceiling repeat once per grid cell via `texture.repeat`, sized
 * to `dungeon`'s own dimensions — matches `DungeonMesh.ts`'s existing
 * single floor/ceiling plane per level exactly, no geometry change
 * needed on that side.
 */
export function buildActOneMaterials(dungeon: DungeonMap): DungeonMeshMaterials {
  const wallTexture = toPixelTexture(
    drawStoneTexture({ baseColor: 0x726a58, seed: 1, accentColor: 0x4f5c40, accentChance: 0.08 }),
  );
  const floorTexture = toPixelTexture(
    drawStoneTexture({ baseColor: 0x4a4335, seed: 2, accentColor: 0x435237, accentChance: 0.06 }),
  );
  const ceilingTexture = toPixelTexture(drawStoneTexture({ baseColor: 0x201c16, seed: 3, mortarEvery: 8, jitter: 10 }));

  for (const texture of [floorTexture, ceilingTexture]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(dungeon.width, dungeon.height);
  }

  return {
    wall: new THREE.MeshLambertMaterial({ map: wallTexture }),
    floor: new THREE.MeshLambertMaterial({ map: floorTexture }),
    ceiling: new THREE.MeshLambertMaterial({ map: ceilingTexture }),
  };
}
