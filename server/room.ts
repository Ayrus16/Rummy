import { makeDeck, shuffle, type Card, type Rank } from "../src/rules/cards";
import { deal } from "../src/rules/deal";
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

export interface RoomOptions {
  target: number;
  disconnectTimeoutMs: number;
  rng?: () => number;
  onChange?: () => void;
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

export class Room {
  status: RoomStatus = "opening";
  session: SessionState;
  lastRoundScores: number[] | null = null;
  pausedSeat: PlayerId | null = null;

  private readonly rng: () => number;
  private firstPlayer: PlayerId = 0;
  private opening: OpeningState | null = null;
  private round: RoundState | null = null;
  private resumeStatus: RoomStatus = "opening";
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly seats: string[],
    private readonly options: RoomOptions,
  ) {
    if (seats.length !== 4) throw new Error("BAD_SEAT_COUNT");
    this.rng = options.rng ?? Math.random;
    this.session = { totals: [0, 0, 0, 0], target: options.target, rounds: 0, winner: null };
    this.opening = this.newOpening();
  }

  handle(seat: PlayerId, intent: Intent): void {
    if (this.status === "paused") throw new Error("PAUSED");
    if (this.status === "cancelled" || this.status === "finished") throw new Error("ROOM_CLOSED");
    if (this.status === "opening") this.handleOpening(seat, intent);
    else this.handlePlay(seat, intent);
    this.options.onChange?.();
  }

  onDisconnect(seat: PlayerId): void {
    if (this.status !== "opening" && this.status !== "playing") return;
    this.resumeStatus = this.status;
    this.status = "paused";
    this.pausedSeat = seat;
    this.timer = setTimeout(() => this.cancel(), this.options.disconnectTimeoutMs);
    this.options.onChange?.();
  }

  onReconnect(seat: PlayerId): void {
    if (this.status !== "paused" || seat !== this.pausedSeat) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.status = this.resumeStatus;
    this.pausedSeat = null;
    this.options.onChange?.();
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

  private cancel(): void {
    this.timer = null;
    this.status = "cancelled";
    this.options.onChange?.();
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
