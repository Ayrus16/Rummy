import { expect, test } from "vitest";
import type { Card, Rank } from "../../src/rules/cards";
import {
  discardCard,
  drawFromStock,
  layDownPureSeri,
  pickFromDiscard,
  type RoundState,
} from "../../src/rules/turn";

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
    ...over,
  };
}

const ids = (cards: Card[]) => cards.map((card) => card.id).sort();

test("draw from stock adds one card to hand and removes it from stock", () => {
  const s = round({ hands: [[c("2H")], [], [], []], stock: [c("2D"), c("3D")] });
  const out = drawFromStock(s, 0);
  expect(out.hands[0].length).toBe(2);
  expect(out.stock.length).toBe(1);
  expect(out.phase).toBe("discard");
  expect(out.drewFrom).toBe("stock");
});

test("pickup needs a pure seri laid down this round", () => {
  const s = round({
    hands: [[c("3H"), c("5H")], [], [], []],
    discard: { cards: [c("AD"), c("4H"), c("9C"), c("2S")], closedIndex: null },
  });
  expect(() => pickFromDiscard(s, 0, c("4H"), [c("3H"), c("5H")])).toThrow("NEED_PURE_SERI");
});

test("lay down pure seri, then pick up from discard in the same turn", () => {
  const s = round({
    hands: [[c("6S"), c("7S"), c("8S"), c("3H"), c("5H"), c("KD"), c("2D")], [], [], []],
    discard: { cards: [c("AD"), c("4H"), c("9C"), c("2S")], closedIndex: null },
  });
  const laid = layDownPureSeri(s, 0, [c("6S"), c("7S"), c("8S")]);
  const out = pickFromDiscard(laid, 0, c("4H"), [c("3H"), c("5H")]);
  expect(ids(out.hands[0])).toEqual(["2D", "2S", "9C", "KD"]);
  expect(out.table[0].length).toBe(2);
  expect(out.discard.cards.map((card) => card.id)).toEqual(["AD"]);
  expect(out.phase).toBe("discard");
  expect(out.drewFrom).toBe("discard");
});

test("wrong player cannot act", () => {
  const s = round({ hands: [[c("2H")], [], [], []], stock: [c("2D")] });
  expect(() => drawFromStock(s, 1)).toThrow("NOT_YOUR_TURN");
});

test("discarding a joker penalizes discarder 10x and closes the pile at that card", () => {
  const s = round({
    hands: [[c("2C"), c("3D"), c("7S"), c("9H"), c("QC"), c("AS"), c("KS"), c("4D")], [], [], []],
    jokerRank: "K",
    phase: "discard",
    drewFrom: "stock",
    discard: { cards: [c("JD")], closedIndex: null },
    stock: [c("2D")],
  });
  const out = discardCard(s, 0, c("KS"));
  expect(out.penalties[0]).toBe(-100);
  expect(out.discard.closedIndex).toBe(1);
});

test("closed from stock gives +250", () => {
  const s = round({
    hands: [[c("3H"), c("4H"), c("5H"), c("8S"), c("8H"), c("8D"), c("8C"), c("KC")], [], [], []],
    phase: "discard",
    drewFrom: "stock",
    stock: [c("2D")],
  });
  const out = discardCard(s, 0, c("KC"));
  expect(out.result).toEqual({ closedBy: 0, bonus: 250, closingCard: c("KC") });
});

test("closed from discard gives 10x the closing card", () => {
  const s = round({
    hands: [[c("3H"), c("4H"), c("5H"), c("8S"), c("8H"), c("8D"), c("8C"), c("KC")], [], [], []],
    phase: "discard",
    drewFrom: "discard",
    stock: [c("2D")],
  });
  const out = discardCard(s, 0, c("KC"));
  expect(out.result?.bonus).toBe(100);
});

test("discard that empties the stock ends the round with no bonus", () => {
  const s = round({
    hands: [[c("2C"), c("3D"), c("7S"), c("9H"), c("QC"), c("AS"), c("4D"), c("6H")], [], [], []],
    phase: "discard",
    drewFrom: "stock",
    stock: [],
  });
  const out = discardCard(s, 0, c("6H"));
  expect(out.result).toEqual({ closedBy: "stock_empty", bonus: 0, closingCard: null });
});
