import { makeDeck, type Card, type Rank } from "./cards";
import { canPartition } from "./partition";
import type { PlayerId } from "./opening";
import type { RoundState } from "./turn";

// Tangan tinggal satu kartu lagi untuk tutup jika ada kartu X (tidak ada di tangan) sehingga setelah
// mengambilnya tangan bisa ditutup. Dua cara tutup:
// - kartu penutup adalah kartu buangan yang ikut diambil: tangan + X sudah bisa dipartisi seluruhnya;
// - kartu penutup adalah kartu sendiri: satu kartu c dibuang dari tangan + X, sisanya bisa dipartisi.
export function canCallCekih(hand: Card[], jokerRank: Rank | null): boolean {
  const held = new Set(hand.map((card) => card.id));
  return makeDeck().some((extra) => {
    if (held.has(extra.id)) return false;
    const pool = [...hand, extra];
    if (canPartition(pool, jokerRank)) return true;
    return pool.some((_, i) => canPartition(pool.filter((__, j) => j !== i), jokerRank));
  });
}

export function callCekih(state: RoundState, caller: PlayerId, target: PlayerId): RoundState {
  if (state.result !== null) throw new Error("ROUND_OVER");
  if (caller === target) throw new Error("CEKIH_SELF");
  const exists = state.cekih.some((c) => c.caller === caller && c.target === target);
  if (exists) throw new Error("CEKIH_ALREADY_ACTIVE");
  if (!canCallCekih(state.hands[caller], state.jokerRank)) throw new Error("CEKIH_NOT_ALLOWED");
  return { ...state, cekih: [...state.cekih, { caller, target }] };
}

export function cancelCekih(state: RoundState, caller: PlayerId, target: PlayerId): RoundState {
  if (state.result !== null) throw new Error("ROUND_OVER");
  const exists = state.cekih.some((c) => c.caller === caller && c.target === target);
  if (!exists) throw new Error("CEKIH_NOT_FOUND");
  return {
    ...state,
    cekih: state.cekih.filter((c) => !(c.caller === caller && c.target === target)),
  };
}
