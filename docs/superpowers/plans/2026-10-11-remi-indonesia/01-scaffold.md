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

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `app/layout.tsx`, `app/page.tsx`, `server/index.ts`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs Vitest; `npm run dev` starts Next.js; `npm run server` starts the Socket.IO server on port 4000.

- [ ] **Step 1: Initialize git and the Next.js TypeScript app**

Run: `git init && npx create-next-app@latest . --ts --app --eslint --no-tailwind --src-dir=false --import-alias "@/*"`
Expected: the app is created and `npm run build` succeeds.

- [ ] **Step 2: Add Vitest, Socket.IO, and their scripts**

Run: `npm i -D vitest && npm i socket.io socket.io-client`. Add `"test": "vitest run"` and `"server": "tsx server/index.ts"` (add `tsx` as a dev dependency).
Expected: `npm test` reports "no test files" (exit code may be non-zero; that is fine until Step 3).

- [ ] **Step 3: Write and run a smoke test**

```ts
// tests/smoke.test.ts
import { expect, test } from "vitest";
test("runner works", () => expect(1 + 1).toBe(2));
```

Run: `npm test`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js, Vitest, and Socket.IO"
```


