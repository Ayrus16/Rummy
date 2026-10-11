import { baseValue, type Card, type Rank } from "./cards";

export type PlayerId = 0 | 1 | 2 | 3;

// cards[0] = paling bawah (paling lama), cards[last] = paling atas (paling baru).
export interface DiscardPile {
  cards: Card[];
  closedIndex: number | null;
}

export interface OpeningState {
  hands: Card[][];
  stock: Card[];
  discard: DiscardPile;
  jokerRank: Rank | null;
  penalties: number[];
}

const JOKER_PENALTY_MULTIPLIER = 10;

// Pemain mengambil satu kartu dari cangkulan lalu membuang satu kartu.
// Urutan pembuangan harus 0, 1, 2, 3, dan angka buangan tidak boleh sama.
export function openingDiscard(state: OpeningState, player: PlayerId, card: Card): OpeningState {
  if (state.discard.cards.length !== player) throw new Error("OUT_OF_ORDER");
  if (state.discard.cards.some((placed) => placed.rank === card.rank)) {
    throw new Error("DUPLICATE_OPENING_RANK");
  }
  const [drawn, ...stock] = state.stock;
  const hand = [...state.hands[player], drawn];
  const index = hand.findIndex((held) => held.id === card.id);
  if (index === -1) throw new Error("CARD_NOT_IN_HAND");
  const hands = state.hands.map((h, seat) => (seat === player ? hand.filter((_, i) => i !== index) : h));
  return {
    ...state,
    hands,
    stock,
    discard: { ...state.discard, cards: [...state.discard.cards, card] },
  };
}

// Setelah keempat pemain membuang, satu kartu diambil acak dari cangkulan sebagai penentu.
// Kartu penentu keluar dari permainan. Buangan pembukaan yang angkanya sama dengan joker
// membuat pembuangnya kena penalti dan kartu itu ditutup.
export function resolveJoker(state: OpeningState, rng: () => number): OpeningState {
  if (state.discard.cards.length !== 4) throw new Error("OPENING_INCOMPLETE");
  const stock = [...state.stock];
  const [penentu] = stock.splice(Math.floor(rng() * stock.length), 1);
  const jokerRank = penentu.rank;

  const penalties = [...state.penalties];
  let closedIndex: number | null = null;
  state.discard.cards.forEach((card, index) => {
    if (card.rank !== jokerRank) return;
    penalties[index] -= JOKER_PENALTY_MULTIPLIER * baseValue(card.rank);
    closedIndex = index;
  });

  return {
    ...state,
    stock,
    jokerRank,
    penalties,
    discard: { ...state.discard, closedIndex },
  };
}
