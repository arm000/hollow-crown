/**
 * A dungeon level laid out as an ASCII grid.
 *   '#' = wall
 *   '.' = floor
 *   'S' = player start (floor tile)
 * All rows must be the same length.
 */
export class DungeonMap {
  readonly width: number;
  readonly height: number;
  private readonly rows: string[];

  constructor(layout: string[]) {
    if (layout.length === 0) {
      throw new Error("Dungeon layout must have at least one row");
    }
    const width = layout[0].length;
    for (const row of layout) {
      if (row.length !== width) {
        throw new Error("Dungeon layout rows must all be the same length");
      }
    }
    this.rows = layout;
    this.height = layout.length;
    this.width = width;
  }

  tileAt(x: number, z: number): string {
    if (z < 0 || z >= this.height || x < 0 || x >= this.width) return "#";
    return this.rows[z][x];
  }

  isWall(x: number, z: number): boolean {
    return this.tileAt(x, z) === "#";
  }

  findStart(): { x: number; z: number } {
    for (let z = 0; z < this.height; z++) {
      const x = this.rows[z].indexOf("S");
      if (x !== -1) return { x, z };
    }
    return { x: 1, z: 1 };
  }
}

/**
 * The opening level: a single main corridor from start to exit, with a
 * one-tile side room holding a key needed further down the corridor.
 * Several further branches are entirely optional, not required to win:
 * a lever-and-plate room (either mechanism unlocks the same bonus
 * alcove door); past that alcove, a secret wall hiding one more hidden
 * pocket; a pushable block that itself stands on the only tile hiding a
 * one-tile pocket at (1, 4) — pushing it out of the way (onto the
 * plate at (2, 5), which also still arms the shared bonus door) is what
 * makes that tile standable at all, so solving the puzzle always turns
 * up something the party couldn't have reached any other way, not just
 * a second route to a door the lever already opens; and, off the same
 * room, a class-gated passage (row 4, columns 7-9) that only opens for
 * a party with a Rogue along, guarding one more equipment pickup.
 * Entity placements (keys, doors, lever, plate, block, secret wall,
 * class gate, exit, lore) live in `Level.ts`, layered on top of this
 * pure geometry.
 *
 * Note for `DungeonMap.test.ts`'s connectivity check: the tile behind
 * the secret wall at (6, 7) is deliberately *not* reachable by raw
 * wall/floor adjacency alone — that's what makes it a secret. See that
 * test for how it accounts for known secret walls. The class-gated
 * passage, unlike the secret wall, sits on ordinary floor tiles (a
 * `ClassGate` interactable controls whether it blocks movement, the
 * same way a `Door` does) — no special-casing needed for it there. The
 * pocket at (1, 4) needs no such accounting either: it's ordinary floor
 * too, gated purely by the `PushableBlock` sitting on the one tile that
 * leads to it (see `Level.ts`), the same mechanism as a `Door`/
 * `ClassGate` rather than a raw-adjacency trick like the secret wall.
 */
export const STARTING_LEVEL = new DungeonMap([
  "###########",
  "#S......###",
  "##..#.#####",
  "##.##.#####",
  "#..#......#",
  "##.###.####",
  "######.####",
  "###########",
  "######.####",
  "###########",
]);
