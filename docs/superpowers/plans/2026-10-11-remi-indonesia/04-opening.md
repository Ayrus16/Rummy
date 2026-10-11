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

### Task 4: Opening phase and joker determination

**Files:**
- Create: `src/rules/opening.ts`
- Test: `tests/rules/opening.test.ts`

**Interfaces:**
- Consumes: `Card`, `Rank`, `baseValue` (Task 2).
- Produces:
  - `interface OpeningState { stock: Card[]; discard: DiscardPile; jokerRank: Rank | null; penalties: Record<PlayerId, number>; penaltyNote: string | null }`
  - `type PlayerId = 0 | 1 | 2 | 3`
  - `type DiscardPile` is defined in Task 5; in this task, use `Card[]` with index 0 = bottom (oldest) and the last index = top (newest). Mark blocked cards in Task 5. Here blocking is not needed.
  - `openingDiscard(state, player, card): OpeningState` (each player in turn draws 1 from stock and discards 1; forbids a discard whose `rank` equals another player's first-round discard)
  - `resolveJoker(state): OpeningState` (draws a random card from stock as the penentu; the other 3 cards of that rank become jokers; the penentu leaves the game; if any first-round discard has the joker rank, that discarder is penalized 10× and that card is marked closed. Blocking is handled in Task 5 through `closedIndex`.)

- [ ] **Step 1: Write failing tests**

- `first-round discards must differ in rank`: player 1 discards `J`, player 2 tries `J` → throws error `"DUPLICATE_OPENING_RANK"`.
- `penentu is removed and other three of its rank become jokers`: after `resolveJoker`, `jokerRank` equals the penentu rank, the penentu is not in stock, and count of cards of that rank among all cards is 3 (the 4th left the game).
- `joker discarded in opening penalizes discarder`: discarder `player 1` with `10` in opening, jokerRank `"10"` → `penalties[1] === -50` (10× base 5 = 50 for "10"). Use the spec example: 10 has base 5, so penalty is 50.
- `stock has 19 cards after opening`: with 24 at the start, after 4 draws and 1 penentu draw, `stock.length === 19`.

- [ ] **Step 2: Run tests, expect FAIL**

- [ ] **Step 3: Implement** using the spec section "Putaran pertama & penentuan joker". Use injectable RNG for the penentu draw.

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/rules tests/rules && git commit -m "feat: opening round and joker determination"
```


