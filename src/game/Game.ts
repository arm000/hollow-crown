import * as THREE from "three";
import type { CombatActionChoice } from "./combat/CombatEngine";
import { CombatEngine } from "./combat/CombatEngine";
import { CombatUI } from "./combat/CombatUI";
import { STARTING_LEVEL, type DungeonMap } from "./DungeonMap";
import { buildDungeonMesh } from "./DungeonMesh";
import { attemptInteract, attemptMove, attemptTurn, equipItem, unequipItem, type WorldState } from "./GameLogic";
import { Hud } from "./Hud";
import { InputManager, type Action } from "./InputManager";
import { InteractableManager } from "./interactables/InteractableManager";
import { createInteractableMesh } from "./interactables/InteractableMesh";
import { Inventory } from "./Inventory";
import { InventoryUI } from "./InventoryUI";
import {
  AMBIENT_LIGHT_COLOR,
  AMBIENT_LIGHT_INTENSITY,
  TORCH_COLOR,
  TORCH_DECAY,
  TORCH_DISTANCE,
  TORCH_INTENSITY,
} from "./Lighting";
import { STARTING_LEVEL_ENTITIES } from "./Level";
import { createCinderWretch, createRotThing } from "./monster/bestiary";
import type { Monster } from "./monster/Monster";
import type { EquipmentSlot } from "./party/Equipment";
import { createStartingParty } from "./party/roster";
import { Player } from "./Player";
import { RandomRng } from "./Rng";
import { TouchControls } from "./TouchControls";
import { WorldClock } from "./WorldClock";

const TILE_SIZE = 2;
const MONSTER_HEIGHT = 1.4;

