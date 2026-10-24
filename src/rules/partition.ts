import type { Card, Rank } from "./cards";
import { classify } from "./combos";
import { subsets } from "./subsets";

export function canPartition(cards: Card[], jokerRank: Rank | null): boolean {
  if (cards.length === 0) return true;
  const [first, ...rest] = cards;
  for (const group of subsets(rest, 2, 3)) {
    const meld = [first, ...group];
    if (classify(meld, jokerRank).kind === "invalid") continue;
    if (canPartition(removeCards(rest, group), jokerRank)) return true;
  }
  return false;
}

export function removeCards(hand: Card[], cards: Card[]): Card[] {
  const out = [...hand];
  for (const card of cards) {
    const index = out.findIndex((held) => held.id === card.id);
    if (index === -1) throw new Error("CARD_NOT_IN_HAND");
    out.splice(index, 1);
  }
  return out;
}
