import { PartyCreationUI } from "./game/party/PartyCreationUI";
import { hasSave, loadFromStorage } from "./game/SaveGame";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container element");
}

/**
 * `Game` (Three.js and everything under it — combat, monsters, the
 * dungeon mesh/texture pipeline) is dynamically imported rather than a
 * top-level `import`, so it lands in its own chunk that Vite doesn't
 * need to fetch or parse before this screen can even paint
 * (docs/08-roadmap-phases.md Phase 6's performance pass — profiling
 * the actual render/update loop turned up nothing to fix, since combat
 * and monster AI are turn-based rather than per-frame and `Player.update`
 * already no-ops the instant it isn't mid-animation; the real cost was
 * always here, in what blocks the first paint). `PartyCreationUI` and
 * `SaveGame` both have zero Three.js in their import graphs, so without
 * this, every player — including on the slow mobile connections
 * docs/01-vision.md treats as first-class — waited on the entire game
 * bundle before seeing so much as a class-picker.
 *
 * Kicked off immediately, not inside the callbacks below: `import()`
 * calls for the same specifier share one in-flight request, so starting
 * the fetch here lets it load in the background *while* the player is
 * still naming characters, and the callbacks' own `await` almost always
 * resolves instantly against an already-finished promise instead of
 * stalling "Start"/"Continue" on a fresh download.
 */
const gameModule = import("./game/Game");

// PartyCreationUI removes its own DOM and hands back either the
// player's new-party choices or a request to continue a save (see
// SaveGame.ts) — only then does the actual game (and its WebGL
// context) get created.
new PartyCreationUI(
  async (partySpecs) => {
    const { Game } = await gameModule;
    const game = new Game(container, partySpecs);
    game.start();
  },
  hasSave()
    ? async () => {
        const { Game } = await gameModule;
        const game = new Game(container, undefined, loadFromStorage());
        game.start();
      }
    : undefined,
);
