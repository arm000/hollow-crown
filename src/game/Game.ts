import * as THREE from "three";
import { BestiaryUI } from "./BestiaryUI";
import type { CombatActionChoice } from "./combat/CombatEngine";
import { CombatEngine } from "./combat/CombatEngine";
import { CombatUI } from "./combat/CombatUI";
import type { DungeonMap } from "./DungeonMap";
import { buildDungeonMesh } from "./DungeonMesh";
import { buildActOneMaterials } from "./Textures";
import {
  attemptInteract,
  attemptMove,
  attemptTurn,
  equipItem,
  resolveStartPosition,
  unequipItem,
  type WorldState,
} from "./GameLogic";
import { Hud } from "./Hud";
import { InputManager, type Action } from "./InputManager";
import { InteractableManager } from "./interactables/InteractableManager";
import { createInteractableMesh } from "./interactables/InteractableMesh";
import { Inventory } from "./Inventory";
import { InventoryUI } from "./InventoryUI";
import { buildMinimapGrid } from "./Minimap";
import { MinimapUI } from "./MinimapUI";
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
import { describeMonster } from "./monster/BestiaryEntry";
import { buildMonsters } from "./monster/bestiary";
import type { Monster } from "./monster/Monster";
import type { EquipmentSlot } from "./party/Equipment";
import { awardPartyXp } from "./party/Leveling";
import { createParty, DEFAULT_PARTY_SPEC, type PartyMemberSpec } from "./party/roster";
import { Player } from "./Player";
import { RandomRng } from "./Rng";
import { deserializeInventory, deserializeParty, saveToStorage, serialize, type SaveData } from "./SaveGame";
import { TouchControls } from "./TouchControls";
import { WorldClock } from "./WorldClock";

const TILE_SIZE = 2;
const MONSTER_HEIGHT = 1.4;

