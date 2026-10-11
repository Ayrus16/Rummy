export type Suit = "S" | "H" | "D" | "C";

export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Suit[] = ["S", "H", "D", "C"];

export function baseValue(rank: Rank): number {
  if (rank === "A") return 15;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return 5;
}

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: rank + suit, rank, suit });
    }
  }
  return deck;
}

export function shuffle(cards: Card[], rng: () => number): Card[] {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
