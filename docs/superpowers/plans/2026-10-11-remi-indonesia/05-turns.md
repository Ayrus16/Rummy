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

### Task 5: Turns: draw, pickup from discard, lay down, discard, closed

**Files:**
- Create: `src/rules/turn.ts`, `src/rules/discard.ts`
- Test: `tests/rules/turn.test.ts`, `tests/rules/discard.test.ts`

**Interfaces:**
- Consumes: `Card`, `classify` (Task 3), `OpeningState` (Task 4).
- Produces:
  - `interface DiscardPile { cards: Card[]; closedIndex: number | null }`. `cards[0]` is the bottom (oldest), last is the top (newest). `closedIndex` marks the joker discard that blocks everything at or below it.
  - `pickableFromDiscard(pile: DiscardPile, target: Card): Card[] | null`. Returns the slice from the target to the top, or null when the target is more than 7 cards from the top, or at or below `closedIndex`.
  - `interface RoundState { hands: Card[][]; stock: Card[]; discard: DiscardPile; jokerRank: Rank | null; turn: PlayerId; laidPureSeri: boolean[]; penalties: number[]; result: RoundResult | null }`
  - `type RoundResult = { closedBy: PlayerId | "stock_empty"; bonus: number; closingCard: Card | null }`
  - `drawFromStock(state, player): RoundState`
  - `pickFromDiscard(state, player, target: Card, meld: Card[]): RoundState` (requires `laidPureSeri[player]` to be true, or `meld` to contain a pure seri laid down this action; `meld` must form a valid combo with at least 2 cards from hand.)
  - `layDownPureSeri(state, player, cards: Card[]): RoundState`
  - `discardCard(state, player, card: Card): RoundState` (if the card is a joker, apply the joker-discard penalty and set `closedIndex` to its index; advance `turn`; if stock is empty after the discard, end the round as `stock_empty`)
  - `checkClosed(state, player): RoundResult | null` (closed when all cards form valid combos except one, which is the closing card; closed from stock gives +250; closed from discard gives +10× closing card base)

- [ ] **Step 1: Write failing tests**

Discard rules (`tests/rules/discard.test.ts`):
- `pickable at exactly 7 from top`: a pile of 10 cards, target at index 3 (7th from top, counting the top as 1) → returns 7 cards.
- `pickable at 8 from top is refused`: target 8th from top → null.
- `pickable refuses below closedIndex`: `closedIndex = 5`, target at index 4 → null.
- `pickable includes the joker closed card itself?`: target equal to `closedIndex` → null (the joker card is blocked for pickup; spec says joker discard is closed).

Turn rules (`tests/rules/turn.test.ts`):
- `draw from stock adds one card to hand`: hand length grows by 1, stock shrinks by 1.
- `pickup needs a pure seri laid down this round`: `laidPureSeri[player] === false` and no seri in the request → throws `"NEED_PURE_SERI"`.
- `first pickup can lay down pure seri and pick in one action`: `layDownPureSeri` plus `pickFromDiscard` in one call sequence with `laidPureSeri` changed correctly.
- `discarding a joker penalizes discarder 10×`: joker base 10 → penalty `-100`; `closedIndex` set to the discard index.
- `closed from stock gives +250`: `checkClosed` after a stock draw leaves exactly one non-combo card → bonus 250.
- `closed from discard gives 10× closing card`: closing card `K` → bonus 100 after a pickup closing.
- `stock empty after discard ends round as stock_empty with no bonus`: `result.bonus === 0`.

- [ ] **Step 2: Run tests, expect FAIL**

- [ ] **Step 3: Implement** the functions above. Each action validates first and throws a named error for each refused action; the state is not mutated on throw.

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/rules tests/rules && git commit -m "feat: turn actions, discard pickup rules, and closed detection"
```


