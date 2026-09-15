import { Character, type CharacterStats, type ClassId, type Rank } from "./Character";
import { Party } from "./Party";

/**
 * Base stat block per class — the exact numbers the Phase 2 hardcoded
 * roster always used for that class, now reusable for *any* slot a
 * party-creation screen assigns that class to
 * (docs/03-party-and-characters.md#party-creation-vs-pre-generated).
 * Not balanced against real content yet — Phase 3 is where these get
 * tuned against actual fights and gear.
 */
export const CLASS_BASE_STATS: Record<ClassId, { rank: Rank; stats: CharacterStats; maxHp: number; maxMana: number }> = {
  warrior: { rank: "front", stats: { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 }, maxHp: 30, maxMana: 0 },
  rogue: { rank: "front", stats: { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 5 }, maxHp: 22, maxMana: 0 },
  mage: { rank: "back", stats: { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 }, maxHp: 14, maxMana: 20 },
  cleric: { rank: "back", stats: { might: 3, grace: 5, vitality: 6, focus: 8, resolve: 7 }, maxHp: 18, maxMana: 18 },
};

/**
 * A handful of plain color-swatch "portraits" — honest about there being
 * no real character art yet (that's docs/10-visual-style-guide.md's job,
 * still ahead), while still letting a party-creation slot, and later the
 * HUD/inventory screen, be visually distinguishable at a glance.
 */
export const PORTRAIT_OPTIONS = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣"];

export interface PartyMemberSpec {
  name: string;
  classId: ClassId;
  portrait: string;
}

/**
 * The Phase 2 defaults — also what `PartyCreationUI` prefills every slot
 * with, so accepting every default without changing anything reproduces
 * the exact party earlier phases hardcoded.
 */
export const DEFAULT_PARTY_SPEC: PartyMemberSpec[] = [
  { name: "Bram", classId: "warrior", portrait: PORTRAIT_OPTIONS[0] },
  { name: "Ysolde", classId: "rogue", portrait: PORTRAIT_OPTIONS[2] },
  { name: "Corvin", classId: "mage", portrait: PORTRAIT_OPTIONS[4] },
  { name: "Maren", classId: "cleric", portrait: PORTRAIT_OPTIONS[3] },
];

/**
 * Builds one `Character` from a spec — any class, any slot. Its own
 * copy of the class's base stats block: two characters sharing a class
 * must never share one mutable `stats` object, or equipping gear or
 * leveling one would silently affect the other. Shared by `createParty`
 * (party creation) and `RescueEncounter` (mid-run recruitment), so
 * there's exactly one place that turns a `PartyMemberSpec` into a real
 * `Character`.
 */
export function createCharacterFromSpec({ name, classId, portrait }: PartyMemberSpec): Character {
  const base = CLASS_BASE_STATS[classId];
  return new Character(name, classId, base.rank, { ...base.stats }, base.maxHp, base.maxMana, portrait);
}

/**
 * Builds a party from a player's choices — any class in any slot, per
 * docs/03-party-and-characters.md#party-creation-vs-pre-generated's
 * "pick a class, a portrait, and a name for your character."
 */
export function createParty(specs: PartyMemberSpec[]): Party {
  return new Party(specs.map(createCharacterFromSpec));
}

/** The Phase 2 starting party (all four classic members) — still used by anything that hasn't moved to the solo-start-then-recruit flow, tests included, where exercising full-party mechanics matters more than the recruitment pacing itself. */
export function createStartingParty(): Party {
  return createParty(DEFAULT_PARTY_SPEC);
}

/**
 * The three classic roster members the player *didn't* start as
 * (docs/03-party-and-characters.md#party-creation-vs-pre-generated),
 * in fixed roster order — what `RescueEncounter` offers across levels
 * 1-3. `DEFAULT_PARTY_SPEC` is already ordered warrior/rogue/mage/cleric,
 * so filtering out the starting class preserves a stable, predictable
 * recruitment order without needing to re-sort anything.
 */
export function recruitableCompanions(startingClassId: ClassId): PartyMemberSpec[] {
  return DEFAULT_PARTY_SPEC.filter((spec) => spec.classId !== startingClassId);
}

/**
 * Picks a portrait for a new recruit that no current party member is
 * already wearing, preferring `preferred` (the companion's own
 * `DEFAULT_PARTY_SPEC` color) when it's still free. Needed because the
 * player's own starting character is a free portrait choice
 * (`PartyCreationUI`) — nothing stops them picking, say, Bram's usual
 * 🔴 for themself, and `RescueEncounter` recruiting Bram later would
 * then hand him the exact same swatch already in use, indistinguishable
 * in the HUD's party status. With up to 4 members sharing 6 options,
 * there's always at least one free color left by the time a 2nd, 3rd,
 * or 4th member joins, but `preferred` is still returned as a last
 * resort so this never produces an empty portrait.
 */
export function pickAvailablePortrait(usedPortraits: Iterable<string>, preferred: string): string {
  const used = new Set(usedPortraits);
  if (!used.has(preferred)) return preferred;
  return PORTRAIT_OPTIONS.find((portrait) => !used.has(portrait)) ?? preferred;
}
