import { expect, test } from "vitest";
import type { Card, Rank } from "../../src/rules/cards";
import { canCallCekih } from "../../src/rules/cekih";

function c(id: string): Card {
  return { id, rank: id.slice(0, -1) as Rank, suit: id.slice(-1) as Card["suit"] };
}

test("hand one card short of closing can call cekih", () => {
  // 2H 3H 4H, 9S 9C 9D, 8H 8S. Satu 8 lagi (8C) membuat tangan bisa dibentuk seluruhnya.
  const hand = ["2H", "3H", "4H", "9S", "9C", "9D", "8H", "8S"].map(c);
  expect(canCallCekih(hand, null)).toBe(true);
});

test("hand far from closing cannot call cekih", () => {
  const hand = ["2H", "7C", "KD", "AS", "5D", "9S", "3C", "QH"].map(c);
  expect(canCallCekih(hand, null)).toBe(false);
});
