import { Game } from "./game/Game";
import { PartyCreationUI } from "./game/party/PartyCreationUI";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container element");
}

// PartyCreationUI removes its own DOM and hands back the player's
// choices once confirmed; only then does the actual game (and its
// WebGL context) get created.
new PartyCreationUI((partySpecs) => {
  const game = new Game(container, partySpecs);
  game.start();
});
