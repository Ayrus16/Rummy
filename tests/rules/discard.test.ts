import { expect, test } from "vitest";
import type { Card, Rank } from "../../src/rules/cards";
import { pickableFromDiscard } from "../../src/rules/discard";

function c(id: string): Card {
  return { id, rank: id.slice(0, -1) as Rank, suit: id.slice(-1) as Card["suit"] };
}

// Sepuluh kartu, paling bawah 2C, paling atas JC.
const PILE = ["2C", "3C", "4C", "5C", "6C", "7C", "8C", "9C", "10C", "JC"].map(c);

test("pickable at exactly 7 from top", () => {
  // Index 3 = posisi ke-7 dari atas (10 - 3 = 7).
  const got = pickableFromDiscard({ cards: PILE, closedIndex: null }, PILE[3]);
  expect(got?.length).toBe(7);
  expect(got?.[0].id).toBe("5C");
});

test("pickable at 8 from top is refused", () => {
  expect(pickableFromDiscard({ cards: PILE, closedIndex: null }, PILE[2])).toBeNull();
});

test("pickable refuses below closedIndex", () => {
  expect(pickableFromDiscard({ cards: PILE, closedIndex: 5 }, PILE[4])).toBeNull();
});

test("pickable refuses the closed card itself", () => {
  expect(pickableFromDiscard({ cards: PILE, closedIndex: 5 }, PILE[5])).toBeNull();
});
