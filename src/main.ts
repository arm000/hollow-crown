import { Game } from "./game/Game";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container element");
}

const game = new Game(container);
game.start();
