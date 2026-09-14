# Visual Style Guide

**Pixel art, whole-frame — not a smooth 3D game with pixel-art textures
bolted on.** The distinction matters: this doc specifies a full retro
rendering pipeline (low internal resolution, flat shading, no
anti-aliasing anywhere) alongside the actual art specs, because "pixel
art style" mostly falls apart in a 3D engine if the rendering pipeline
still smooths and lights everything like a modern game.

## Reference points

- **Delver** — the closest genre match: pixel-art textures and
  billboarded sprite monsters inside a real-time 3D dungeon. This is the
  rendering *technique* to imitate.
- **Eye of the Beholder / Dungeon Master** — the 90s first-person
  blobber look: blocky low-res wall textures, monster portraits/sprites
  facing the camera, painted-not-photographic detail.
- **Doom / Wolfenstein 3D** — the billboard-sprite convention for
  characters in a 3D space: 2D art, always facing the camera, not a 3D
  model.

This is a deliberate divergence from Legend of Grimrock's own look
(painted, higher-resolution textures) even though Grimrock remains the
structural reference for movement and puzzles elsewhere in these docs —
visually, *The Hollow Crown* is closer to Delver/Eye of the Beholder.

## Visual pillars

1. **Every pixel is placed, nothing is smoothed.** No anti-aliasing, no
   texture filtering blur, no soft shadows. If it looks soft on screen,
   something is misconfigured, not "stylized."
2. **Geometry is simple; textures carry the detail.** The 3D geometry
   stays low-poly (walls/floor/ceiling are still flat planes, per
   [07-technical-architecture.md](07-technical-architecture.md)) —
   visual richness comes from the pixel art on those planes and from
   sprite creatures, not from polygon count.
