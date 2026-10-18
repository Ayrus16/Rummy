import { baseValue, makeDeck, shuffle, type Card, type Rank } from "../src/rules/cards";
import { HAND_SIZE, deal } from "../src/rules/deal";
import {
  openingDiscard,
  openingDraw,
  resolveJoker,
  type DiscardPile,
  type OpeningState,
  type PlayerId,
} from "../src/rules/opening";
import { scoreRound } from "../src/rules/scoring";
import { applyRound, nextFirstPlayer, type SessionState } from "../src/rules/session";
import {
  discardCard,
  drawFromStock,
  layDownPureSeri,
  pickFromDiscard,
  type RoundResult,
  type RoundState,
} from "../src/rules/turn";

// Intent memakai ID kartu, bukan objek kartu. Server mencari kartu dari tangan dan
// buangan miliknya sendiri, jadi klien tidak bisa memalsukan rank atau bunga.
export type Intent =
  | { type: "opening_draw" }
  | { type: "opening_discard"; cardId: string }
  | { type: "draw_stock" }
  | { type: "pickup"; targetId: string; handIds: string[] }
  | { type: "lay_down"; cardIds: string[] }
  | { type: "discard"; cardId: string };

export type RoomStatus = "opening" | "playing" | "paused" | "cancelled" | "finished";

// Kursi dengan ID berawalan ini dikendalikan server (bot), bukan oleh pemain.
export const BOT_PREFIX = "bot:";

export interface RoomOptions {
  target: number;
  disconnectTimeoutMs: number;
  // Pemain dianggap pergi jika tidak melakukan permintaan selama ini.
  presenceMs: number;
  rng?: () => number;
  now?: () => number;
  botDelayMs?: number;
}

// Seluruh state ruang dalam bentuk JSON. Disimpan di antara request karena serverless tidak menyimpan memori.
export interface RoomSnapshot {
  seats: string[];
  status: RoomStatus;
  session: SessionState;
  lastRoundScores: number[] | null;
  pausedSeat: PlayerId | null;
  pausedAt: number | null;
  resumeStatus: RoomStatus;
  firstPlayer: PlayerId;
  opening: OpeningState | null;
  round: RoundState | null;
  botDueAt: number | null;
  lastSeen: (number | null)[];
}

// Papan ronde yang sedang berjalan, atau fase pembukaan (jika ronde belum mulai main).
export interface Board {
  hands: Card[][];
  stock: Card[];
  discard: DiscardPile;
  jokerRank: Rank | null;
  penalties: number[];
  table: Card[][][];
  laidPureSeri: boolean[];
  turn: PlayerId;
  phase: "opening" | "draw" | "discard";
  drewFrom: "stock" | "discard" | null;
  result: RoundResult | null;
}

// Batas langkah bot per request. Bot hanya jalan saat jatuh tempo, jadi ini sekadar pengaman.
const MAX_BOT_STEPS_PER_TICK = 50;

export class Room {
  status: RoomStatus = "opening";
  session: SessionState;
  lastRoundScores: number[] | null = null;
  pausedSeat: PlayerId | null = null;

  private readonly rng: () => number;
  private readonly now: () => number;
  private firstPlayer: PlayerId = 0;
  private opening: OpeningState | null = null;
  private round: RoundState | null = null;
  private resumeStatus: RoomStatus = "opening";
  private pausedAt: number | null = null;
  private botDueAt: number | null = null;
  private lastSeen: (number | null)[] = [null, null, null, null];

  constructor(
    readonly seats: string[],
    private readonly options: RoomOptions,
  ) {
    if (seats.length !== 4) throw new Error("BAD_SEAT_COUNT");
    this.rng = options.rng ?? Math.random;
    this.now = options.now ?? Date.now;
    this.session = { totals: [0, 0, 0, 0], target: options.target, rounds: 0, winner: null };
    this.opening = this.newOpening();
    this.scheduleBot();
  }

  static restore(snapshot: RoomSnapshot, options: RoomOptions): Room {
    const room = new Room(snapshot.seats, options);
    room.status = snapshot.status;
    room.session = snapshot.session;
    room.lastRoundScores = snapshot.lastRoundScores;
    room.pausedSeat = snapshot.pausedSeat;
    room.pausedAt = snapshot.pausedAt;
    room.resumeStatus = snapshot.resumeStatus;
    room.firstPlayer = snapshot.firstPlayer;
    room.opening = snapshot.opening;
    room.round = snapshot.round;
    room.botDueAt = snapshot.botDueAt;
    room.lastSeen = snapshot.lastSeen;
    return room;
  }

