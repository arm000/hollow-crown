import * as THREE from "three";
import { STARTING_LEVEL, type DungeonMap } from "./DungeonMap";
import { buildDungeonMesh } from "./DungeonMesh";
import { attemptInteract, attemptMove, type WorldState } from "./GameLogic";
import { Hud } from "./Hud";
import { InputManager, type Action } from "./InputManager";
import { InteractableManager } from "./interactables/InteractableManager";
import { createInteractableMesh } from "./interactables/InteractableMesh";
import { Inventory } from "./Inventory";
import { STARTING_LEVEL_ENTITIES } from "./Level";
import { Player } from "./Player";
import { TouchControls } from "./TouchControls";

const TILE_SIZE = 2;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly player: Player;
  private readonly input = new InputManager();
  private readonly clock = new THREE.Clock();
  private readonly world: WorldState;
  private readonly hud = new Hud();
  private readonly entityMeshes = new Map<string, THREE.Object3D>();
  private won = false;

  constructor(container: HTMLElement) {
    const dungeon: DungeonMap = STARTING_LEVEL;
    const interactables = InteractableManager.fromSpawns(STARTING_LEVEL_ENTITIES);
    const inventory = new Inventory();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.09);
    this.scene.add(buildDungeonMesh(dungeon, TILE_SIZE));
    this.scene.add(new THREE.AmbientLight(0x40405a, 0.7));
    this.buildEntityMeshes(interactables);

    const start = dungeon.findStart();
    const aspect = window.innerWidth / window.innerHeight;
    this.player = new Player(start.x, start.z, 1, TILE_SIZE, aspect);
    this.world = { player: this.player, dungeon, interactables, inventory };

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

  private buildEntityMeshes(interactables: InteractableManager): void {
    for (const spawn of STARTING_LEVEL_ENTITIES) {
      const entity = interactables.at(spawn.x, spawn.z);
      if (!entity) continue;
      const mesh = createInteractableMesh(entity, TILE_SIZE);
      if (!mesh) continue;
      this.scene.add(mesh);
      this.entityMeshes.set(`${spawn.x},${spawn.z}`, mesh);
    }
  }

  private tick(): void {
    const delta = this.clock.getDelta();

    if (!this.won && !this.player.isAnimating) {
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
        this.handleMove(fx, fz);
        break;
      case "backward":
        this.handleMove(-fx, -fz);
        break;
      case "strafeLeft":
        this.handleMove(-rx, -rz);
        break;
      case "strafeRight":
        this.handleMove(rx, rz);
        break;
      case "turnLeft":
        this.player.turn(-1);
        break;
      case "turnRight":
        this.player.turn(1);
        break;
      case "interact":
        this.handleInteract();
        break;
    }
  }

  private handleMove(dx: number, dz: number): void {
    const outcome = attemptMove(this.world, dx, dz);
    if (outcome.message) this.hud.showMessage(outcome.message);
    if (outcome.enteredTile) {
      this.hud.updateInventory(this.world.inventory.list());
      this.refreshEntityVisual(outcome.enteredTile.x, outcome.enteredTile.z);
    }
    if (outcome.won) this.win();
  }

  private handleInteract(): void {
    const outcome = attemptInteract(this.world);
    if (outcome.message) this.hud.showMessage(outcome.message);
    if (outcome.targetTile) {
      this.hud.updateInventory(this.world.inventory.list());
      this.refreshEntityVisual(outcome.targetTile.x, outcome.targetTile.z);
    }
  }

  /** Removes an entity's placeholder mesh once it's gone (collected) or no longer worth showing (an unlocked door). */
  private refreshEntityVisual(x: number, z: number): void {
    const posKey = `${x},${z}`;
    const entity = this.world.interactables.at(x, z);
    const stillVisible = entity !== undefined && !(entity.kind === "door" && !entity.blocksMovement());
    if (stillVisible) return;

    const mesh = this.entityMeshes.get(posKey);
    if (mesh) {
      this.scene.remove(mesh);
      this.entityMeshes.delete(posKey);
    }
  }

  private win(): void {
    this.won = true;
    this.hud.showWinScreen();
  }

  private onResize(): void {
    this.player.camera.aspect = window.innerWidth / window.innerHeight;
    this.player.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
