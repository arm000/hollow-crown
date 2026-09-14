import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./",
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    target: "es2022",
    // `main.ts` dynamically imports `Game.ts` on purpose (docs/08-roadmap-phases.md
    // Phase 6's performance pass) so Three.js and everything under it
    // lands in its own chunk, fetched only once the player actually
    // starts/continues a run, not before the party-creation screen can
    // paint. That chunk is inherently a few hundred KB (it's Three.js);
    // raising the warning threshold to fit it avoids Vite flagging a
    // chunk that's exactly where it's meant to be, while still warning
    // if something regresses well past today's size.
    chunkSizeWarningLimit: 600,
  },
});