  snapshot(): RoomSnapshot {
    return {
      seats: [...this.seats],
      status: this.status,
      session: this.session,
      lastRoundScores: this.lastRoundScores,
      pausedSeat: this.pausedSeat,
      pausedAt: this.pausedAt,
      resumeStatus: this.resumeStatus,
      firstPlayer: this.firstPlayer,
      opening: this.opening,
      round: this.round,
      botDueAt: this.botDueAt,
      lastSeen: [...this.lastSeen],
    };
  }

  // Dipanggil di setiap request sebelum tindakan: jalankan bot yang sudah jatuh tempo,
  // tandai pemain yang tidak terlihat sebagai terputus, dan batalkan sesi jika terlalu lama terputus.
  tick(): void {
    const now = this.now();
    if (this.status === "paused" && this.pausedAt !== null && now - this.pausedAt >= this.options.disconnectTimeoutMs) {
      this.cancel();
      return;
    }
    if (this.status === "opening" || this.status === "playing") {
      const stale = this.seats.findIndex((seat, i) => {
        const last = this.lastSeen[i];
        return !seat.startsWith(BOT_PREFIX) && last !== null && now - last > this.options.presenceMs;
      });
      if (stale !== -1) this.pause(stale as PlayerId, now);
    }
    for (let i = 0; i < MAX_BOT_STEPS_PER_TICK && this.botDueAt !== null && this.botDueAt <= now; i++) {
      this.botDueAt = null;
      this.botAct();
    }
  }

  // Setiap request dari pemain mencatat bahwa ia masih ada. Jika ruang sedang terjeda karena pemain ini, ruang lanjut.
  touch(seat: PlayerId): void {
    this.lastSeen[seat] = this.now();
    if (this.status === "paused" && seat === this.pausedSeat) this.resume();
  }

  handle(seat: PlayerId, intent: Intent): void {
    if (this.status === "paused") throw new Error("PAUSED");
    if (this.status === "cancelled" || this.status === "finished") throw new Error("ROOM_CLOSED");
    if (this.status === "opening") this.handleOpening(seat, intent);
    else this.handlePlay(seat, intent);
    this.scheduleBot();
  }

  board(): Board | null {
    if (this.round !== null) {
      const r = this.round;
      return {
        hands: r.hands,
        stock: r.stock,
        discard: r.discard,
        jokerRank: r.jokerRank,
        penalties: r.penalties,
        table: r.table,
        laidPureSeri: r.laidPureSeri,
        turn: r.turn,
        phase: r.phase,
        drewFrom: r.drewFrom,
        result: r.result,
      };
    }
    if (this.opening === null) return null;
    const o = this.opening;
    return {
      hands: o.hands,
      stock: o.stock,
      discard: o.discard,
      jokerRank: null,
      penalties: o.penalties,
      table: [[], [], [], []],
      laidPureSeri: [false, false, false, false],
      turn: this.openingOrder()[o.discard.cards.length],
      phase: "opening",
      drewFrom: null,
      result: null,
    };
  }

  private pause(seat: PlayerId, now: number): void {
    this.resumeStatus = this.status;
    this.status = "paused";
    this.pausedSeat = seat;
    this.pausedAt = now;
    this.botDueAt = null;
  }

  private resume(): void {
    this.status = this.resumeStatus;
    this.pausedSeat = null;
    this.pausedAt = null;
    this.scheduleBot();
  }

  private cancel(): void {
    this.status = "cancelled";
    this.botDueAt = null;
  }

  private handleOpening(seat: PlayerId, intent: Intent): void {
    const opening = this.opening!;
    if (intent.type === "opening_draw") {
      this.expectOpeningSeat(seat);
      this.opening = openingDraw(opening, seat);
    } else if (intent.type === "opening_discard") {
      this.expectOpeningSeat(seat);
      const card = findCard(opening.hands[seat], intent.cardId);
      this.opening = openingDiscard(opening, seat, card);
      if (this.opening.discard.cards.length === 4) this.startPlaying();
    } else {
      throw new Error("WRONG_PHASE");
    }
  }

  private handlePlay(seat: PlayerId, intent: Intent): void {
    const round = this.round!;
    switch (intent.type) {
      case "draw_stock":
        this.round = drawFromStock(round, seat);
        break;
      case "pickup": {
        const target = findCard(round.discard.cards, intent.targetId);
        const handCards = intent.handIds.map((id) => findCard(round.hands[seat], id));
        this.round = pickFromDiscard(round, seat, target, handCards);
        break;
      }
      case "lay_down":
        this.round = layDownPureSeri(
          round,
          seat,
          intent.cardIds.map((id) => findCard(round.hands[seat], id)),
        );
        break;
      case "discard":
        this.round = discardCard(round, seat, findCard(round.hands[seat], intent.cardId));
        break;
      default:
        throw new Error("WRONG_PHASE");
    }
    if (this.round.result !== null) this.endRound();
  }

