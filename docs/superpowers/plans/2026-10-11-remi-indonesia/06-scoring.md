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

### Task 6: Round scoring

**Files:**
- Create: `src/rules/scoring.ts`
- Test: `tests/rules/scoring.test.ts`

**Interfaces:**
- Consumes: `RoundState`, `RoundResult`, `classify`, `baseValue`.
- Produces:
  - `scoreRound(state: RoundState, melds: Record<PlayerId, Card[][]>): number[]` (returns score per player for this round)
  - Melds are the combos each player has on the table or kept in hand, as the caller tracks them. Kept-in-hand combos are provided by the caller from `RoundState`.

- [ ] **Step 1: Write failing tests**

- `valid cards add base value`: a player with one seri `3H 4H 5H` (value 15) and nothing else → score +15 for that combo.
- `non-combo cards subtract base value`: `K` alone in hand → −10.
- `joker in combo counts as the card it replaces`: seri `4H 5H` plus a joker standing for 6 → 5 + 5 + 5 = 15, since 6 has base value 5.
- `leftover joker in hand is −10×`: joker of rank K left in hand → −100.
- `closed bonus is added to the closer only`: closer gets +250, others don't get it.
- `score may be negative`: player with only non-combo cards → negative total.

- [ ] **Step 2: Run tests, expect FAIL**

- [ ] **Step 3: Implement** using the spec "Perhitungan skor ronde". Base values: 2–10 = 5, J/Q/K = 10, As = 15, joker takes the value of the card it replaces. Ensure penalties from discard jokers are included.

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/rules tests/rules && git commit -m "feat: round scoring"
```


