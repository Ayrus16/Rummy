import { expect, test } from "vitest";
import { baseValue, makeDeck, shuffle } from "../../src/rules/cards";
import { deal } from "../../src/rules/deal";

test("makeDeck has 52 unique cards", () => {
  const ids = makeDeck().map((c) => c.id);
  expect(new Set(ids).size).toBe(52);
});

test("baseValue: 2..10 = 5, J/Q/K = 10, A = 15", () => {
  expect(baseValue("2")).toBe(5);
  expect(baseValue("10")).toBe(5);
  expect(baseValue("K")).toBe(10);
  expect(baseValue("A")).toBe(15);
});

test("shuffle does not mutate input and keeps all cards", () => {
  const deck = makeDeck();
  const before = deck.map((c) => c.id);
  const shuffled = shuffle(deck, () => 0.5);
  expect(deck.map((c) => c.id)).toEqual(before);
  expect(shuffled.map((c) => c.id).sort()).toEqual([...before].sort());
});

test("deal gives 4 hands of 7 and a stock of 24", () => {
  const { hands, stock } = deal(shuffle(makeDeck(), () => 0.3));
  expect(hands.length).toBe(4);
  for (const hand of hands) expect(hand.length).toBe(7);
  expect(stock.length).toBe(24);
  const ids = [...hands.flat(), ...stock].map((c) => c.id);
  expect(new Set(ids).size).toBe(52);
});
