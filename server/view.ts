import type { Card, Rank } from "../src/rules/cards";
import type { DiscardPile, PlayerId } from "../src/rules/opening";
import type { RoundResult } from "../src/rules/turn";
import { BOT_PREFIX, type HistoryEntry, type Room, type RoomStatus, type RoundDetail } from "./room";
import type { Arrangement } from "../src/rules/scoring";

// Isi cangkulan dan tangan lawan tidak pernah dikirim; hanya jumlahnya.
export interface PublicBoard {
  jokerRank: Rank | null;
  stockCount: number;
  discard: DiscardPile;
  table: Card[][][];
  penalties: number[];
  laidPureSeri: boolean[];
  turn: PlayerId;
  phase: "opening" | "draw" | "discard";
  drewFrom: "stock" | "discard" | null;
  result: RoundResult | null;
}

// Informasi tampilan tiap kursi: nama, avatar, dan jenisnya.
export interface PlayerInfo {
  kind: "human" | "bot" | "empty";
  name: string;
  avatarUrl: string | null;
}

const BOT_AVATAR = "/bot-avatar.svg";

export interface PlayerView {
  players: PlayerInfo[];
  status: RoomStatus;
  you: PlayerId;
  seats: string[];
  target: number;
  totals: number[];
  rounds: number;
  winner: PlayerId | null;
  lastRoundScores: number[] | null;
  // Rincian kombinasi dan sampah tiap pemain untuk ronde terakhir.
  roundDetail: RoundDetail[] | null;
  // Riwayat skor per ronde, dari ronde pertama.
  history: HistoryEntry[];
  // Fase penyusunan: siapa yang sudah konfirmasi, dan susunan tangan kita sendiri.
  scoring: { confirmed: boolean[]; mine: Arrangement | null } | null;
  pausedSeat: PlayerId | null;
  board: PublicBoard | null;
  hand: Card[];
  handCounts: number[];
}

function playerInfo(room: Room, seat: number): PlayerInfo {
  const id = room.seats[seat];
  if (id === "") return { kind: "empty", name: "Kosong", avatarUrl: null };
  if (id.startsWith(BOT_PREFIX)) return { kind: "bot", name: `Bot ${seat + 1}`, avatarUrl: BOT_AVATAR };
  const profile = room.profiles[seat];
  return { kind: "human", name: profile?.name ?? "Pemain", avatarUrl: profile?.avatarUrl ?? null };
}

export function viewFor(room: Room, seat: PlayerId): PlayerView {
  const board = room.board();
  return {
    players: room.seats.map((_, i) => playerInfo(room, i)),
    status: room.status,
    you: seat,
    seats: room.seats,
    target: room.session.target,
    totals: room.session.totals,
    rounds: room.session.rounds,
    winner: room.session.winner,
    lastRoundScores: room.lastRoundScores,
    roundDetail: room.roundDetail,
    history: room.history,
    scoring:
      room.status === "scoring"
        ? { confirmed: [...room.scoringConfirmed], mine: room.scoringArrangement?.[seat] ?? null }
        : null,
    pausedSeat: room.pausedSeat,
    board: board && {
      jokerRank: board.jokerRank,
      stockCount: board.stock.length,
      discard: board.discard,
      table: board.table,
      penalties: board.penalties,
      laidPureSeri: board.laidPureSeri,
      turn: board.turn,
      phase: board.phase,
      drewFrom: board.drewFrom,
      result: board.result,
    },
    hand: board ? board.hands[seat] : [],
    handCounts: board ? board.hands.map((hand) => hand.length) : [0, 0, 0, 0],
  };
}
