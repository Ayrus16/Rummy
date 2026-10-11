# Remi Indonesia Discord Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Remi Indonesia for 4 players as a Discord Activity, with server-authoritative rules, realtime sync, and per-player hidden hands.

**Architecture:** A pure TypeScript rules engine (no I/O) holds all game logic and is tested on its own. A Node server (Socket.IO) wraps the engine, keeps sessions in memory, and sends each player only their filtered view. A Next.js client runs inside the Discord Activity iframe and only sends intents.

**Tech Stack:** TypeScript, Next.js (App Router), Socket.IO (server and client), Vitest, Discord Embedded App SDK (verify auth and Activity setup against Discord's official docs before Task 8).

**Spec:** `docs/superpowers/specs/2026-10-11-remi-indonesia-design.md`, with full rules in `Spesifikasi Aturan Remi Indonesia.md`.

**Git:** Task 1 runs `git init`. All commit steps assume that repo.

## Global Constraints

- Exactly 4 players per session.
- One 52-card deck, no printed jokers.
- Deal 7 cards per player; 24 cards form the stock (cangkulan).
- Card base values: 2–10 = 5, J/Q/K = 10, As = 15. Bonus value is 10× base (50 / 100 / 150).
- Target score default 1000.
- Closed bonus: +250 when closed from stock; +10× penutup value when closed from discard.
- Joker discard penalty: discarder loses 10× joker base value.
- Joker left in hand at round end: −10× its base value.
- Disconnect wait: 60 seconds by default, configurable.
- Score may go negative. Overtaken players reset to 0 (equal scores do not reset; negative overtaken players do not reset).

## Review Focus

1. Stock draw with a discard pickup at exactly the 7th card from the top, and with a blocked joker in the path (must be refused).
2. Joker discarded in the first round: the discard pile before it becomes unpickable, and the other first-round discards keep their order.
3. Three jokers of rank X never form a tris by themselves (player holds all three, no real card).
4. Tie at session end and overtake-reset with equal scores (no reset) and negative totals (no reset).
5. A player disconnects during their turn, and the room goes to wait state. A player who never returns causes the session to cancel rather than hang.

Each line gets its test in the owning task below.

---

### Task 2: Cards, deck, shuffle, and deal

**Files:**
- Create: `src/rules/cards.ts`, `src/rules/deal.ts`
- Test: `tests/rules/cards.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Suit = "S" | "H" | "D" | "C"`; `type Rank = "A" | "2" | … | "10" | "J" | "Q" | "K"`
  - `interface Card { id: string; rank: Rank; suit: Suit }` (id is unique per card, for example `"10H"`)
  - `baseValue(rank: Rank): number` (5 / 10 / 15 as in Global Constraints)
  - `makeDeck(): Card[]` (52 cards, all unique)
  - `shuffle(cards: Card[], rng: () => number): Card[]` (Fisher-Yates; pure, returns a new array)
  - `deal(deck: Card[]): { hands: Card[][]; stock: Card[] }` (4 hands of 7, stock of 24, in that order from the top)

- [ ] **Step 1: Write failing tests**

Test names and assertions:
- `makeDeck has 52 unique cards`: `new Set(makeDeck().map(c => c.id)).size === 52`.
- `baseValue: 2..10 = 5, J/Q/K = 10, A = 15`: check `baseValue("2") === 5`, `baseValue("10") === 5`, `baseValue("K") === 10`, `baseValue("A") === 15`.
- `shuffle does not mutate input and keeps all cards`: deterministic `rng = () => 0.5`; original array unchanged; same multiset of ids.
- `deal gives 4×7 and 24 stock`: `hands.length === 4`, each hand length 7, `stock.length === 24`, all 52 ids distinct.

- [ ] **Step 2: Run tests, expect FAIL** (`npx vitest run tests/rules/cards.test.ts`)

- [ ] **Step 3: Implement** the interfaces above in `src/rules/cards.ts` and `src/rules/deal.ts`. Card `id` is built as `rank + suit`.

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/rules tests/rules && git commit -m "feat: card model, shuffle, and deal"
```


