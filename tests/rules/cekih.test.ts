import { expect, test } from "vitest";
import type { Card, Rank } from "../../src/rules/cards";
import { callCekih, canCallCekih, cancelCekih } from "../../src/rules/cekih";
import { discardCard, pickFromDiscard, type RoundState } from "../../src/rules/turn";

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
    phase: "draw",
    drewFrom: null,
    laidPureSeri: [false, false, false, false],
    table: [[], [], [], []],
    penalties: [0, 0, 0, 0],
    result: null,
    cekih: [],
    discardOwner: {},
    pickedFromDiscard: [false, false, false, false],
    takenOwners: [],
    ...over,
  };
}

const READY = ["2H", "3H", "4H", "9S", "9C", "9D", "8H", "8S"].map(c);

test("hand one card short of closing can call cekih", () => {
  // 2H 3H 4H, 9S 9C 9D, 8H 8S. Satu 8 lagi (8C) membuat tangan bisa dibentuk seluruhnya.
  const hand = ["2H", "3H", "4H", "9S", "9C", "9D", "8H", "8S"].map(c);
  expect(canCallCekih(hand, null)).toBe(true);
});

test("hand far from closing cannot call cekih", () => {
  const hand = ["2H", "7C", "KD", "AS", "5D", "9S", "3C", "QH"].map(c);
  expect(canCallCekih(hand, null)).toBe(false);
});

test("caller who is one card short can call cekih to another player", () => {
  const out = callCekih(round({ hands: [READY, [], [], []] }), 0, 2);
  expect(out.cekih).toEqual([{ caller: 0, target: 2 }]);
});

test("calling cekih to yourself is refused", () => {
  expect(() => callCekih(round({ hands: [READY, [], [], []] }), 0, 0)).toThrow("CEKIH_SELF");
});

test("calling cekih when the hand is far from closing is refused", () => {
  const far = ["2H", "7C", "KD", "AS", "5D", "9S", "3C", "QH"].map(c);
  expect(() => callCekih(round({ hands: [far, [], [], []] }), 0, 2)).toThrow("CEKIH_NOT_ALLOWED");
});

test("cancelling removes the cekih so it can be called again", () => {
  const start = round({ hands: [READY, [], [], []], cekih: [{ caller: 0, target: 2 }] });
  const out = cancelCekih(start, 0, 2);
  expect(out.cekih).toEqual([]);
  expect(callCekih(out, 0, 2).cekih).toEqual([{ caller: 0, target: 2 }]);
});

test("cancelling a cekih that does not exist is refused", () => {
  expect(() => cancelCekih(round(), 0, 2)).toThrow("CEKIH_NOT_FOUND");
});
