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
 * one-tile side room holding a key needed further down the corridor,
 * plus an optional branch (a small room, then a locked bonus alcove)
 * reachable without the key. Entity placements (the key, both doors,
 * the lever, the exit, the lore item) live in `Level.ts`, layered on
 * top of this pure geometry.
 */
export const STARTING_LEVEL = new DungeonMap([
  "#########",
  "#S......#",
  "###.#.###",
  "#####.###",
  "####...##",
  "######.##",
  "######.##",
  "#########",
]);
