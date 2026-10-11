import type { Card } from "./cards";

export const HAND_SIZE = 7;
export const PLAYER_COUNT = 4;

export function deal(deck: Card[]): { hands: Card[][]; stock: Card[] } {
  const hands: Card[][] = Array.from({ length: PLAYER_COUNT }, () => []);
  let next = 0;
  for (let round = 0; round < HAND_SIZE; round++) {
    for (let seat = 0; seat < PLAYER_COUNT; seat++) {
      hands[seat].push(deck[next++]);
    }
  }
  return { hands, stock: deck.slice(next) };
}
