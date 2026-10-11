import type { Card } from "./cards";
import type { DiscardPile } from "./opening";

export const MAX_PICKUP_FROM_TOP = 7;

// Kartu yang dituju dan semua kartu di atasnya. Null jika terlalu dalam
// (lebih dari 7 dari atas) atau berada di/bawah kartu joker tertutup.
export function pickableFromDiscard(pile: DiscardPile, target: Card): Card[] | null {
  const index = pile.cards.findIndex((card) => card.id === target.id);
  if (index === -1) return null;
  if (pile.closedIndex !== null && index <= pile.closedIndex) return null;
  const fromTop = pile.cards.length - index;
  if (fromTop > MAX_PICKUP_FROM_TOP) return null;
  return pile.cards.slice(index);
}