type Mode = "explore" | "combat" | "inventory";

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly player: Player;
  private readonly input = new InputManager();
  private readonly clock = new THREE.Clock();
  private readonly world: WorldState;
  private readonly hud = new Hud();
  private readonly combatUI: CombatUI;
  private readonly inventoryUI: InventoryUI;
  private readonly entityMeshes = new Map<string, THREE.Object3D>();
  private readonly monsterMeshes = new Map<Monster, THREE.Object3D>();
  private readonly hideWallFace: (x: number, z: number) => void;
  private mode: Mode = "explore";
  private combatEngine: CombatEngine | undefined;
  private combatMonster: Monster | undefined;
  /** True once the run is over (win or defeat) — freezes input, per the win/defeat screens. */
  private runEnded = false;

  constructor(container: HTMLElement) {
    const dungeon: DungeonMap = STARTING_LEVEL;
    const interactables = InteractableManager.fromSpawns(STARTING_LEVEL_ENTITIES);
    const inventory = new Inventory();
    const party = createStartingParty();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Physically-correct lighting produces raw values that can exceed the
    // 0-1 display range; without a tone-mapping curve those either clip
    // harshly or (with weak lights) sit so low they read as near-black.
    // ACES is the standard choice paired with physically-correct lights.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.07);
    const secretWallCells = STARTING_LEVEL_ENTITIES.filter((spawn) => spawn.type === "secretWall");
    const dungeonMesh = buildDungeonMesh(dungeon, TILE_SIZE, secretWallCells);
    this.scene.add(dungeonMesh.group);
    this.hideWallFace = dungeonMesh.hideWallFace;
    // See Lighting.ts for why these values are much larger than the
    // ~0-2 range you'd expect from older Three.js tutorials.
    this.scene.add(new THREE.AmbientLight(AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY));
    this.buildEntityMeshes(interactables);

    const start = dungeon.findStart();
    const aspect = window.innerWidth / window.innerHeight;
    this.player = new Player(start.x, start.z, 1, TILE_SIZE, aspect);

    const worldClock = new WorldClock();
    const rotThing = createRotThing(
      4,
      1,
      [
        { x: 4, z: 1 },
        { x: 5, z: 1 },
      ],
      dungeon,
      this.player,
    );
    const cinderWretch = createCinderWretch(
      6,
      4,
      [
        { x: 4, z: 4 },
        { x: 6, z: 4 },
      ],
      dungeon,
      this.player,
    );
    const monsters = [rotThing, cinderWretch];
    for (const monster of monsters) {
      worldClock.register(monster);
      this.monsterMeshes.set(monster, buildMonsterMesh(monster));
    }
    for (const [monster, mesh] of this.monsterMeshes) {
      this.scene.add(mesh);
      this.syncMonsterMesh(monster);
    }

    this.world = { player: this.player, dungeon, interactables, inventory, party, worldClock, monsters };
    this.hud.updateParty(party.members);

    const torch = new THREE.PointLight(TORCH_COLOR, TORCH_INTENSITY, TORCH_DISTANCE, TORCH_DECAY);
    torch.position.set(0, 0.1, 0);
    this.player.camera.add(torch);
    this.scene.add(this.player.camera);

    // Mounts on-screen touch buttons as a side effect; no reference needed.
    new TouchControls(this.input);
    this.combatUI = new CombatUI((choice, itemId) => this.handleCombatAction(choice, itemId));
    this.inventoryUI = new InventoryUI(
      (characterName, itemId) => this.handleEquip(characterName, itemId),
      (characterName, slot) => this.handleUnequip(characterName, slot),
    );
    this.hud.onInventoryToggle(() => this.toggleInventory());

    window.addEventListener("resize", () => this.onResize());
    // Mobile browsers can be slow to fire `resize` on rotation, so also
    // listen for orientationchange explicitly.
    window.addEventListener("orientationchange", () => this.onResize());
    window.addEventListener("keydown", (event) => {
      if (event.code !== "KeyI" && !(event.code === "Escape" && this.mode === "inventory")) return;
      event.preventDefault();
      this.toggleInventory();
    });
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private buildEntityMeshes(interactables: InteractableManager): void {
    for (const entity of interactables.allEntities()) {
      const mesh = createInteractableMesh(entity, TILE_SIZE);
      if (!mesh) continue;
      this.scene.add(mesh);
      this.entityMeshes.set(`${entity.x},${entity.z}`, mesh);
    }
  }

  private tick(): void {
    const delta = this.clock.getDelta();

    if (!this.runEnded && this.mode === "explore" && !this.player.isAnimating) {
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
        this.handleTurn(-1);
        break;
      case "turnRight":
        this.handleTurn(1);
        break;
      case "interact":
        this.handleInteract();
        break;
    }
  }

  private handleMove(dx: number, dz: number): void {
    const outcome = attemptMove(this.world, dx, dz);
    if (outcome.message) this.hud.showMessage(outcome.message);
    if (outcome.pushedBlock) this.moveEntityMesh(outcome.pushedBlock.from, outcome.pushedBlock.to);
    if (outcome.enteredTile) {
      this.hud.updateInventory(this.world.inventory.list());
      this.refreshEntityVisual(outcome.enteredTile.x, outcome.enteredTile.z);
    }
    this.syncAllMonsterMeshes();
    if (outcome.won) this.win();
    if (outcome.combatTriggeredBy) this.startCombat(outcome.combatTriggeredBy);
  }

  private handleTurn(direction: 1 | -1): void {
    const outcome = attemptTurn(this.world, direction);
    this.syncAllMonsterMeshes();
    if (outcome.combatTriggeredBy) this.startCombat(outcome.combatTriggeredBy);
  }

  /** Repositions a pushed block's mesh to follow it — the only interactable in Phase 1 that moves after being placed. */
  private moveEntityMesh(from: { x: number; z: number }, to: { x: number; z: number }): void {
    const mesh = this.entityMeshes.get(`${from.x},${from.z}`);
    if (!mesh) return;
    this.entityMeshes.delete(`${from.x},${from.z}`);
    this.entityMeshes.set(`${to.x},${to.z}`, mesh);
    mesh.position.x = to.x * TILE_SIZE;
    mesh.position.z = to.z * TILE_SIZE;
  }

  private handleInteract(): void {
    const outcome = attemptInteract(this.world);
    if (outcome.message) this.hud.showMessage(outcome.message);
    if (outcome.targetTile) {
      this.hud.updateInventory(this.world.inventory.list());
      this.refreshEntityVisual(outcome.targetTile.x, outcome.targetTile.z);
    }
    this.syncAllMonsterMeshes();
    if (outcome.combatTriggeredBy) this.startCombat(outcome.combatTriggeredBy);
  }

  /** Removes an entity's placeholder mesh once it's gone (collected) or no longer worth showing (an unlocked door), and opens up a revealed secret wall's face. */
  private refreshEntityVisual(x: number, z: number): void {
    const entity = this.world.interactables.at(x, z);

    if (entity?.kind === "secretWall" && !entity.blocksMovement()) {
      this.hideWallFace(x, z);
    }

    const posKey = `${x},${z}`;
    const stillVisible = entity !== undefined && !(entity.kind === "door" && !entity.blocksMovement());
    if (stillVisible) return;

    const mesh = this.entityMeshes.get(posKey);
    if (mesh) {
      this.scene.remove(mesh);
      this.entityMeshes.delete(posKey);
    }
  }

  private syncMonsterMesh(monster: Monster): void {
    const mesh = this.monsterMeshes.get(monster);
    if (!mesh) return;
    mesh.visible = !monster.isDown;
    mesh.position.set(monster.x * TILE_SIZE, MONSTER_HEIGHT / 2, monster.z * TILE_SIZE);
  }

  private syncAllMonsterMeshes(): void {
    for (const monster of this.world.monsters) this.syncMonsterMesh(monster);
  }

  private startCombat(monster: Monster): void {
    this.mode = "combat";
    this.input.clear(); // drop anything queued right as combat starts -- see InputManager.clear()
    this.combatMonster = monster;
    this.combatEngine = new CombatEngine(this.world.party, monster, new RandomRng(), this.world.inventory);
    this.hud.showMessage(`${monster.name} attacks!`);
    this.combatUI.show();
    this.refreshCombatUI();
    this.checkCombatEnd();
  }

  private handleCombatAction(choice: CombatActionChoice, itemId?: string): void {
    if (!this.combatEngine) return;
    this.combatEngine.submitAction(choice, itemId);
    this.refreshCombatUI();
    this.checkCombatEnd();
  }

  private refreshCombatUI(): void {
    if (!this.combatEngine || !this.combatMonster) return;
    this.combatUI.render(this.combatEngine, this.combatMonster, this.world.inventory);
    this.hud.updateParty(this.world.party.members);
    this.hud.updateInventory(this.world.inventory.list());
  }

  /**
   * Opens the inventory screen from exploration only — not mid-combat or
   * after the run has ended, same gate as movement. Clears the input
   * queue on both the way in and the way out: `InputManager` captures
   * keydowns unconditionally (see its `clear()` doc comment), so without
   * this, movement keys mashed while the menu was open would all fire at
   * once, one per frame, the moment it closed.
   */
  private toggleInventory(): void {
    if (this.mode === "inventory") {
      this.mode = "explore";
      this.inventoryUI.hide();
      this.input.clear();
      return;
    }
    if (this.mode !== "explore" || this.runEnded) return;
    this.mode = "inventory";
    this.input.clear();
    this.inventoryUI.show();
    this.refreshInventoryUI();
  }

  private handleEquip(characterName: string, itemId: string): void {
    equipItem(this.world, characterName, itemId);
    this.refreshInventoryUI();
    this.hud.updateParty(this.world.party.members);
    this.hud.updateInventory(this.world.inventory.list());
  }

  private handleUnequip(characterName: string, slot: EquipmentSlot): void {
    unequipItem(this.world, characterName, slot);
    this.refreshInventoryUI();
    this.hud.updateParty(this.world.party.members);
    this.hud.updateInventory(this.world.inventory.list());
  }

  private refreshInventoryUI(): void {
    this.inventoryUI.render(this.world.party, this.world.inventory);
  }

  private checkCombatEnd(): void {
    if (!this.combatEngine || !this.combatMonster || this.combatEngine.result === "ongoing") return;

    const result = this.combatEngine.result;
    const monster = this.combatMonster;
    this.combatUI.hide();
    this.mode = "explore";
    this.input.clear(); // drop anything queued during combat -- see InputManager.clear()
    this.combatEngine = undefined;
    this.combatMonster = undefined;

    if (result === "victory") {
      this.hud.showMessage(`${monster.name} is defeated! The party gains 10 XP.`);
      this.syncMonsterMesh(monster);
    } else if (result === "fled") {
      // Otherwise the still-alerted, still-adjacent monster would just
      // trigger combat again on the party's very next action.
      monster.disengage();
      this.hud.showMessage("The party breaks off and flees back down the corridor.");
    } else if (result === "defeat") {
      this.runEnded = true; // stub per docs/08-roadmap-phases.md Phase 2 -- freezes input, no revive system yet
      this.hud.showDefeatScreen();
    }
  }

  private win(): void {
    this.runEnded = true;
    this.hud.showWinScreen();
  }

  private onResize(): void {
    this.player.camera.aspect = window.innerWidth / window.innerHeight;
    this.player.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function buildMonsterMesh(monster: Monster): THREE.Object3D {
  // Cinder Wretch reads visually distinct (warm, ember-toned) from the Rot-thing (sickly green) --
  // a placeholder cue toward its Fire-weak/Physical-resistant identity, ahead of the real Phase 5 art pass.
  const color = monster.name === "Cinder Wretch" ? 0x8a3f2a : 0x5a6b4a;
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, MONSTER_HEIGHT - 0.8, 4, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
}
