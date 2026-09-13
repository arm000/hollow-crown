import { Game } from "./game/Game";
import { PartyCreationUI } from "./game/party/PartyCreationUI";
import { hasSave, loadFromStorage } from "./game/SaveGame";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container element");
}

// PartyCreationUI removes its own DOM and hands back either the
// player's new-party choices or a request to continue a save (see
// SaveGame.ts) — only then does the actual game (and its WebGL
// context) get created.
new PartyCreationUI(
  (partySpecs) => {
    const game = new Game(container, partySpecs);
    game.start();
  },
  hasSave()
    ? () => {
        const game = new Game(container, undefined, loadFromStorage());
        game.start();
      }
    : undefined,
);
