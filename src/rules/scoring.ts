import { baseValue, type Card, type Rank } from "./cards";
import { classify } from "./combos";
import { subsets } from "./subsets";
import type { RoundState } from "./turn";

const JOKER_PENALTY_MULTIPLIER = 10;

// Susunan kartu tangan: kombinasi (plus) dan sisanya yang jadi sampah (minus).
export interface Arrangement {
  melds: Card[][];
  leftover: Card[];
}

interface Best extends Arrangement {
  score: number;
}

// Susunan tangan dengan nilai terbaik. Dipakai sebagai usulan awal dan untuk bot.
// allowJokerMelds: kombinasi yang memakai joker hanya boleh plus kalau pemain sudah pernah menurunkan seri murni.
export function handArrangement(hand: Card[], jokerRank: Rank | null, allowJokerMelds: boolean): Arrangement {
  const best = bestFrom(hand, jokerRank, allowJokerMelds);
  return { melds: best.melds, leftover: best.leftover };
}

// Susunan yang dikirim pemain. Null jika ada kombinasi tidak sah, kartu tidak ada di tangan, atau kartu dipakai dua kali.
export function validateArrangement(hand: Card[], melds: Card[][], jokerRank: Rank | null): Arrangement | null {
  const used = new Set<string>();
  for (const meld of melds) {
    if (classify(meld, jokerRank).kind === "invalid") return null;
    for (const card of meld) {
      if (used.has(card.id) || !hand.some((h) => h.id === card.id)) return null;
      used.add(card.id);
    }
  }
  return { melds, leftover: hand.filter((card) => !used.has(card.id)) };
}

// Skor satu pemain untuk ronde ini dengan susunan tangan tertentu.
export function seatScore(state: RoundState, seat: number, arrangement: Arrangement): number {
  const onTable = state.table[seat].reduce((sum, meld) => sum + meldValue(meld, state.jokerRank), 0);
  const plus = arrangement.melds.reduce((sum, meld) => sum + meldValue(meld, state.jokerRank), 0);
  const minus = arrangement.leftover.reduce((sum, card) => sum + loneValue(card, state.jokerRank), 0);
  const bonus = state.result?.closedBy === seat ? state.result.bonus : 0;
  return onTable + plus + minus + state.penalties[seat] + bonus;
}

export function scoreRound(state: RoundState): number[] {
  return state.hands.map((hand, seat) =>
    seatScore(state, seat, handArrangement(hand, state.jokerRank, state.laidPureSeri[seat])),
  );
}

export function meldValue(meld: Card[], jokerRank: Rank | null): number {
  return classify(meld, jokerRank).values.reduce((sum, value) => sum + value, 0);
}

export function loneValue(card: Card, jokerRank: Rank | null): number {
  const isJoker = jokerRank !== null && card.rank === jokerRank;
  return isJoker ? -JOKER_PENALTY_MULTIPLIER * baseValue(card.rank) : -baseValue(card.rank);
}

// Setiap kartu dipilih untuk masuk kombinasi (plus) atau jadi sampah (minus). Dicari dengan rekursi,
// tangan maksimal 8 kartu. Jika nilai sama, kartu dibiarkan sebagai sampah.
function bestFrom(hand: Card[], jokerRank: Rank | null, allowJokerMelds: boolean): Best {
  if (hand.length === 0) return { score: 0, melds: [], leftover: [] };
  const [first, ...rest] = hand;
  const alone = bestFrom(rest, jokerRank, allowJokerMelds);
  let best: Best = {
    score: loneValue(first, jokerRank) + alone.score,
    melds: alone.melds,
    leftover: [first, ...alone.leftover],
  };
  for (const group of subsets(rest, 2, 3)) {
    const meld = [first, ...group];
    if (classify(meld, jokerRank).kind === "invalid") continue;
    if (!allowJokerMelds && containsJoker(meld, jokerRank)) continue;
    const remaining = rest.filter((card) => !group.includes(card));
    const inner = bestFrom(remaining, jokerRank, allowJokerMelds);
    const score = meldValue(meld, jokerRank) + inner.score;
    if (score > best.score) best = { score, melds: [meld, ...inner.melds], leftover: inner.leftover };
  }
  return best;
}

export function containsJoker(meld: Card[], jokerRank: Rank | null): boolean {
  return jokerRank !== null && meld.some((card) => card.rank === jokerRank);
}
