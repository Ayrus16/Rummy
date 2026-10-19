import { expect, test } from "vitest";
import type { Card, Rank } from "../../src/rules/cards";
import { maskDiscard } from "../../server/view";

function c(id: string): Card {
  return { id, rank: id.slice(0, -1) as Rank, suit: id.slice(-1) as Card["suit"] };
}

test("discarded jokers are shown face down: only the id remains", () => {
  const out = maskDiscard([c("6S"), c("9H"), c("6D")], "6");
  expect(out[0]).toEqual(c("6S") && { id: "6S", hidden: true });
  expect(out[1]).toEqual(c("9H"));
  expect(out[2]).toEqual({ id: "6D", hidden: true });
});
