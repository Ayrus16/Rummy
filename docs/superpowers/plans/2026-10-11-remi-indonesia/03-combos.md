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

### Task 3: Combination validation (seri, tris, seri murni, joker)

**Files:**
- Create: `src/rules/combos.ts`
- Test: `tests/rules/combos.test.ts`

**Interfaces:**
- Consumes: `Card`, `Rank`, `Suit`, `baseValue` from Task 2.
- Produces:
  - `interface Joker { rank: Rank }` (rank of the joker-making card; joker cards are identified by `rank === jokerRank`)
  - `type ComboKind = "seri" | "tris" | "invalid"`
  - `classify(cards: Card[], jokerRank: Rank | null): { kind: ComboKind; pure: boolean; values: number[] }`
    - `pure`: true only for a seri with no joker, or a tris of As with no joker.
    - `values`: effective base value per card (a joker takes the value of the card it replaces). Used for scoring in Task 6.

- [ ] **Step 1: Write failing tests**

- `seri 3-4-5 same suit is valid and pure`: `classify([3H,4H,5H], null)` → `kind "seri", pure true`.
- `seri across ranges is invalid`: `9C 10C JC` → `invalid`.
- `As cannot be in a seri`: `Q♦ K♦ A♦` → `invalid`.
- `tris of 8s is valid, not pure`: `8S 8H 8D` with `jokerRank: "5"` → `kind "tris", pure false`.
- `tris of As with no joker is pure`: `AS AH AD` with `jokerRank: null` → `pure true`.
- `tris of Ks is never pure`: `KS KH KD` with `jokerRank: null` → `pure false`.
- `joker fills a seri gap`: `4H 5H 6D` with jokerRank `"6"` → `kind "seri"`, `pure false`, and the joker's entry in `values` is 5 (the base value of the 6 it replaces).
- `joker cannot be used as its own real card`: a real `5H` when jokerRank is `"5"` is treated as the joker, so `4H 5H 6H` with jokerRank `"5"` → the `5H` counts as a joker slot, and the result is `seri` with `pure false`.
- `three jokers of one rank cannot form a tris`: `10S 10H 10D` with `jokerRank "10"` → `invalid`.

- [ ] **Step 2: Run tests, expect FAIL**

- [ ] **Step 3: Implement `classify`.** The rule checks are in the spec sections "Kombinasi" and "Joker". The joker-only-tris exclusion is a rule, not an edge case. Pick the approach: normalize joker cards first, then check seri (same suit, consecutive in one range, length 3–4) or tris (same rank, length 3–4, at least one non-joker card).

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/rules tests/rules && git commit -m "feat: seri and tris validation with jokers"
```


