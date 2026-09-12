import * as THREE from "three";
import { STARTING_LEVEL, type DungeonMap } from "./DungeonMap";
import { buildDungeonMesh } from "./DungeonMesh";
import { InputManager, type Action } from "./InputManager";
import { Player } from "./Player";
import { TouchControls } from "./TouchControls";

const TILE_SIZE = 2;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly dungeon: DungeonMap;
  private readonly player: Player;
  private readonly input = new InputManager();
  private readonly clock = new THREE.Clock();

  constructor(container: HTMLElement) {
    this.dungeon = STARTING_LEVEL;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.09);
    this.scene.add(buildDungeonMesh(this.dungeon, TILE_SIZE));
    this.scene.add(new THREE.AmbientLight(0x40405a, 0.7));

    const start = this.dungeon.findStart();
    const aspect = window.innerWidth / window.innerHeight;
    this.player = new Player(start.x, start.z, 1, TILE_SIZE, aspect);

    const torch = new THREE.PointLight(0xffb46b, 1.6, 9, 2);
    torch.position.set(0, 0.1, 0);
    this.player.camera.add(torch);
    this.scene.add(this.player.camera);

    // Mounts on-screen touch buttons as a side effect; no reference needed.
    new TouchControls(this.input);

    window.addEventListener("resize", () => this.onResize());
    // Mobile browsers can be slow to fire `resize` on rotation, so also
    // listen for orientationchange explicitly.
    window.addEventListener("orientationchange", () => this.onResize());
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private tick(): void {
    const delta = this.clock.getDelta();

    if (!this.player.isAnimating) {
      const action = this.input.next();
      if (action) this.applyAction(action);
    }
    this.player.update(delta);

    this.renderer.render(this.scene, this.player.camera);
  }

  private applyAction(action: Action): void {
    const [fx, fz] = this.player.forwardStep();
    const [rx, rz] = this.player.rightStep();

    switch (action) {
      case "forward":
        this.player.tryMove(fx, fz, this.dungeon);
        break;
      case "backward":
        this.player.tryMove(-fx, -fz, this.dungeon);
        break;
      case "strafeLeft":
        this.player.tryMove(-rx, -rz, this.dungeon);
        break;
      case "strafeRight":
        this.player.tryMove(rx, rz, this.dungeon);
        break;
      case "turnLeft":
        this.player.turn(-1);
        break;
      case "turnRight":
        this.player.turn(1);
        break;
    }
  }

  private onResize(): void {
    this.player.camera.aspect = window.innerWidth / window.innerHeight;
    this.player.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