type Mode = "explore" | "combat" | "inventory" | "bestiary";

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
  private readonly bestiaryUI: BestiaryUI;
  /** One representative `Monster` per encountered type name, for the bestiary screen (docs/05-combat.md#the-bestiary) to describe — recorded the moment combat starts, per "win, lose, or flee" all counting as an encounter. Not persisted across save/load, same simplification as per-level interactable/monster state (see `SaveGame.ts`). */
  private readonly encounteredMonsters = new Map<string, Monster>();
  private readonly minimapUI = new MinimapUI();
  /** Grid tiles the party has actually stood on this level, as `"x,z"` keys (docs/08-roadmap-phases.md Phase 5's minimap fog of war) — reset on every level transition, never persisted across save/load, same simplification as per-level interactable/monster state. */
  private visitedTiles = new Set<string>();
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

    // "Pixel art, whole-frame" (docs/10-visual-style-guide.md): render
    // at a small fixed internal resolution and let CSS scale it up with
    // nearest-neighbor sampling (`image-rendering: pixelated` in
    // index.html), rather than rendering at full screen resolution and
    // only the wall textures looking pixel-art. No AA at any stage --
    // smoothing edges directly fights that look. pixelRatio is pinned
    // to 1 (not the device's real ratio): the whole point is a fixed,
    // deliberately low resolution regardless of screen density.
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(1);
    const initialSize = computeLowResSize();
    this.renderer.setSize(initialSize.width, initialSize.height, false); // false: leave the canvas's own CSS size alone, index.html's #app canvas rule stretches it to fill the screen
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

    // The player/camera exist before any level does -- `enterLevel`
    // only builds a level's geometry/monsters, it never moves the
    // player (only `transitionToLevel` does that, for a level change
    // after the first). The (0, 0) placeholder here is corrected
    // explicitly below, before the first frame ever renders.
    const aspect = window.innerWidth / window.innerHeight;
    this.player = new Player(0, 0, 1, TILE_SIZE, aspect);
    const torch = new THREE.PointLight(TORCH_COLOR, TORCH_INTENSITY, TORCH_DISTANCE, TORCH_DECAY);
    torch.position.set(0, 0.1, 0);
    this.player.camera.add(torch);
    this.scene.add(this.player.camera);

    const firstLevel = saveData ? getLevel(saveData.levelId) : LEVELS[0];
    const loaded = this.enterLevel(firstLevel, worldClock);
    this.currentLevelId = firstLevel.id;
    const startPosition = resolveStartPosition(loaded.dungeon, saveData);
    this.player.teleportTo(startPosition.x, startPosition.z, startPosition.facing);
    this.world = { player: this.player, inventory, party, worldClock, ...loaded };
    this.hud.updateParty(party.members);
    this.hud.updateLevelName(firstLevel.name);
    this.hud.showMessage(firstLevel.introMessage);
    this.markVisited(startPosition.x, startPosition.z);
    this.refreshMinimap();

    // Mounts on-screen touch buttons as a side effect; no reference needed.
    new TouchControls(this.input);
    this.combatUI = new CombatUI((choice, itemId) => this.handleCombatAction(choice, itemId));
    this.inventoryUI = new InventoryUI(
      (characterName, itemId) => this.handleEquip(characterName, itemId),
      (characterName, slot) => this.handleUnequip(characterName, slot),
      () => this.closeInventory(),
      () => this.handleSave(),
      () => this.openBestiary(),
    );
    this.bestiaryUI = new BestiaryUI(() => this.closeBestiary());
    this.hud.onInventoryToggle(() => this.toggleInventory());

    window.addEventListener("resize", () => this.onResize());
    // Mobile browsers can be slow to fire `resize` on rotation, so also
    // listen for orientationchange explicitly.
    window.addEventListener("orientationchange", () => this.onResize());
    window.addEventListener("keydown", (event) => {
      if (event.code === "Escape" && this.mode === "bestiary") {
        event.preventDefault();
        this.closeBestiary();
        return;
      }
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
      disposeObject3D(this.dungeonMeshGroup); // frees the previous level's geometry + textures -- see Textures.ts
      for (const mesh of this.entityMeshes.values()) this.scene.remove(mesh);
      this.entityMeshes.clear();
      for (const mesh of this.monsterMeshes.values()) this.scene.remove(mesh);
      this.monsterMeshes.clear();
    }

    const dungeon = level.dungeon;
    const interactables = InteractableManager.fromSpawns(level.entities);
    const secretWallCells = level.entities.filter((spawn) => spawn.type === "secretWall");
    const dungeonMesh = buildDungeonMesh(dungeon, TILE_SIZE, secretWallCells, buildActOneMaterials(dungeon));
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

    const startPosition = resolveStartPosition(dungeon);
    this.player.teleportTo(startPosition.x, startPosition.z, startPosition.facing);

    this.hud.updateLevelName(level.name);
    // For a level with a boss (level 4), this line *is* the mid-dungeon
    // reveal (docs/02-setting-and-story.md's "a boss standing where you
    // expected an empty hall") -- not a separate system, just this
    // message landing at the right moment.
    this.hud.showMessage(level.introMessage);
    this.hud.updateInventory(this.world.inventory.list());

    this.visitedTiles = new Set(); // a new level's minimap starts fully unexplored
    this.markVisited(startPosition.x, startPosition.z);
    this.refreshMinimap();
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
      this.markVisited(outcome.enteredTile.x, outcome.enteredTile.z);
    }
    if (outcome.levelTransition) {
      // The old level (and any monster on it) is gone the instant this
      // fires -- skip syncing meshes or starting combat against a
      // level we've already left behind. transitionToLevel resets and
      // redraws the minimap itself, for the new level.
      this.transitionToLevel(outcome.levelTransition);
      return;
    }
    this.refreshMinimap();
    this.syncAllMonsterMeshes();
    if (outcome.won) this.win();
    if (outcome.combatTriggeredBy) this.startCombat(outcome.combatTriggeredBy);
  }

  private handleTurn(direction: 1 | -1): void {
    const outcome = attemptTurn(this.world, direction);
    this.refreshMinimap(); // facing changed -- the minimap's player arrow needs to follow
    this.syncAllMonsterMeshes();
    if (outcome.combatTriggeredBy) this.startCombat(outcome.combatTriggeredBy);
  }

  private markVisited(x: number, z: number): void {
    this.visitedTiles.add(`${x},${z}`);
  }

  private refreshMinimap(): void {
    this.minimapUI.render(buildMinimapGrid(this.world.dungeon, this.visitedTiles), {
      x: this.player.gridX,
      z: this.player.gridZ,
      facing: this.player.facing,
    });
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
    // Recorded here, not on victory/defeat/flee, so "win, lose, or
    // flee" all count as an encounter per docs/05-combat.md#the-bestiary
    // -- simply surviving the fight to any conclusion is enough.
    this.encounteredMonsters.set(monster.name, monster);
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

  /** Opened from the inventory screen's "Bestiary" button — replaces that screen rather than layering on top of it, since `mode` is a single value. */
  private openBestiary(): void {
    this.mode = "bestiary";
    this.inventoryUI.hide();
    this.bestiaryUI.show();
    this.refreshBestiaryUI();
  }

  /** Closes straight back to exploration, not back to the inventory screen — same "Close always means fully done here" convention as `closeInventory`. */
  private closeBestiary(): void {
    this.mode = "explore";
    this.bestiaryUI.hide();
    this.input.clear();
  }

  private refreshBestiaryUI(): void {
    this.bestiaryUI.render([...this.encounteredMonsters.values()].map(describeMonster));
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
    const size = computeLowResSize();
    this.renderer.setSize(size.width, size.height, false); // see the constructor's comment on the `false` -- still true after a resize
  }
}

