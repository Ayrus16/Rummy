import { makeDeck, type Card, type Rank } from "./cards";
import { canPartition } from "./partition";
import type { PlayerId } from "./opening";
import type { RoundState } from "./turn";

// Tangan tinggal satu kartu lagi jika ada kartu X (tidak ada di tangan) sehingga tangan setelah ditambah X
// bisa dibentuk seluruhnya menjadi kombinasi sah. Kartu penutup diambil dari buangan saat penutupan.
export function canCallCekih(hand: Card[], jokerRank: Rank | null): boolean {
  const held = new Set(hand.map((card) => card.id));
  return makeDeck().some((extra) => !held.has(extra.id) && canPartition([...hand, extra], jokerRank));
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
