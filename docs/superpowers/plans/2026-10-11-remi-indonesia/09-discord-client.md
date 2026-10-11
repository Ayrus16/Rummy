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

### Task 9: Discord Activity client

**Files:**
- Create: `app/activity/page.tsx`, `app/activity/Table.tsx`, `src/client/socket.ts`, `src/client/discord.ts`
- Test: manual check via the Discord developer portal (no automated test for the iframe in v1)

**Interfaces:**
- Consumes: `viewFor` shape from Task 8, Socket.IO events from `server/index.ts`.
- Produces: a page that initializes the Discord Embedded App SDK, joins the room for the current voice channel, and renders the table. The client sends only intents.

- [ ] **Step 1: Verify the Discord Embedded App SDK auth flow against Discord's official docs.** Record the exact package name and version in `package.json`. This step is required before writing code, since the auth steps are not verified in this plan.

- [ ] **Step 2: Implement `src/client/discord.ts`** to initialize the SDK and return the channel id and the current user id.

- [ ] **Step 3: Implement `src/client/socket.ts`** to connect to the server and join the room keyed by the channel id.

- [ ] **Step 4: Implement `Table.tsx`** to render your hand, the discard pile (public), stock count, opponent hand counts, and the action buttons (draw stock, pickup, lay down, discard). The page only shows actions that are valid for the current turn.

- [ ] **Step 5: Manual check.** Run `npm run dev` and `npm run server`, open the Activity in Discord with four accounts in a voice channel, and play one full round. Expected: all four see the same discard pile and see only their own hand.

- [ ] **Step 6: Commit**

```bash
git add app src/client && git commit -m "feat: Discord Activity client table"
```


