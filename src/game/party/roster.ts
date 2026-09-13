import { Character } from "./Character";
import { Party } from "./Party";

/**
 * The Phase 2 starting party: one pre-built character per class
 * (docs/03-party-and-characters.md#party-creation-vs-pre-generated).
 * Stats are a first pass, not balanced against real content yet — Phase
 * 3 is where these numbers get tuned against actual fights and gear.
 */
export function createStartingParty(): Party {
  return new Party([
    new Character(
      "Bram",
      "warrior",
      "front",
      { might: 8, grace: 4, vitality: 10, focus: 1, resolve: 6 },
      30,
      0,
    ),
    new Character(
      "Ysolde",
      "rogue",
      "front",
      { might: 6, grace: 8, vitality: 7, focus: 2, resolve: 5 },
      22,
      0,
    ),
    new Character(
      "Corvin",
      "mage",
      "back",
      { might: 2, grace: 5, vitality: 5, focus: 9, resolve: 4 },
      14,
      20,
    ),
    new Character(
      "Maren",
      "cleric",
      "back",
      { might: 3, grace: 5, vitality: 6, focus: 8, resolve: 7 },
      18,
      18,
    ),
  ]);
}
