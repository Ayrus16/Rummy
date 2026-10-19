import { expect, test } from "vitest";
import type { Card, Rank } from "../../src/rules/cards";
import { canPartition } from "../../src/rules/partition";

function c(id: string): Card {
  return { id, rank: id.slice(0, -1) as Rank, suit: id.slice(-1) as Card["suit"] };
}

test("cards that form melds can be partitioned", () => {
  expect(canPartition(["2H", "3H", "4H", "9S", "9C", "9D"].map(c), null)).toBe(true);
});

test("a leftover card cannot be partitioned", () => {
  expect(canPartition(["2H", "3H", "4H", "KS"].map(c), null)).toBe(false);
});
