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

### Task 8: Realtime room server with per-player views and disconnect handling

**Files:**
- Create: `server/room.ts`, `server/index.ts`, `server/view.ts`
- Test: `tests/server/room.test.ts`

**Interfaces:**
- Consumes: rules modules from Tasks 2–7.
- Produces:
  - `createRoom(seats: [string, string, string, string], options: { target: number; disconnectTimeoutMs: number })` (seats are Discord user ids; exactly 4 required)
  - `Room.handle(seatIndex, intent)` where `intent` is one of `draw_stock`, `pickup`, `lay_down`, `discard`, and returns the updated view per player.
  - `viewFor(room, seatIndex)`: returns the filtered state. Other players' hands are replaced with counts; stock contains only its size; the discard pile is public.
  - Disconnect: `Room.onDisconnect(seat)` pauses the round and starts a timer of `disconnectTimeoutMs`. If the seat reconnects in time, play resumes. If not, the room is cancelled (state set to `cancelled`).

- [ ] **Step 1: Write failing tests**

- `viewFor hides other hands`: seat 0's view has `hands[0]` as cards and `hands[1..3]` as counts only (`handCounts`).
- `viewFor hides stock contents`: view shows `stockCount` only.
- `out-of-turn intent is refused`: seat 2 sends `draw_stock` when turn is 0 → error `"NOT_YOUR_TURN"`.
- `disconnect pauses the round`: after `onDisconnect(1)`, intents from other seats return `"PAUSED"`.
- `reconnect within timeout resumes`: `onReconnect(1)` before timeout → state is `playing`.
- `timeout cancels the session`: fake timers, advance past `disconnectTimeoutMs` → state is `cancelled`.

- [ ] **Step 2: Run tests, expect FAIL**

- [ ] **Step 3: Implement** the room with a Socket.IO adapter in `server/index.ts`. Use fake timers in tests. Seats come from the Discord voice channel members at room creation; the server rejects a 5th join.

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add server tests/server && git commit -m "feat: realtime room with filtered views and disconnect handling"
```


