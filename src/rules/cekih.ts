import { makeDeck, type Card, type Rank } from "./cards";
import { canPartition } from "./partition";

// Tangan tinggal satu kartu lagi jika ada kartu X (tidak ada di tangan) sehingga tangan setelah ditambah X
// bisa dibentuk seluruhnya menjadi kombinasi sah. Kartu penutup diambil dari buangan saat penutupan.
export function canCallCekih(hand: Card[], jokerRank: Rank | null): boolean {
  const held = new Set(hand.map((card) => card.id));
  return makeDeck().some((extra) => !held.has(extra.id) && canPartition([...hand, extra], jokerRank));
}