/**
 * Target internal resolution for the pixel-art rendering pipeline
 * (docs/10-visual-style-guide.md#rendering-pipeline): roughly 320x180
 * for a 16:9-ish view, computed from the live aspect ratio the same way
 * `onResize` already tracked it pre-Phase-5, just at this much lower a
 * resolution. Fixes whichever screen dimension is shorter and derives
 * the other from the live aspect ratio, rather than always fixing
 * height — a portrait phone (mobile is first-class throughout this
 * project, per docs/01-vision.md#platform--scope) would otherwise fix
 * the same 180px height as landscape and derive an illegibly thin
 * width (well under 100px on a typical tall phone aspect).
 */
const LOW_RES_MIN_DIMENSION = 180;

function computeLowResSize(): { width: number; height: number } {
  const aspect = window.innerWidth / window.innerHeight;
  if (aspect >= 1) {
    return { width: Math.round(LOW_RES_MIN_DIMENSION * aspect), height: LOW_RES_MIN_DIMENSION };
  }
  return { width: LOW_RES_MIN_DIMENSION, height: Math.round(LOW_RES_MIN_DIMENSION / aspect) };
}

/** A placeholder color cue per monster type, ahead of the real Phase 5 art pass — e.g. the Cinder Wretch's warm, ember tone hints at its Fire-weak/Physical-resistant identity without stating it. */
const MONSTER_COLORS: Record<string, number> = {
  "Cinder Wretch": 0x8a3f2a,
  "Screeching Wraith": 0xd8d8e8,
  "Court Alchemist": 0x6a4a7a,
};

function buildMonsterMesh(monster: Monster): THREE.Object3D {
  const color = MONSTER_COLORS[monster.name] ?? 0x5a6b4a; // sickly green default -- the Rot-thing's original look
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, MONSTER_HEIGHT - 0.8, 4, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
}

/** Frees GPU-side geometry/material/texture resources for everything under `object` — needed now that the dungeon mesh carries real canvas-backed textures (`Textures.ts`), not just flat colors, so a level transition's teardown doesn't quietly leak a texture per level visited. */
function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      const map = (material as THREE.MeshLambertMaterial).map;
      if (map) map.dispose();
      material.dispose();
    }
  });
}
