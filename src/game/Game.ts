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
  useConsumable,
  type WorldState,
} from "./GameLogic";
import { Hud } from "./Hud";
import { AudioManager } from "./AudioManager";
import { ACTIONS, InputManager, type Action } from "./InputManager";
import { InteractableManager } from "./interactables/InteractableManager";
import { createInteractableMesh } from "./interactables/InteractableMesh";
import { Inventory } from "./Inventory";
import { InventoryUI } from "./InventoryUI";
import type { MenuNavCallbacks } from "./MenuNav";
import { buildMinimapGrid } from "./Minimap";
import { MinimapUI } from "./MinimapUI";
import { MonsterAnimator } from "./MonsterAnimator";
import { OptionsUI } from "./OptionsUI";
import { Projectile } from "./Projectile";
import { ScreenFlash } from "./ScreenFlash";
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

type Mode = "explore" | "combat" | "inventory" | "bestiary" | "options";

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly player: Player;
  private readonly input: InputManager;
  private readonly clock = new THREE.Clock();
  private readonly world: WorldState;
  private readonly hud = new Hud();
  private readonly touchControls: TouchControls;
  private readonly combatUI: CombatUI;
  private readonly inventoryUI: InventoryUI;
  private readonly bestiaryUI: BestiaryUI;
  private readonly optionsUI: OptionsUI;
  /** One representative `Monster` per encountered type name, for the bestiary screen (docs/05-combat.md#the-bestiary) to describe — recorded the moment combat starts, per "win, lose, or flee" all counting as an encounter. Not persisted across save/load, same simplification as per-level interactable/monster state (see `SaveGame.ts`). */
  private readonly encounteredMonsters = new Map<string, Monster>();
  private readonly minimapUI = new MinimapUI();
  private readonly audio: AudioManager;
  /** Grid tiles the party has actually stood on this level, as `"x,z"` keys (docs/08-roadmap-phases.md Phase 5's minimap fog of war) — reset on every level transition, never persisted across save/load, same simplification as per-level interactable/monster state. */
  private visitedTiles = new Set<string>();
  private readonly entityMeshes = new Map<string, THREE.Object3D>();
  private readonly monsterMeshes = new Map<Monster, THREE.Mesh>();
  private hideWallFace: (x: number, z: number) => void = () => {};
  /** The current level's floor/wall geometry — torn down and rebuilt whole on every level transition, unlike entity/monster meshes which get their own maps. */
  private dungeonMeshGroup: THREE.Group | undefined;
  private currentLevelId = "";
  private mode: Mode = "explore";
  private combatEngine: CombatEngine | undefined;
  private combatMonster: Monster | undefined;
  /** Drives the current combat monster's attack-lunge/hit-reaction animation (docs/08-roadmap-phases.md Phase 7, on a player request for attack animations) — see `MonsterAnimator.ts` and `tick()`. Only ever animates `combatMonster`; every other monster on the level (patrolling, not yet engaged) stays at rest. */
  private readonly monsterAnimator = new MonsterAnimator();
  /** A skill's placeholder ranged VFX (docs/14-asset-inventory.md) — see `Projectile.ts`, `SKILL_VFX`, and `tick()`'s sync onto `projectileMesh`. */
  private readonly projectile = new Projectile();
  private projectileMesh: THREE.Mesh | undefined;
  /** A skill's placeholder self/party-targeted VFX (docs/14-asset-inventory.md) — see `ScreenFlash.ts` and `tick()`'s sync onto `Hud.setScreenFlash`. */
  private readonly screenFlash = new ScreenFlash();
  /** True once the run is over (win or defeat) — freezes input, per the win/defeat screens. */
  private runEnded = false;
  /**
   * Whether the always-visible "Level Up" button should glow (player
   * request: highlight for new points, stop once the screen's been
   * opened — even unspent — until the *next* level-up grants more).
   * Starts `true`: a loaded save can already be sitting on unspent
   * points this session has never shown the screen for, same as a
   * fresh level-up would. Set `true` again in `checkCombatEnd`'s
   * victory branch whenever `awardPartyXp` actually grants a level;
   * set `false` in `toggleLevelUp`'s `openInventory(true)` call,
   * regardless of what happens once there. `refreshLevelUpButton` is
   * the only reader.
   */
  private levelUpNeedsAttention = true;

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

    // A skill's placeholder ranged VFX (docs/14-asset-inventory.md) --
    // one mesh, built once and reused for every projectile fired over
    // the whole run (never more than one in flight at a time, see
    // Projectile.ts), hidden until handleCombatAction's fireProjectile
    // actually launches one. MeshBasicMaterial (unlit) rather than
    // MeshStandardMaterial: a magic bolt should read as glowing
    // regardless of the torch's own light falling on it, the same
    // reasoning the monster hit-flash's emissive channel already uses.
    this.projectileMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    this.projectileMesh.visible = false;
    this.scene.add(this.projectileMesh);

    const firstLevel = saveData ? getLevel(saveData.levelId) : LEVELS[0];
    const loaded = this.enterLevel(firstLevel, worldClock);
    this.currentLevelId = firstLevel.id;
    const startPosition = resolveStartPosition(loaded.dungeon, saveData);
    this.player.teleportTo(startPosition.x, startPosition.z, startPosition.facing);
    this.world = { player: this.player, inventory, party, worldClock, ...loaded };
    this.hud.updateParty(party.members);
    this.refreshLevelUpButton();
    this.hud.updateLevelName(firstLevel.name);
    this.hud.showMessage(firstLevel.introMessage);
    this.markVisited(startPosition.x, startPosition.z);
    this.refreshMinimap();

    this.touchControls = new TouchControls(this.input);
    this.combatUI = new CombatUI((choice, itemId, skillId) => this.handleCombatAction(choice, itemId, skillId));

    // One shared set of cross-navigation callbacks, identical across
    // Inventory/Bestiary/Options (docs/08-roadmap-phases.md Phase 7, on
    // a player report that Options "required going through the
    // inventory screen first" -- see MenuNav.ts). `onClose` reads
    // `this.mode` at call time rather than being baked to one specific
    // screen, since the exact same button appears on all three. Level
    // Up isn't a fourth destination here anymore -- it's
    // `InventoryUI`'s own in-sheet button now, not a separate screen.
    const menuNav: MenuNavCallbacks = {
      onOpenInventory: () => this.openInventory(),
      onOpenBestiary: () => this.openBestiary(),
      onOpenOptions: () => this.openOptions(),
      onSave: () => this.handleSave(),
      onClose: () => this.closeCurrentMenu(),
    };
    this.inventoryUI = new InventoryUI(
      (characterName, itemId) => this.handleEquip(characterName, itemId),
      (characterName, slot) => this.handleUnequip(characterName, slot),
      (characterName, itemId) => this.handleUseConsumable(characterName, itemId),
      (characterName, stat) => this.handleSpendStat(characterName, stat),
      (characterName, skillId) => this.handleUnlockSkill(characterName, skillId),
      menuNav,
    );
    this.bestiaryUI = new BestiaryUI(menuNav);
    this.optionsUI = new OptionsUI(
      (percent) => this.handleVolumeChange(percent),
      (muted) => this.handleMuteToggle(muted),
      (action, key) => this.handleRebind(action, key),
      menuNav,
    );
    this.hud.onInventoryToggle(() => this.toggleInventory());
    this.hud.onMuteToggle(() => this.toggleMute());
    this.hud.onBestiaryToggle(() => this.toggleBestiary());
    this.hud.onLevelUpToggle(() => this.toggleLevelUp());
    this.hud.onOptionsToggle(() => this.toggleOptions());
    // Scheduled immediately but stays silent until a real user gesture
    // lets the AudioContext resume -- see AudioManager's doc comment.
    this.audio.startAmbient();

    window.addEventListener("resize", () => this.onResize());
    // Mobile browsers can be slow to fire `resize` on rotation, so also
    // listen for orientationchange explicitly.
    window.addEventListener("orientationchange", () => this.onResize());
    window.addEventListener("keydown", (event) => {
      const inAnyMenu = this.mode === "bestiary" || this.mode === "options";
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

    if (this.combatMonster) {
      // Runs every frame during combat, not just on the action that
      // triggered an animation -- the lunge/punch play out smoothly
      // over several frames, not instantly. A no-op resync (offset
      // zero, scale 1) once nothing is actually animating.
      this.monsterAnimator.update(delta);
      this.syncMonsterMesh(this.combatMonster);
    }

    // Both run unconditionally, every frame, mode or combat state
    // aside -- same reasoning as `player.update()` above: a no-op sync
    // (invisible mesh, zero screen-flash opacity) whenever nothing's
    // actually mid-animation, exactly like `MonsterAnimator` already
    // does for the monster itself.
    this.projectile.update(delta);
    if (this.projectileMesh) {
      this.projectileMesh.visible = this.projectile.isActive;
      if (this.projectile.isActive) {
        this.projectileMesh.position.copy(this.projectile.position());
        (this.projectileMesh.material as THREE.MeshBasicMaterial).color.setHex(this.projectile.color);
      }
    }
    this.screenFlash.update(delta);
    this.hud.setScreenFlash(this.screenFlash.color, this.screenFlash.intensity);

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
      // Cheap to refresh unconditionally, same as updateInventory above
      // -- most interacts don't touch the party, but a `RescueEncounter`
      // does, and there's no cheaper way to know which one just did.
      // Without this, a freshly recruited companion was missing from
      // the top-right party status until something else (starting a
      // fight, leveling up) happened to refresh it next.
      this.hud.updateParty(this.world.party.members);
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

    const basePosition = { x: monster.x * TILE_SIZE, z: monster.z * TILE_SIZE };
    // Only the monster actually in combat ever has anything to animate
    // -- everyone else (patrolling, not yet engaged) stays exactly at
    // its grid position, scale 1, no flash.
    if (monster === this.combatMonster) {
      const offset = this.monsterAnimator.positionOffset(
        basePosition.x,
        basePosition.z,
        this.player.gridX * TILE_SIZE,
        this.player.gridZ * TILE_SIZE,
      );
      mesh.position.set(basePosition.x + offset.x, MONSTER_HEIGHT / 2 + offset.y, basePosition.z + offset.z);
      mesh.scale.setScalar(this.monsterAnimator.scale);
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = this.monsterAnimator.flashIntensity;
    } else {
      mesh.position.set(basePosition.x, MONSTER_HEIGHT / 2, basePosition.z);
    }
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
    this.monsterAnimator.reset(); // a clean start regardless of how the last fight (if any) ended
    this.projectile.cancel();
    this.screenFlash.cancel();
    this.combatMonster = monster;
    this.combatEngine = new CombatEngine(this.world.party, monster, new RandomRng(), this.world.inventory);
    this.hud.showMessage(`${monster.name} attacks!`);
    this.audio.playEncounterStinger();
    // Move/turn don't mean anything mid-fight -- freeing up the space
    // they'd otherwise occupy right where the combat log/actions are
    // also pinned (player report: on mobile, "the controls draw over
    // the combat log making it hard to read").
    this.touchControls.hide();
    this.combatUI.show();
    this.refreshCombatUI();
    this.checkCombatEnd();
  }

  private handleCombatAction(choice: CombatActionChoice, itemId?: string, skillId?: string): void {
    if (!this.combatEngine || !this.combatMonster) return;
    const monster = this.combatMonster;
    const monsterHpBefore = monster.hp;
    const partyHpBefore = this.totalPartyHp();

    // A single `submitAction` call can resolve both halves of an
    // exchange at once -- the party's action, then (via
    // `CombatEngine.resolveAutomaticTurns`) the monster's own reply --
    // so both HP deltas below can fire from one call. `MonsterAnimator.play`
    // queues rather than overwrites for exactly this reason: the hit
    // reaction and the counter-attack's lunge play as two beats in a
    // row, not one cutting the other off.
    this.combatEngine.submitAction(choice, itemId, skillId);

    // A skill's placeholder VFX (docs/14-asset-inventory.md) is looked
    // up by `skillId` directly rather than inferred from what changed
    // -- unlike the HP-delta checks below, which only decide *whether*
    // to animate, this decides *which color/kind* to, and the engine
    // already told us exactly which skill ran.
    const vfx = choice === "ability" && skillId ? SKILL_VFX[skillId] : undefined;

    if (monster.hp < monsterHpBefore) {
      const color = vfx?.color ?? 0xffffff;
      this.monsterAnimator.play("hit", color);
      if (vfx?.kind === "projectile") this.fireProjectile(color);
    }
    if (vfx?.kind === "screen") this.screenFlash.play(vfx.color);
    if (this.totalPartyHp() < partyHpBefore) this.monsterAnimator.play("attack");

    this.audio.playHit(); // one generic impact sound for any resolved action -- not yet differentiated by action or damage type
    this.refreshCombatUI();
    this.checkCombatEnd();
  }

  private totalPartyHp(): number {
    return this.world.party.members.reduce((sum, member) => sum + member.hp, 0);
  }

  /** Launches a skill's placeholder VFX bolt (docs/14-asset-inventory.md) from the camera's current world position to the combat monster's — `tick()` carries it the rest of the way via `Projectile.update()`. */
  private fireProjectile(color: number): void {
    if (!this.combatMonster) return;
    const from = this.player.camera.position;
    const to = new THREE.Vector3(this.combatMonster.x * TILE_SIZE, MONSTER_HEIGHT / 2, this.combatMonster.z * TILE_SIZE);
    this.projectile.fire(from, to, color);
  }

  private refreshCombatUI(): void {
    if (!this.combatEngine || !this.combatMonster) return;
    this.combatUI.render(this.combatEngine, this.combatMonster, this.world.inventory);
    this.hud.updateParty(this.world.party.members);
    this.hud.updateInventory(this.world.inventory.list());
  }

  /** The "I" key and the on-screen toggle button both flip between open/closed; the inventory screen's own Close button (and Escape) always closes via `closeCurrentMenu` rather than sharing this. */
  private toggleInventory(): void {
    this.toggleMenu("inventory", () => this.openInventory());
  }

  /**
   * Shared by the three always-visible menu HUD buttons (`#quick-menu`
   * in index.html — Bestiary and Options; Inventory/Level Up use
   * `toggleInventory`/`toggleLevelUp` directly instead, since they
   * both target the same screen now, just with a different
   * `openInventory` argument): closes back to exploration if
   * `targetMode` is already showing, opens it fresh if the party is
   * currently exploring (and the run hasn't ended), and otherwise does
   * nothing — mid-combat, none of these buttons should do anything at
   * all.
   */
  private toggleMenu(targetMode: Mode, open: () => void): void {
    if (this.mode === targetMode) {
      this.closeCurrentMenu();
      return;
    }
    if (this.mode !== "explore" || this.runEnded) return;
    this.input.clear(); // see InputManager.clear() -- drop anything queued right as the menu opens
    open();
  }

  private toggleBestiary(): void {
    this.toggleMenu("bestiary", () => this.openBestiary());
  }

  private toggleOptions(): void {
    this.toggleMenu("options", () => this.openOptions());
  }

  /**
   * The always-visible "Level Up" HUD button (docs/08-roadmap-phases.md
   * Phase 7, on a player request to fold the old separate Level Up
   * screen into a unified character sheet) — same "press again while
   * already showing closes it" convention `toggleMenu` gives the other
   * three buttons, just written out directly here since there's no
   * separate `"levelUp"` mode to hand `toggleMenu` anymore: opening
   * still means `openInventory`, just with edit mode pre-activated.
   */
  private toggleLevelUp(): void {
    if (this.mode === "inventory") {
      this.closeCurrentMenu();
      return;
    }
    if (this.mode !== "explore" || this.runEnded) return;
    this.input.clear();
    this.openInventory(true);
  }

  /** Hides whichever of the three menu screens happens to be showing — every `open*` method below calls this first, so any one of them can be reached directly from any other (docs/08-roadmap-phases.md Phase 7's cross-navigation, see `MenuNav.ts`) without assuming a specific predecessor screen. Hiding an already-hidden screen is a harmless no-op. */
  private hideAllMenus(): void {
    this.inventoryUI.hide();
    this.bestiaryUI.hide();
    this.optionsUI.hide();
  }

  /** The shared "Close" button every menu screen shows (`MenuNav.ts`) routes here rather than baking in one specific screen, since the exact same button renders on all three — reads `this.mode` at call time to close whichever one is actually open. */
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
    }
    // A stat/skill spent, or gear (un)equipped, in the character sheet
    // can change HP/Mana or equipment the HUD's party display reads --
    // refreshed unconditionally here, on every close, rather than only
    // from whichever specific screen happens to trigger it, since
    // Phase 7's cross-navigation means a player can now leave from any
    // of the three, not just the one they actually changed something in.
    this.hud.updateParty(this.world.party.members);
  }

  /**
   * Opened from exploration (the always-visible HUD button/`I` key,
   * via `toggleInventory`, or the "Level Up" HUD button, via
   * `toggleLevelUp`) or directly from any other menu screen
   * (`MenuNav.ts`'s cross-navigation row). `startInEditMode` (only
   * ever `true` from `toggleLevelUp`) unlocks the sheet's `+1`/skill
   * controls immediately and dismisses the HUD button's own glow —
   * see `InventoryUI.show`'s doc comment for why, and `levelUpNeedsAttention`'s
   * for the glow itself.
   */
  private openInventory(startInEditMode = false): void {
    this.mode = "inventory";
    this.hideAllMenus();
    this.inventoryUI.show(startInEditMode);
    this.refreshInventoryUI();
    if (startInEditMode) {
      this.levelUpNeedsAttention = false;
      this.refreshLevelUpButton();
    }
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

  /** The always-visible "Level Up" HUD button's count/glow (player request) — reads current `this.levelUpNeedsAttention` state, which every caller that could change it (`openInventory`'s `startInEditMode` branch, a level-up in `checkCombatEnd`) sets first. */
  private refreshLevelUpButton(): void {
    const totalPoints = this.world.party.members.reduce((sum, member) => sum + member.skillPoints, 0);
    this.hud.updateLevelUpButton(totalPoints, this.levelUpNeedsAttention);
  }

  private handleSpendStat(characterName: string, stat: keyof CharacterStats): void {
    spendStatPoint(this.world, characterName, stat);
    this.refreshInventoryUI();
    this.refreshLevelUpButton(); // the count shown there should always be exact, screen open or not (player request)
  }

  private handleUnlockSkill(characterName: string, skillId: string): void {
    const result = unlockSkill(this.world, characterName, skillId);
    if (result.message) this.hud.showMessage(result.message);
    this.refreshInventoryUI();
    this.refreshLevelUpButton();
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

  /** `InventoryUI`'s "Use [item]" button (docs/08-roadmap-phases.md Phase 7, on a player request to use consumables outside combat) — same pattern as `handleEquip`/`handleUnequip`: call the pure `GameLogic` function, surface its message, refresh every screen that could now be stale. */
  private handleUseConsumable(characterName: string, itemId: string): void {
    const result = useConsumable(this.world, characterName, itemId);
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
    // Grabbed before combatUI.hide()/combatEngine is cleared below --
    // a defeat needs to carry its last several lines onto the defeat
    // screen itself (player report: "When the party dies I can't read
    // the combat log to see what happened"), since the combat overlay
    // this log actually lives in is about to be torn down along with
    // everything else here, win, lose, or flee alike.
    const finalLog = this.combatEngine.log.slice(-14);
    this.combatUI.hide();
    this.touchControls.show(); // harmless on a defeat too -- runEnded freezes input regardless, and the defeat screen covers everything anyway
    this.mode = "explore";
    this.input.clear(); // drop anything queued during combat -- see InputManager.clear()
    this.combatEngine = undefined;
    this.combatMonster = undefined;
    // Clears the fight's own combat state above *before* this resync --
    // syncMonsterMesh only animates `combatMonster`, so this always
    // lands the mesh back at a clean base position/scale/no-flash,
    // regardless of which frame mid-lunge/mid-punch the fight happened
    // to end on. Matters most for "fled": the monster disengages and
    // keeps walking its patrol below, and without this it would do so
    // visibly frozen in whatever animation pose combat last left it in.
    this.monsterAnimator.reset();
    this.projectile.cancel();
    this.syncMonsterMesh(monster);

    if (result === "victory") {
      const levelUps = awardPartyXp(this.world.party, monster.xpReward);
      this.hud.showMessage(
        [`${monster.name} is defeated! The party gains ${monster.xpReward} XP.`, ...levelUps].join(" "),
      );
      this.hud.updateParty(this.world.party.members); // a level-up can change HP/Mana shown there
      // New points to allocate -- the HUD button should glow again,
      // even if it was already dismissed for an earlier, still-unspent
      // batch (player request).
      if (levelUps.length > 0) this.levelUpNeedsAttention = true;
      this.refreshLevelUpButton();
      this.audio.playVictoryStinger();
    } else if (result === "fled") {
      // Otherwise the still-alerted, still-adjacent monster would just
      // trigger combat again on the party's very next action.
      monster.disengage();
      this.hud.showMessage("The party breaks off and flees back down the corridor.");
      this.audio.playFleeStinger();
    } else if (result === "defeat") {
      this.runEnded = true; // stub per docs/08-roadmap-phases.md Phase 2 -- freezes input, no revive system yet
      this.hud.showDefeatScreen(finalLog);
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

/**
 * Placeholder VFX per skill (docs/14-asset-inventory.md, on a player
 * request for spell-effect animations — the `"needed"` entries the
 * asset manifest's `skill-vfx` category flagged). Every skill id here
 * is a real `SkillDef.id` from `party/Skills.ts`; a skill missing from
 * this table (there are none — every skill has an entry) would just
 * fall back to the same plain white hit-flash a basic Attack already
 * gets, per `handleCombatAction`.
 *
 * - `"projectile"`: a small colored bolt (`Projectile.ts`) travels from
 *   the camera to the monster, which then flashes this same color —
 *   the ranged/magic-feeling skills.
 * - `"melee"`: no bolt, just the monster's hit-flash in this color —
 *   an instant, close-range skill.
 * - `"screen"`: a brief colored tint across the whole view
 *   (`ScreenFlash.ts`, via `Hud.setScreenFlash`) instead of anything on
 *   the monster — for a skill that targets the caster or the party,
 *   which have no mesh of their own to show an effect on in this
 *   first-person view.
 */
const SKILL_VFX: Record<string, { kind: "projectile" | "melee" | "screen"; color: number }> = {
  "warrior-guard": { kind: "screen", color: 0xd8a24a }, // bronze -- a raised-shield cue
  "warrior-powerStrike": { kind: "melee", color: 0xffa040 }, // solid orange -- a harder physical blow than a plain Attack's white flash
  "warrior-secondWind": { kind: "screen", color: 0x6adf7a }, // green heal
  "warrior-rallyCry": { kind: "screen", color: 0xf0c860 }, // warm gold, brighter than Guard's bronze -- a party-wide beat, not a solo one
  "rogue-precisionStrike": { kind: "melee", color: 0xd83a3a }, // blood red -- Bleed
  "rogue-feint": { kind: "screen", color: 0xc8c8e0 }, // pale lavender-gray -- an opening/shimmer, distinct from Smoke Bomb's flatter gray
  "rogue-smokeBomb": { kind: "screen", color: 0x888888 }, // gray smoke
  "rogue-ambush": { kind: "melee", color: 0xfff0a0 }, // pale flash -- a fleeting opening struck fast
  "mage-firebolt": { kind: "projectile", color: 0xff6a2a }, // fire orange
  "mage-arcaneBarrier": { kind: "screen", color: 0x9060d8 }, // violet -- an arcane self-shield, distinct from Cleric Ward's blue
  "mage-frostLance": { kind: "projectile", color: 0x8ad8ff }, // ice blue
  "mage-cinderNova": { kind: "projectile", color: 0xff3a1a }, // deeper red-orange -- reads as more intense than Firebolt
  "cleric-cleanse": { kind: "screen", color: 0xa0f0ff }, // cyan-white
  "cleric-radiantSpark": { kind: "projectile", color: 0xffcf70 }, // softer amber-gold than Smite's -- reads as the lesser tier-1 version
  "cleric-smite": { kind: "projectile", color: 0xfff2b8 }, // holy gold-white
  "cleric-ward": { kind: "screen", color: 0x4a90d8 }, // shield blue
};

function buildMonsterMesh(monster: Monster): THREE.Mesh {
  const color = MONSTER_COLORS[monster.name] ?? 0x5a6b4a; // sickly green default -- the Rot-thing's original look
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, MONSTER_HEIGHT - 0.8, 4, 8),
    // emissive starts black/0 -- MonsterAnimator's hit-reaction flash
    // (docs/08-roadmap-phases.md Phase 7) is the only thing that ever
    // moves it, via syncMonsterMesh, and only for whichever monster is
    // actually in combat right now.
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0 }),
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
