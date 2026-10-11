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

### Task 7: Session: target score and overtake reset

**Files:**
- Create: `src/rules/session.ts`
- Test: `tests/rules/session.test.ts`

**Interfaces:**
- Consumes: `scoreRound` (Task 6).
- Produces:
  - `interface SessionState { totals: number[]; target: number; rounds: number; winner: PlayerId | null }`
  - `applyRound(state: SessionState, roundScores: number[]): SessionState` (adds scores, then applies the overtake reset, then checks the target; `winner` is the player with the highest total among those at or above target; ties on top mean `winner` is the higher one, and exact equal totals are not resolved specially)
- `nextFirstPlayer(totals: number[]): PlayerId` (highest total goes first; equal totals go to the lower seat index; used by Task 8 to set `turn` at the start of each round after the first)
  - Overtake reset: a player whose total was higher before the round and is now lower than another player's total is set to 0. Equal totals never reset. A player with a negative total who is overtaken does not reset.

- [ ] **Step 1: Write failing tests**

- `overtaken player resets to 0`: before totals A=300, B=250; round scores `[0, 100]` → before reset `[300, 350]`, after reset `[0, 350]` (A was ahead and is now behind B, so A resets).
- `equal totals do not reset`: before A 300, B 300; round makes B 310 → A is overtaken, so reset applies? Keep precise: only players who were ahead before and are now behind after reset; equal before means not "ahead", so no reset. Test: before A=B=300, round A+0, B+10 → A is behind but was not ahead before → no reset; totals `[300, 310]`.
- `negative overtaken player does not reset`: before A = −50 ahead of B = −100; round B +100 → B is now 0, A is −50 and is now behind → A is not reset because A's total is negative.
- `next first player is the highest total`: totals `[300, 350, 100, 350]` → `nextFirstPlayer` returns `1` (equal 350 goes to the lower seat).
- `winner is first over target, highest total wins ties of crossing`: two players both at 1010 after the round → winner is the one with 1010 vs 1005; exact equal 1010/1010 → not resolved (test skipped: spec says it's the higher score; equal is undefined) — leave as TODO comment; do not write this assert.

- [ ] **Step 2: Run tests, expect FAIL**

- [ ] **Step 3: Implement** `applyRound` per the spec's "Sesi & aturan tersalip". Compare order before and after the round.

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/rules tests/rules && git commit -m "feat: session totals, overtake reset, and winner"
```