  // Pembukaan selalu dimulai dari pemain pertama ronde, lalu berputar searah kursi.
  private openingOrder(): PlayerId[] {
    return [0, 1, 2, 3].map((i) => ((this.firstPlayer + i) % 4) as PlayerId);
  }

  private expectOpeningSeat(seat: PlayerId): void {
    const expected = this.openingOrder()[this.opening!.discard.cards.length];
    if (seat !== expected) throw new Error("NOT_YOUR_TURN");
  }

  private startPlaying(): void {
    const resolved = resolveJoker(this.opening!, this.rng);
    this.round = {
      hands: resolved.hands,
      stock: resolved.stock,
      discard: resolved.discard,
      jokerRank: resolved.jokerRank,
      turn: this.firstPlayer,
      phase: "draw",
      drewFrom: null,
      laidPureSeri: [false, false, false, false],
      table: [[], [], [], []],
      penalties: resolved.penalties,
      result: null,
    };
    this.opening = null;
    this.status = "playing";
  }

  private endRound(): void {
    const scores = scoreRound(this.round!);
    this.lastRoundScores = scores;
    this.session = applyRound(this.session, scores);
    this.round = null;
    if (this.session.winner !== null) {
      this.status = "finished";
      return;
    }
    this.firstPlayer = nextFirstPlayer(this.session.totals);
    this.opening = this.newOpening();
    this.status = "opening";
  }

  private newOpening(): OpeningState {
    const { hands, stock } = deal(shuffle(makeDeck(), this.rng));
    return {
      hands,
      stock,
      discard: { cards: [], closedIndex: null },
      jokerRank: null,
      penalties: [0, 0, 0, 0],
    };
  }

  // Pemain yang masuk setelah ruang dibuat boleh mengambil kursi bot yang belum bertindak
  // di pembukaan. Dipakai untuk testing dengan sedikit akun.
  claimBotSeat(userId: string): PlayerId | null {
    if (this.status !== "opening" || this.opening === null) return null;
    const order = this.openingOrder();
    for (let i = this.opening.discard.cards.length; i < order.length; i++) {
      const seat = order[i];
      if (!this.seats[seat].startsWith(BOT_PREFIX)) continue;
      this.seats[seat] = userId;
      this.scheduleBot();
      return seat;
    }
    return null;
  }

  // Menjadwalkan langkah bot jika giliran saat ini milik kursi bot. Langkah dijalankan di tick berikutnya
  // setelah waktunya tiba, bukan dengan setTimeout.
  private scheduleBot(): void {
    if (this.botDueAt !== null) return;
    const seat = this.actingSeat();
    if (seat === null || !this.seats[seat].startsWith(BOT_PREFIX)) return;
    this.botDueAt = this.now() + (this.options.botDelayMs ?? 800);
  }

  private botAct(): void {
    if (this.status !== "opening" && this.status !== "playing") return;
    const seat = this.actingSeat();
    // Kursi bisa sudah diambil pemain sungguhan sejak jadwal bot dibuat.
    if (seat === null || !this.seats[seat].startsWith(BOT_PREFIX)) return;
    try {
      this.handle(seat, this.chooseBotIntent(seat));
    } catch {
      // Bot tidak menemukan langkah sah (jarang terjadi). Sesi menunggu, tidak dipaksa.
    }
  }

  private chooseBotIntent(seat: PlayerId): Intent {
    if (this.status === "opening") {
      const hand = this.opening!.hands[seat];
      if (hand.length === HAND_SIZE) return { type: "opening_draw" };
      const used = new Set(this.opening!.discard.cards.map((card) => card.rank));
      const card = mostValuable(hand.filter((c) => !used.has(c.rank))) ?? hand[0];
      return { type: "opening_discard", cardId: card.id };
    }
    const round = this.round!;
    if (round.phase === "draw") return { type: "draw_stock" };
    const hand = round.hands[seat];
    const card = mostValuable(hand.filter((c) => !isJoker(c, round.jokerRank))) ?? hand[0];
    return { type: "discard", cardId: card.id };
  }

  private actingSeat(): PlayerId | null {
    if (this.status === "opening") return this.openingOrder()[this.opening!.discard.cards.length];
    if (this.status === "playing") return this.round!.turn;
    return null;
  }
}

export function createRoom(seats: string[], options: RoomOptions): Room {
  return new Room(seats, options);
}

function findCard(cards: Card[], id: string): Card {
  const card = cards.find((c) => c.id === id);
  if (card === undefined) throw new Error("CARD_NOT_IN_HAND");
  return card;
}

function isJoker(card: Card, jokerRank: Rank | null): boolean {
  return jokerRank !== null && card.rank === jokerRank;
}

function mostValuable(cards: Card[]): Card | undefined {
  return cards.reduce<Card | undefined>(
    (best, card) => (best === undefined || baseValue(card.rank) > baseValue(best.rank) ? card : best),
    undefined,
  );
}
