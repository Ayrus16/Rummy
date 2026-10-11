import { expect, test } from "vitest";
import type { Card, Rank } from "../../src/rules/cards";
import { scoreRound } from "../../src/rules/scoring";
import type { RoundState } from "../../src/rules/turn";

function c(id: string): Card {
  return { id, rank: id.slice(0, -1) as Rank, suit: id.slice(-1) as Card["suit"] };
}

function round(over: Partial<RoundState> = {}): RoundState {
  return {
    hands: [[], [], [], []],
    stock: [],
    discard: { cards: [], closedIndex: null },
    jokerRank: null,
    turn: 0,
    phase: "discard",
    drewFrom: null,
    laidPureSeri: [false, false, false, false],
    table: [[], [], [], []],
    penalties: [0, 0, 0, 0],
    result: null,
    ...over,
  };
}

test("valid cards add base value", () => {
  // Seri 3H 4H 5H di meja: 5 + 5 + 5 = 15.
  const s = round({ table: [[[c("3H"), c("4H"), c("5H")]], [], [], []] });
  expect(scoreRound(s)[0]).toBe(15);
});

test("non-combo cards subtract base value", () => {
  const s = round({ hands: [[c("KS")], [], [], []] });
  expect(scoreRound(s)[0]).toBe(-10);
});

test("joker in combo counts as the card it replaces", () => {
  // Seri 4H 5H + joker (berdiri untuk 6): 5 + 5 + 5 = 15.
  const s = round({ hands: [[c("4H"), c("5H"), c("6D")], [], [], []], jokerRank: "6" });
  expect(scoreRound(s)[0]).toBe(15);
});

test("leftover joker in hand is minus 10x", () => {
  const s = round({ hands: [[c("KS")], [], [], []], jokerRank: "K" });
  expect(scoreRound(s)[0]).toBe(-100);
});

test("closed bonus is added to the closer only", () => {
  const s = round({ result: { closedBy: 2, bonus: 250, closingCard: c("KC") } });
  expect(scoreRound(s)).toEqual([0, 0, 250, 0]);
});

test("score may be negative", () => {
  const s = round({ hands: [[c("2C"), c("3D")], [], [], []] });
  expect(scoreRound(s)[0]).toBe(-10);
});

test("round penalties are included", () => {
  const s = round({ penalties: [-50, 0, 0, 0] });
  expect(scoreRound(s)[0]).toBe(-50);
});
