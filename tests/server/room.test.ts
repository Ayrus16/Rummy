import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createRoom, type Room } from "../../server/room";
import { viewFor } from "../../server/view";

const TIMEOUT_MS = 60_000;

function newRoom(): Room {
  // rng konstan membuat kocokan deterministik, jadi tes tidak bergantung pada urutan acak.
  return createRoom(["u0", "u1", "u2", "u3"], {
    target: 1000,
    disconnectTimeoutMs: TIMEOUT_MS,
    rng: () => 0,
  });
}

// Mainkan seluruh pembukaan: tiap pemain mengambil lalu membuang kartu dengan angka unik.
function playOpening(room: Room): void {
  for (let seat = 0; seat < 4; seat++) {
    const p = seat as 0 | 1 | 2 | 3;
    room.handle(p, { type: "opening_draw" });
    const board = room.board()!;
    const used = new Set(board.discard.cards.map((card) => card.rank));
    const pick = viewFor(room, p).hand.find((card) => !used.has(card.rank))!;
    room.handle(p, { type: "opening_discard", cardId: pick.id });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("viewFor hides other hands", () => {
  const room = newRoom();
  const view = viewFor(room, 0);
  expect(view.hand.length).toBe(7);
  expect(view.hand.every((card) => typeof card.id === "string")).toBe(true);
  expect(view.handCounts).toEqual([7, 7, 7, 7]);
});

test("viewFor hides stock contents", () => {
  const room = newRoom();
  const view = viewFor(room, 0);
  expect(view.board!.stockCount).toBe(24);
  expect(view.board).not.toHaveProperty("stock");
});

test("out-of-turn intent is refused", () => {
  const room = newRoom();
  expect(() => room.handle(2, { type: "opening_draw" })).toThrow("NOT_YOUR_TURN");
});

test("unknown card id is refused", () => {
  const room = newRoom();
  room.handle(0, { type: "opening_draw" });
  expect(() => room.handle(0, { type: "opening_discard", cardId: "ZZ" })).toThrow("CARD_NOT_IN_HAND");
});

test("disconnect pauses the round", () => {
  const room = newRoom();
  room.onDisconnect(1);
  expect(room.status).toBe("paused");
  expect(() => room.handle(0, { type: "opening_draw" })).toThrow("PAUSED");
});

test("reconnect within timeout resumes", () => {
  const room = newRoom();
  room.onDisconnect(1);
  vi.advanceTimersByTime(TIMEOUT_MS - 1000);
  room.onReconnect(1);
  expect(room.status).toBe("opening");
  expect(() => room.handle(0, { type: "opening_draw" })).not.toThrow();
});

test("timeout cancels the session", () => {
  const room = newRoom();
  room.onDisconnect(1);
  vi.advanceTimersByTime(TIMEOUT_MS);
  expect(room.status).toBe("cancelled");
  expect(() => room.handle(0, { type: "opening_draw" })).toThrow("ROOM_CLOSED");
});

test("finished opening starts play with the first player", () => {
  const room = newRoom();
  playOpening(room);
  expect(room.status).toBe("playing");
  expect(room.board()!.turn).toBe(0);
  expect(room.board()!.phase).toBe("draw");
});

test("onChange is called after each accepted intent", () => {
  let changes = 0;
  const room = createRoom(["u0", "u1", "u2", "u3"], {
    target: 1000,
    disconnectTimeoutMs: TIMEOUT_MS,
    rng: () => 0,
    onChange: () => changes++,
  });
  room.handle(0, { type: "opening_draw" });
  expect(changes).toBe(1);
});

function botRoom(): Room {
  return createRoom(["u0", "bot:1", "bot:2", "bot:3"], {
    target: 1000,
    disconnectTimeoutMs: TIMEOUT_MS,
    rng: () => 0,
    botDelayMs: 10,
  });
}

test("bots complete the opening after the human", () => {
  const room = botRoom();
  room.handle(0, { type: "opening_draw" });
  const card = viewFor(room, 0).hand[0];
  room.handle(0, { type: "opening_discard", cardId: card.id });
  vi.advanceTimersByTime(1000);
  expect(room.status).toBe("playing");
  expect(room.board()!.turn).toBe(0);
});

// Bot hanya ambil dari cangkulan dan tidak pernah turun ke meja, jadi skornya tidak pernah
// mencapai target. Tes ini memastikan ronde terus berjalan (tidak macet), bukan sampai ada pemenang.
test("an all-bot room keeps playing rounds without stalling", () => {
  const room = createRoom(["bot:1", "bot:2", "bot:3", "bot:4"], {
    target: 300,
    disconnectTimeoutMs: TIMEOUT_MS,
    rng: () => 0.5,
    botDelayMs: 1,
  });
  for (let step = 0; step < 20_000; step++) {
    if (!vi.advanceTimersToNextTimer()) break;
  }
  expect(room.status).toBe("playing");
  expect(room.session.rounds).toBeGreaterThan(10);
});

test("bots take their turns and hand the turn back", () => {
  const room = botRoom();
  room.handle(0, { type: "opening_draw" });
  room.handle(0, { type: "opening_discard", cardId: viewFor(room, 0).hand[0].id });
  vi.advanceTimersByTime(1000);
  room.handle(0, { type: "draw_stock" });
  room.handle(0, { type: "discard", cardId: viewFor(room, 0).hand[0].id });
  vi.advanceTimersByTime(1000);
  expect(room.board()!.turn).toBe(0);
  expect(room.board()!.phase).toBe("draw");
});