3. **Readable at a glance, especially on a phone.** Per the mobile
   platform requirement in
   [01-vision.md](01-vision.md#platform--scope), art has to read at
   small physical sizes. High-frequency dither/noise patterns that look
   great on a desktop monitor turn to mush on a 6-inch screen — prefer
   bold silhouettes and flat color blocks over fine texture noise.
4. **A restrained, mood-driven palette per Act.** Each of the four Acts
   in [02-setting-and-story.md](02-setting-and-story.md#structure) gets
   its own limited palette (see below) — this is both a narrative tool
   (the descent should *look* like a descent) and a production
   constraint that keeps a small/solo art pipeline sane.

## Rendering pipeline

The core technique: **render the whole game at a low, fixed internal
resolution, then scale that image up to fill the actual screen using
nearest-neighbor (blocky) sampling.** This is what makes lighting, fog,
and everything else in the 3D scene read as pixel art instead of just
the wall textures.

- Render to an offscreen `THREE.WebGLRenderTarget` at a small fixed
  size (target roughly **320×180** for a 16:9-ish view; compute the
  actual size from the live aspect ratio the same way
  `Game.onResize()` already does, just at this much lower resolution).
  Both `magFilter` and `minFilter` on that render target should be
  `THREE.NearestFilter`.
- Blit that render target to the visible canvas scaled up to fill the
  window — either via a fullscreen quad + `NearestFilter`, or by
  rendering directly to a small `<canvas>` and letting CSS
  `image-rendering: pixelated` handle the upscale (simpler, fewer moving
  parts; prefer this unless a post-process pass is needed for another
  reason).
- Prefer an **integer** scale factor (2×, 3×, 4×...) when the screen
  size allows it — crispest result. A non-integer scale still looks
  fine with nearest-neighbor sampling; don't add letterboxing complexity
  just to force an integer fit.
- This is a deliberate rendering choice, not a performance hack, but it
  is also a genuine mobile-performance win in its own right (far fewer
  pixels actually shaded) — worth noting alongside the existing
  guidance in
  [07-technical-architecture.md](07-technical-architecture.md#performance).

### Materials

Swap `MeshStandardMaterial` (current placeholder, PBR-based — see
`DungeonMesh.ts`) for **`MeshLambertMaterial`** on all dungeon geometry:
diffuse-only shading with no specular highlight or roughness response,
which is both the correct look for flat pixel art (PBR
highlights/roughness read as "wrong" on hand-painted pixel textures) and
cheaper to shade on a mobile GPU. Keep dynamic lighting itself (the
carried torch, `FogExp2`) — the point is to drop the PBR *response* to
that light, not the light.

### Texture filtering

Every texture in the game (wall/floor/ceiling tiles, sprites, UI, fonts)
gets:

```ts
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter; // or NearestMipmapNearest if
                                          // distant tile shimmer becomes
                                          // a real problem — evaluate
                                          // once real levels exist
texture.generateMipmaps = false; // default off; revisit only if the
                                  // shimmer trade-off above requires it
```

`LinearFilter` (the Three.js/WebGL default) anywhere in the pipeline is
a bug against this doc, not a style choice.

## Asset specs

| Asset | Canvas size | Notes |
| --- | --- | --- |
| Wall / floor / ceiling tile | 32×32 px | One texture per wall face — maps 1:1 onto the existing `PlaneGeometry(tileSize, WALL_HEIGHT)` wall quads in `DungeonMesh.ts`, no tiling/repeat needed on walls. Floor/ceiling (currently one big plane spanning the level) switch to `RepeatWrapping` with `repeat` set to `(dungeon.width, dungeon.height)` so each grid cell gets one 32×32 tile. |
| Monster/NPC sprite (per frame) | 64×64 px | Billboarded — always rotated to face the camera around the world Y-axis only (a "cylindrical" billboard, not a full sprite-always-faces-every-axis billboard), so creatures don't warp when viewed from above/below. |
| Character/party portrait | 48×48 px | One per party member, referenced from [03-party-and-characters.md](03-party-and-characters.md#party-creation-vs-pre-generated). |
| Inventory/interactable icon | 16×16 px | Displayed scaled up via CSS `image-rendering: pixelated` in the DOM UI layer ([07-technical-architecture.md](07-technical-architecture.md#ui-layer)), never shrunk below native size. |
| Skill/combat VFX | No fixed canvas size | An animated effect (projectile, impact, status overlay), not a static texture — see [14-asset-inventory.md](14-asset-inventory.md) for the full list and what each one is for. |

**The full, current, per-asset inventory** — exactly which of the above
are still procedural placeholders vs. genuinely missing, and which
skill/monster/item each one belongs to — lives in
[14-asset-inventory.md](14-asset-inventory.md) and its underlying
`AssetManifest.ts`, not in this table. This table is the *spec*
(dimensions, technique); that manifest is the *inventory* (what,
how many, status).

### Sprites: start with single-facing, not 8-directional

Doom/Wolfenstein-era games rendered a monster from 8 fixed angles so its
apparent facing matched its rotation. That's real additional art
production per monster. **Start simpler**: one sprite per
animation-frame, always facing the camera regardless of the monster's
"logical" facing (this is exactly what Delver and most modern pixel-art
dungeon crawlers do, and reads fine). Treat true 8-directional sprites
as a stretch polish item per-monster, not a v1 requirement.

Animation frame counts, kept minimal on purpose:

- **Idle**: 2 frames (a subtle breathing/shimmer loop)
- **Attack**: 2-3 frames
- **Hit reaction**: 1 frame (a flash/tint is often enough, doesn't
  strictly need a distinct pose)
- **Death**: 2-3 frames

## Palette

A limited palette **per Act**, not one master palette for the whole
game — roughly 16-24 colors each, in keeping with pixel art convention
and with pillar 4 above. Starting point, to refine once real assets are
made (ties to the four Acts in
[02-setting-and-story.md](02-setting-and-story.md#structure)):

| Act | Palette direction |
| --- | --- |
| The Sunken Wards | Damp stone grays and mosses — the most "normal," least corrupted palette |
| The Long Court | Faded gold and burgundy — rotted nobility, warmer but sickly |
| The Still Garrison | Cold steel blues and rust — martial, harder-edged |
| The Throne Beneath | Deep violet-black and bone — the least "natural" palette in the game |

**Important technical caveat**: textures are still lit dynamically (the
carried torch is warm orange, `0xffb46b`; ambient fog is near-black,
`0x05060a` — see `Game.ts`). A pixel art palette authored assuming its
exact hex values will reach the screen unmodified is wrong — author
slightly brighter/more saturated than the "final" look you want, since
the warm point-light and dark fog will both pull values down and
warm/cool them. Check new tiles in-engine under the actual torchlight,
not just in the image editor.

## Typography

A bitmap/pixel font, not a smoothed system or web font, for all in-game
text (HUD, dialogue, menus) — the current placeholder `"Georgia", serif`
in `index.html` is a Phase 0 stand-in only. Two-tier approach:

- **Display/headers** (title screen, Act names): a decorative gothic
  pixel font. *(Something in the spirit of "Alagard" — evaluate license
  terms before committing to a specific font file.)*
- **Body/HUD text**: a plain, highly legible pixel font at small sizes
  — display type is often too stylized to read as combat log/HUD text,
  especially on a phone screen per pillar 3. *(Evaluate options such as
  "Pixel Operator" or "Silkscreen"; confirm license for the intended use
  before shipping either.)*

Render text at an integer multiple of the font's native pixel size
(matches the "every pixel placed" pillar) and keep the existing warm
parchment HUD color (`#d8c9a3`, already used in `index.html`) as the
palette's UI text/accent color across the new pixel-font treatment.

## Non-goals

- No photorealistic or PBR-authored textures (normal maps, roughness
  maps, physically-based material response) — contradicts the flat
  pixel-art look and the `MeshLambertMaterial` choice above, and would
  cost more on the mobile performance budget for no benefit here.
- No anti-aliasing anywhere in the pipeline (MSAA, FXAA, TAA) — the
  renderer's own `antialias: true` flag (set in `Game.ts` for the
  current Phase 0 placeholder look) gets turned off once this style
  guide is implemented; smoothing edges directly fights pillar 1.
- No smooth sprite rotation/interpolation — a billboard snaps to face
  the camera, it doesn't tween into place.
- No per-monster 8-directional sprites in v1 (see above) — single
  always-facing sprites only, until/unless there's a specific reason to
  invest further.

## Where this lands in the roadmap

This is **[Phase 5](08-roadmap-phases.md#phase-5--content--narrative-pass)**
scope ("Environmental art pass") — Phases 0-4 keep using the flat
placeholder colors already in `DungeonMesh.ts`
(`MeshStandardMaterial` with solid colors, no textures) so gameplay
systems get proven before any art production time is spent, per the
roadmap's existing systems-before-art sequencing. When Phase 5 arrives,
implementing this doc should be a drop-in swap — texture maps and a
material change on existing geometry, plus the render-target pipeline
above — not an architecture change, since `DungeonMesh` already builds
exactly one quad per wall face and one plane for floor/ceiling.
