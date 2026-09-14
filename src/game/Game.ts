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
  facingToward,
  resolveStartPosition,
  spendStatPoint,
  unequipItem,
  unlockSkill,
  type WorldState,
} from "./GameLogic";
import { Hud } from "./Hud";
import { AudioManager } from "./AudioManager";
import { ACTIONS, InputManager, type Action } from "./InputManager";
import { InteractableManager } from "./interactables/InteractableManager";
import { createInteractableMesh } from "./interactables/InteractableMesh";
import { Inventory } from "./Inventory";
import { InventoryUI } from "./InventoryUI";
import { LevelUpUI } from "./LevelUpUI";
import type { MenuNavCallbacks } from "./MenuNav";
import { buildMinimapGrid } from "./Minimap";
import { MinimapUI } from "./MinimapUI";
import { OptionsUI } from "./OptionsUI";
import { loadSettings, saveSettings } from "./Settings";
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
import type { CharacterStats } from "./party/Character";
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

type Mode = "explore" | "combat" | "inventory" | "bestiary" | "options" | "levelUp";

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly player: Player;
  private readonly input: InputManager;
  private readonly clock = new THREE.Clock();
  private readonly world: WorldState;
  private readonly hud = new Hud();
  private readonly combatUI: CombatUI;
  private readonly inventoryUI: InventoryUI;
  private readonly bestiaryUI: BestiaryUI;
  private readonly optionsUI: OptionsUI;
  private readonly levelUpUI: LevelUpUI;
  /** One representative `Monster` per encountered type name, for the bestiary screen (docs/05-combat.md#the-bestiary) to describe — recorded the moment combat starts, per "win, lose, or flee" all counting as an encounter. Not persisted across save/load, same simplification as per-level interactable/monster state (see `SaveGame.ts`). */
  private readonly encounteredMonsters = new Map<string, Monster>();
  private readonly minimapUI = new MinimapUI();
  private readonly audio: AudioManager;
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

    // Device preferences (docs/08-roadmap-phases.md Phase 6's options
    // menu) load before `input`/`audio` exist, not after, so a returning
    // player's rebinds and volume take effect from the very first frame
    // rather than snapping over once some later code applies them.
    // Deliberately independent of `saveData` -- see Settings.ts's doc
    // comment on why these live outside the save-slot concept entirely.
    const settings = loadSettings();
    this.input = new InputManager(window, settings.keyBindings);
    this.audio = new AudioManager();
    this.audio.setVolume(settings.volume);
    this.audio.setMuted(settings.muted);
    this.hud.updateMuteButton(settings.muted);

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
    this.combatUI = new CombatUI((choice, itemId, skillId) => this.handleCombatAction(choice, itemId, skillId));

    // One shared set of cross-navigation callbacks, identical across
    // all four menu screens (docs/08-roadmap-phases.md Phase 7, on a
    // player report that Options/Level Up "required going through the
    // inventory screen first" -- see MenuNav.ts). `onClose` reads
    // `this.mode` at call time rather than being baked to one specific
    // screen, since the exact same button appears on all four.
    const menuNav: MenuNavCallbacks = {
      onOpenInventory: () => this.openInventory(),
      onOpenBestiary: () => this.openBestiary(),
      onOpenLevelUp: () => this.openLevelUp(),
      onOpenOptions: () => this.openOptions(),
      onSave: () => this.handleSave(),
      onClose: () => this.closeCurrentMenu(),
    };
    this.inventoryUI = new InventoryUI(
      (characterName, itemId) => this.handleEquip(characterName, itemId),
      (characterName, slot) => this.handleUnequip(characterName, slot),
      menuNav,
    );
    this.bestiaryUI = new BestiaryUI(menuNav);
    this.optionsUI = new OptionsUI(
      (percent) => this.handleVolumeChange(percent),
      (muted) => this.handleMuteToggle(muted),
      (action, key) => this.handleRebind(action, key),
      menuNav,
    );
    this.levelUpUI = new LevelUpUI(
      (characterName, stat) => this.handleSpendStat(characterName, stat),
      (characterName, skillId) => this.handleUnlockSkill(characterName, skillId),
      menuNav,
    );
    this.hud.onInventoryToggle(() => this.toggleInventory());
    this.hud.onMuteToggle(() => this.toggleMute());
    // Scheduled immediately but stays silent until a real user gesture
    // lets the AudioContext resume -- see AudioManager's doc comment.
    this.audio.startAmbient();

    window.addEventListener("resize", () => this.onResize());
    // Mobile browsers can be slow to fire `resize` on rotation, so also
    // listen for orientationchange explicitly.
    window.addEventListener("orientationchange", () => this.onResize());
    window.addEventListener("keydown", (event) => {
      const inAnyMenu = this.mode === "bestiary" || this.mode === "options" || this.mode === "levelUp";
      if (event.code === "Escape" && inAnyMenu) {
        // Routed through the same shared close path the cross-navigation
        // row's own Close button uses (`closeCurrentMenu`, see
        // `MenuNav.ts`) rather than each mode's specific close method
        // directly, so Escape and the on-screen button can't drift out
        // of sync on what "closing" actually does.
        event.preventDefault();
        this.closeCurrentMenu();
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
      this.audio.playFootstep();
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

  /** Snaps the party to face `(targetX, targetZ)` instantly, no turn animation -- used when combat starts against a monster that isn't necessarily the direction the party happened to be looking (see `GameLogic.facingToward`'s doc comment). */
  private faceToward(targetX: number, targetZ: number): void {
    const facing = facingToward(this.player.gridX, this.player.gridZ, targetX, targetZ);
    this.player.teleportTo(this.player.gridX, this.player.gridZ, facing);
  }

  private refreshMinimap(): void {
    this.minimapUI.render(buildMinimapGrid(this.world.dungeon, this.world.interactables, this.visitedTiles), {
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
    // An interact can change what blocks sight anywhere on the level --
    // unlocking a door, revealing a secret wall, or a lever/plate
    // unlocking a door elsewhere entirely -- so the minimap always gets
    // a full recompute here, not just on move/turn.
    this.refreshMinimap();
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
    // Turning is locked for the whole fight along with everything else
    // (see tick()'s mode gate) -- a monster can become adjacent from any
    // side, not just the one the party happens to be facing, so without
    // this the party could be fought entirely blind, staring at a wall
    // while the combat log describes a monster they can't see. The
    // corridor becoming the battlefield (docs/05-combat.md) only works
    // if the party is actually looking at it.
    this.faceToward(monster.x, monster.z);
    // Recorded here, not on victory/defeat/flee, so "win, lose, or
    // flee" all count as an encounter per docs/05-combat.md#the-bestiary
    // -- simply surviving the fight to any conclusion is enough.
    this.encounteredMonsters.set(monster.name, monster);
    this.combatMonster = monster;
    this.combatEngine = new CombatEngine(this.world.party, monster, new RandomRng(), this.world.inventory);
    this.hud.showMessage(`${monster.name} attacks!`);
    this.audio.playEncounterStinger();
    this.combatUI.show();
    this.refreshCombatUI();
    this.checkCombatEnd();
  }

  private handleCombatAction(choice: CombatActionChoice, itemId?: string, skillId?: string): void {
    if (!this.combatEngine) return;
    this.combatEngine.submitAction(choice, itemId, skillId);
    this.audio.playHit(); // one generic impact sound for any resolved action -- not yet differentiated by action or damage type
    this.refreshCombatUI();
    this.checkCombatEnd();
  }

  private refreshCombatUI(): void {
    if (!this.combatEngine || !this.combatMonster) return;
    this.combatUI.render(this.combatEngine, this.combatMonster, this.world.inventory);
    this.hud.updateParty(this.world.party.members);
    this.hud.updateInventory(this.world.inventory.list());
  }

  /** The "I" key and the on-screen toggle button both flip between open/closed; the inventory screen's own Close button (and Escape) always closes via `closeCurrentMenu` rather than sharing this. */
  private toggleInventory(): void {
    if (this.mode === "inventory") {
      this.closeCurrentMenu();
      return;
    }
    if (this.mode !== "explore" || this.runEnded) return;
    this.input.clear(); // see InputManager.clear() -- drop anything queued right as the menu opens
    this.openInventory();
  }

  /** Hides whichever of the four menu screens happens to be showing — every `open*` method below calls this first, so any one of them can be reached directly from any other (docs/08-roadmap-phases.md Phase 7's cross-navigation, see `MenuNav.ts`) without assuming a specific predecessor screen. Hiding an already-hidden screen is a harmless no-op. */
  private hideAllMenus(): void {
    this.inventoryUI.hide();
    this.bestiaryUI.hide();
    this.optionsUI.hide();
    this.levelUpUI.hide();
  }

  /** The shared "Close" button every menu screen shows (`MenuNav.ts`) routes here rather than baking in one specific screen, since the exact same button renders on all four — reads `this.mode` at call time to close whichever one is actually open. */
  private closeCurrentMenu(): void {
    switch (this.mode) {
      case "inventory":
        this.closeInventory();
        break;
      case "bestiary":
        this.closeBestiary();
        break;
      case "options":
        this.closeOptions();
        break;
      case "levelUp":
        this.closeLevelUp();
        break;
    }
    // A stat/skill spent in the Level Up screen (or gear (un)equipped in
    // Inventory) can change HP/Mana or equipment the HUD's party display
    // reads -- refreshed unconditionally here, on every close, rather
    // than only from whichever specific screen happens to trigger it,
    // since Phase 7's cross-navigation means a player can now leave from
    // any of the four, not just the one they actually changed something in.
    this.hud.updateParty(this.world.party.members);
  }

  /** Opened from exploration (the always-visible HUD button/`I` key, via `toggleInventory`) or directly from any other menu screen (`MenuNav.ts`'s cross-navigation row). */
  private openInventory(): void {
    this.mode = "inventory";
    this.hideAllMenus();
    this.inventoryUI.show();
    this.refreshInventoryUI();
  }

  private toggleMute(): void {
    this.audio.setMuted(!this.audio.isMuted);
    this.hud.updateMuteButton(this.audio.isMuted);
    this.persistSettings();
  }

  /**
   * Closes the inventory screen. Reached via the "I" key/toggle button
   * (`toggleInventory`) and via the screen's own shared Close button/
   * Escape (both routed through `closeCurrentMenu`) -- so this, not
   * `hide()` on the UI class, is the one place that actually restores
   * exploration: flips `mode` back and clears the input queue
   * (`InputManager` captures keydowns unconditionally — see its
   * `clear()` doc comment — so without this, movement keys pressed
   * while the menu was open would sit queued until something else
   * cleared them). The screen's Close button used to call the UI's
   * `hide()` directly, which only did the DOM half and left `mode`
   * stuck on "inventory" — movement looked frozen until Escape (which
   * does go through here) fixed it.
   */
  private closeInventory(): void {
    this.mode = "explore";
    this.inventoryUI.hide();
    this.input.clear();
  }

  /** Reachable from any menu screen's cross-navigation row (`MenuNav.ts`) — replaces whichever one was showing rather than layering on top of it, since `mode` is a single value. */
  private openBestiary(): void {
    this.mode = "bestiary";
    this.hideAllMenus();
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

  /** Reachable from any menu screen's cross-navigation row — same convention as `openBestiary`. */
  private openOptions(): void {
    this.mode = "options";
    this.hideAllMenus();
    this.optionsUI.show();
    this.refreshOptionsUI();
  }

  /** Closes straight back to exploration, not back to the inventory screen — same convention as `closeBestiary`. */
  private closeOptions(): void {
    this.mode = "explore";
    this.optionsUI.hide();
    this.input.clear();
  }

  private refreshOptionsUI(): void {
    this.optionsUI.render(this.audio.volumePercent, this.audio.isMuted, (action) => this.input.keyFor(action));
  }

  /**
   * The three options-screen callbacks below all follow the same shape:
   * apply the change to the live `AudioManager`/`InputManager` so it
   * takes effect immediately, persist the *whole* settings blob (not
   * just the one field that changed) via `saveSettings`, and re-render
   * so the screen reflects what actually landed. Reading `this.input`/
   * `this.audio` back for the persisted values, rather than trusting the
   * callback's own argument, keeps this correct even if a future control
   * clamps or rejects part of a change.
   */
  private handleVolumeChange(percent: number): void {
    this.audio.setVolume(percent);
    this.persistSettings();
    this.refreshOptionsUI();
  }

  private handleMuteToggle(muted: boolean): void {
    this.audio.setMuted(muted);
    this.hud.updateMuteButton(this.audio.isMuted);
    this.persistSettings();
    this.refreshOptionsUI();
  }

  private handleRebind(action: Action, key: string): void {
    this.input.rebind(action, key);
    this.persistSettings();
    this.refreshOptionsUI();
  }

  private persistSettings(): void {
    const keyBindings: Partial<Record<Action, string>> = {};
    for (const action of ACTIONS) {
      const key = this.input.keyFor(action);
      if (key) keyBindings[action] = key;
    }
    saveSettings({ volume: this.audio.volumePercent, muted: this.audio.isMuted, keyBindings });
  }

  /** Reachable from any menu screen's cross-navigation row — same convention as `openBestiary`/`openOptions`. */
  private openLevelUp(): void {
    this.mode = "levelUp";
    this.hideAllMenus();
    this.levelUpUI.show();
    this.refreshLevelUpUI();
  }

  /** Closes straight back to exploration, not back to the inventory screen — same convention as `closeBestiary`/`closeOptions`. */
  private closeLevelUp(): void {
    this.mode = "explore";
    this.levelUpUI.hide();
    this.input.clear();
  }

  private refreshLevelUpUI(): void {
    this.levelUpUI.render(this.world.party);
  }

  private handleSpendStat(characterName: string, stat: keyof CharacterStats): void {
    spendStatPoint(this.world, characterName, stat);
    this.refreshLevelUpUI();
  }

  private handleUnlockSkill(characterName: string, skillId: string): void {
    const result = unlockSkill(this.world, characterName, skillId);
    if (result.message) this.hud.showMessage(result.message);
    this.refreshLevelUpUI();
  }

  private handleEquip(characterName: string, itemId: string): void {
    const result = equipItem(this.world, characterName, itemId);
    // A refusal (cursed gear already worn there) has a message worth
    // surfacing -- shown once the inventory screen closes, same as the
    // "Game saved." confirmation already does from behind this overlay.
    if (result.message) this.hud.showMessage(result.message);
    this.refreshInventoryUI();
    this.hud.updateParty(this.world.party.members);
    this.hud.updateInventory(this.world.inventory.list());
  }

  private handleUnequip(characterName: string, slot: EquipmentSlot): void {
    const result = unequipItem(this.world, characterName, slot);
    if (result.message) this.hud.showMessage(result.message);
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
      this.audio.playVictoryStinger();
      this.syncMonsterMesh(monster);
    } else if (result === "fled") {
      // Otherwise the still-alerted, still-adjacent monster would just
      // trigger combat again on the party's very next action.
      monster.disengage();
      this.hud.showMessage("The party breaks off and flees back down the corridor.");
      this.audio.playFleeStinger();
    } else if (result === "defeat") {
      this.runEnded = true; // stub per docs/08-roadmap-phases.md Phase 2 -- freezes input, no revive system yet
      this.hud.showDefeatScreen();
      this.audio.playDefeatStinger();
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
