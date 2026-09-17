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
 * The opening level: exactly 10×10 (player request: "each dungeon level
 * should be 10x10"), a single main corridor along row 1 from start to
 * exit, with a one-tile side room holding a key needed further down the
 * corridor, and a dart trap early in that same corridor (docs/08-roadmap-phases.md
 * Phase 8, on a player request for "increasingly difficult monsters and
 * traps") — level 1's is the mildest in the whole descent, a single
 * modest hit, exactly where the mechanic should be gentlest.
 *
 * Everything past the mandatory corridor is optional, not required to
 * win: a pushable-block spur whose block, once pushed south onto a
 * plate, both arms a bonus door remotely *and* clears the one tile
 * leading to a hidden pocket the block itself used to stand on; a
 * separate lever a few columns over that unlocks that exact same bonus
 * door too (either mechanism alone is enough — a deliberate
 * simplification, same as it's always been); past that door, a lore
 * alcove, then a secret wall hiding a second one; and, off the lever's
 * own room, a class-gated passage that only opens for a party with a
 * Rogue along, guarding one more equipment pickup. Entity placements
 * (keys, doors, lever, plate, block, secret wall, class gate, trap,
 * exit, lore) live in `Level.ts`, layered on top of this pure geometry.
 *
 * Note for `DungeonMap.test.ts`'s connectivity check: the tile behind
 * the secret wall at (6, 7) is deliberately *not* reachable by raw
 * wall/floor adjacency alone — that's what makes it a secret. See that
 * test for how it accounts for known secret walls. Every other gated
 * tile here (the class-gated passage, the trap, the pocket the pushable
 * block guards) sits on ordinary floor — a `ClassGate`/`Trap`/
 * `PushableBlock` controls whether or how it affects the party the same
 * way a `Door` does, not a raw-adjacency trick like the secret wall, so
 * none of them need special-casing in that check.
 */
export const STARTING_LEVEL = new DungeonMap([
  "##########",
  "#S.......#",
  "###.#..###",
  "#####..###",
  "####.....#",
  "#####..###",
  "######.###",
  "##########",
  "######.###",
  "##########",
]);
