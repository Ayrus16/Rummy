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

## Daftar task

- [Task 1: Project scaffold](01-scaffold.md)
- [Task 2: Cards, deck, shuffle, and deal](02-cards.md)
- [Task 3: Combination validation (seri, tris, seri murni, joker)](03-combos.md)
- [Task 4: Opening phase and joker determination](04-opening.md)
- [Task 5: Turns: draw, pickup from discard, lay down, discard, closed](05-turns.md)
- [Task 6: Round scoring](06-scoring.md)
- [Task 7: Session: target score and overtake reset](07-session.md)
- [Task 8: Realtime room server with per-player views and disconnect handling](08-room-server.md)
- [Task 9: Discord Activity client](09-discord-client.md)

## Self-Review Notes

- **Spec coverage:** rules (Tasks 2–7), per-player hidden hands and sessions (Task 8), Discord integration (Task 9). Non-goals (no bots, no spectators) are respected.
- **Review Focus coverage:** each of the five lines has a test: pickup at 7 and joker block (Task 5), joker opening discard (Task 4), three-joker tris (Task 3), tie and negative reset (Task 7), disconnect and cancel (Task 8).
- **Type consistency:** `Card`, `Rank`, `PlayerId`, `DiscardPile`, `RoundState`, `SessionState` are defined once in the tasks that produce them and used by name afterwards.
- **Known gap:** Task 9 depends on Discord's current SDK, which this plan has not verified. Step 1 handles that.
