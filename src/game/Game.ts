import * as THREE from "three";
import type { CombatActionChoice } from "./combat/CombatEngine";
import { CombatEngine } from "./combat/CombatEngine";
import { CombatUI } from "./combat/CombatUI";
import type { DungeonMap } from "./DungeonMap";
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
import { getLevel, LEVELS } from "./levels";
import type { LevelDef } from "./levels/LevelDef";
import { buildMonsters } from "./monster/bestiary";
import type { Monster } from "./monster/Monster";
import type { EquipmentSlot } from "./party/Equipment";
import { awardPartyXp } from "./party/Leveling";
import { createParty, DEFAULT_PARTY_SPEC, type PartyMemberSpec } from "./party/roster";
import { Player, type Facing } from "./Player";
import { RandomRng } from "./Rng";
import { deserializeInventory, deserializeParty, saveToStorage, serialize, type SaveData } from "./SaveGame";
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
  private hideWallFace: (x: number, z: number) => void = () => {};
  /** The current level's floor/wall geometry — torn down and rebuilt whole on every level transition, unlike entity/monster meshes which get their own maps. */
  private dungeonMeshGroup: THREE.Group | undefined;
  private currentLevelId = "";
  private mode: Mode = "explore";
  private combatEngine: CombatEngine | undefined;
  private combatMonster: Monster | undefined;
  /** True once the run is over (win or defeat) — freezes input, per the win/defeat screens. */
  private runEnded = false;

  /**
   * `partySpecs` defaults to the Phase 2 roster so anything that
   * constructs `Game` directly (tests included) doesn't need to know
   * `PartyCreationUI` exists — `main.ts` is the only real caller that
   * passes a player's actual choices. `saveData`, when given, wins over
   * `partySpecs` entirely: `main.ts`'s "Continue" path (see
   * `SaveGame.ts`) restores the saved party/inventory/level/position
   * instead of building a fresh party and starting at level 1.
   */
  constructor(container: HTMLElement, partySpecs: PartyMemberSpec[] = DEFAULT_PARTY_SPEC, saveData?: SaveData) {
    const inventory = saveData ? deserializeInventory(saveData) : new Inventory();
    const party = saveData ? deserializeParty(saveData) : createParty(partySpecs);
    const worldClock = new WorldClock();

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
    // See Lighting.ts for why these values are much larger than the
    // ~0-2 range you'd expect from older Three.js tutorials. Ambient
    // light and fog are level-independent for now -- shared across the
    // whole descent rather than rebuilt per level.
    this.scene.add(new THREE.AmbientLight(AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY));

    // The player/camera exist before any level does -- `enterLevel` below
    // repositions it via `teleportTo` before the first frame ever
    // renders, so the (0, 0) placeholder here is never actually seen.
    const aspect = window.innerWidth / window.innerHeight;
    this.player = new Player(0, 0, 1, TILE_SIZE, aspect);
    const torch = new THREE.PointLight(TORCH_COLOR, TORCH_INTENSITY, TORCH_DISTANCE, TORCH_DECAY);
    torch.position.set(0, 0.1, 0);
    this.player.camera.add(torch);
    this.scene.add(this.player.camera);

    const firstLevel = saveData ? getLevel(saveData.levelId) : LEVELS[0];
    const loaded = this.enterLevel(firstLevel, worldClock);
    this.currentLevelId = firstLevel.id;
    if (saveData) {
      // enterLevel already placed the player on the level's own start
      // tile -- override with exactly where the save left off.
      this.player.teleportTo(saveData.playerX, saveData.playerZ, saveData.playerFacing as Facing);
    }
    this.world = { player: this.player, inventory, party, worldClock, ...loaded };
    this.hud.updateParty(party.members);

    // Mounts on-screen touch buttons as a side effect; no reference needed.
    new TouchControls(this.input);
    this.combatUI = new CombatUI((choice, itemId) => this.handleCombatAction(choice, itemId));
    this.inventoryUI = new InventoryUI(
      (characterName, itemId) => this.handleEquip(characterName, itemId),
      (characterName, slot) => this.handleUnequip(characterName, slot),
      () => this.closeInventory(),
      () => this.handleSave(),
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

  /** The level the party is currently on — for save/load (docs/08-roadmap-phases.md Phase 4) to persist and restore. */
  get levelId(): string {
    return this.currentLevelId;
  }

  private buildEntityMeshes(interactables: InteractableManager): void {
    for (const entity of interactables.allEntities()) {
      const mesh = createInteractableMesh(entity, TILE_SIZE);
      if (!mesh) continue;
      this.scene.add(mesh);
      this.entityMeshes.set(`${entity.x},${entity.z}`, mesh);
    }
  }

  /**
   * Builds one level's runtime geometry and state (docs/08-roadmap-phases.md
   * Phase 4): dungeon mesh, entity meshes, and monsters, registering the
   * latter with `worldClock`. Tears down whatever the *previous* level
   * left behind first -- guarded by `dungeonMeshGroup` being set, which
   * it only is after the first call, so the constructor's initial call
   * has nothing to tear down. Doesn't touch `this.world` itself (which
   * doesn't exist yet on that first call) -- callers apply the returned
   * pieces themselves.
   */
  private enterLevel(
    level: LevelDef,
    worldClock: WorldClock,
  ): { dungeon: DungeonMap; interactables: InteractableManager; monsters: Monster[] } {
    if (this.dungeonMeshGroup) {
      this.scene.remove(this.dungeonMeshGroup);
      for (const mesh of this.entityMeshes.values()) this.scene.remove(mesh);
      this.entityMeshes.clear();
      for (const mesh of this.monsterMeshes.values()) this.scene.remove(mesh);
      this.monsterMeshes.clear();
    }

    const dungeon = level.dungeon;
    const interactables = InteractableManager.fromSpawns(level.entities);
    const secretWallCells = level.entities.filter((spawn) => spawn.type === "secretWall");
    const dungeonMesh = buildDungeonMesh(dungeon, TILE_SIZE, secretWallCells);
    this.scene.add(dungeonMesh.group);
    this.dungeonMeshGroup = dungeonMesh.group;
    this.hideWallFace = dungeonMesh.hideWallFace;
    this.buildEntityMeshes(interactables);

    const monsters = buildMonsters(level.monsters, dungeon, this.player);
    worldClock.clear(); // the previous level's monsters, if any -- see WorldClock.clear()
    for (const monster of monsters) {
      worldClock.register(monster);
      this.monsterMeshes.set(monster, buildMonsterMesh(monster));
    }
    for (const [monster, mesh] of this.monsterMeshes) {
      this.scene.add(mesh);
      this.syncMonsterMesh(monster);
    }

    return { dungeon, interactables, monsters };
  }

  /** Loads a different level by id and places the party on its start tile, facing east — the direction every hand-authored level's corridor extends from its 'S' tile. Called when the party steps onto a `StairsDown` (see `handleMove`). */
  private transitionToLevel(levelId: string): void {
    const level = getLevel(levelId);
    const { dungeon, interactables, monsters } = this.enterLevel(level, this.world.worldClock);
    this.world.dungeon = dungeon;
    this.world.interactables = interactables;
    this.world.monsters = monsters;
    this.currentLevelId = level.id;

    const start = dungeon.findStart();
    this.player.teleportTo(start.x, start.z, 1);

    this.hud.showMessage("You descend deeper into the dungeon...");
    this.hud.updateInventory(this.world.inventory.list());
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
    if (outcome.levelTransition) {
      // The old level (and any monster on it) is gone the instant this
      // fires -- skip syncing meshes or starting combat against a
      // level we've already left behind.
      this.transitionToLevel(outcome.levelTransition);
      return;
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
    const opensPermanently = entity?.kind === "door" || entity?.kind === "classGate";
    const stillVisible = entity !== undefined && !(opensPermanently && !entity.blocksMovement());
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

  /** The "I" key and the on-screen toggle button both flip between open/closed; the inventory screen's own Close button always closes (see `closeInventory`) rather than sharing this. */
  private toggleInventory(): void {
    if (this.mode === "inventory") {
      this.closeInventory();
      return;
    }
    if (this.mode !== "explore" || this.runEnded) return;
    this.mode = "inventory";
    this.input.clear(); // see InputManager.clear() -- drop anything queued right as the menu opens
    this.inventoryUI.show();
    this.refreshInventoryUI();
  }

  /**
   * Closes the inventory screen. Called from three places -- the "I"
   * key, the toggle button (both via `toggleInventory`), and the
   * screen's own Close button directly -- so this, not `hide()` on the
   * UI class, is the one place that actually restores exploration:
   * flips `mode` back and clears the input queue (`InputManager`
   * captures keydowns unconditionally — see its `clear()` doc comment —
   * so without this, movement keys pressed while the menu was open
   * would sit queued until something else cleared them). The screen's
   * Close button used to call the UI's `hide()` directly, which only
   * did the DOM half and left `mode` stuck on "inventory" — movement
   * looked frozen until Escape (which does go through here) fixed it.
   */
  private closeInventory(): void {
    this.mode = "explore";
    this.inventoryUI.hide();
    this.input.clear();
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

  /** Overwrites the single save slot with the current run's state (docs/08-roadmap-phases.md Phase 4) — party, inventory, current level, and exact grid position/facing, per `SaveGame.ts`. Only reachable from the inventory screen, itself only reachable from exploration, so there's no mid-combat/post-run save state to guard against here. */
  private handleSave(): void {
    saveToStorage(serialize(this.world, this.currentLevelId));
    this.hud.showMessage("Game saved.");
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
      const levelUps = awardPartyXp(this.world.party, monster.xpReward);
      this.hud.showMessage(
        [`${monster.name} is defeated! The party gains ${monster.xpReward} XP.`, ...levelUps].join(" "),
      );
      this.hud.updateParty(this.world.party.members); // a level-up can change HP/Mana shown there
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
