import { makeDeck, type Card, type Rank } from "./cards";
import { classify } from "./combos";
import { canPartition } from "./partition";
import { subsets } from "./subsets";
import type { PlayerId } from "./opening";
import type { RoundState } from "./turn";

// Tangan tinggal satu kartu lagi untuk tutup jika ada kartu X (tidak ada di tangan) sehingga setelah
// mengambilnya tangan bisa ditutup. Dua cara tutup:
// - kartu penutup adalah kartu buangan yang ikut diambil: tangan + X sudah bisa dipartisi seluruhnya;
// - kartu penutup adalah kartu sendiri: satu kartu c dibuang dari tangan + X, sisanya bisa dipartisi.
// Hanya X yang membentuk kombinasi sah dengan dua atau tiga kartu tangan yang perlu dicek (X tidak bisa dipakai lain).
export function canCallCekih(hand: Card[], jokerRank: Rank | null): boolean {
  if (canPartition(hand, jokerRank)) return true;
  const held = new Set(hand.map((card) => card.id));
  const useful = makeDeck().filter((extra) => !held.has(extra.id) && formsMeldWithHand(extra, hand, jokerRank));
  return useful.some((extra) => {
    const pool = [...hand, extra];
    if (canPartition(pool, jokerRank)) return true;
    return pool.some((_, i) => canPartition(pool.filter((__, j) => j !== i), jokerRank));
  });
}

function formsMeldWithHand(extra: Card, hand: Card[], jokerRank: Rank | null): boolean {
  return subsets(hand, 2, 3).some((group) => classify([extra, ...group], jokerRank).kind !== "invalid");
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
