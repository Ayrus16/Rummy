import { baseValue, type Card, type Rank } from "./cards";
import { classify } from "./combos";
import { subsets } from "./subsets";
import type { RoundState } from "./turn";

const JOKER_PENALTY_MULTIPLIER = 10;

// Skor ronde per pemain. Kombinasi di meja dihitung plus; tangan dipecah
// sehingga nilai kombinasinya maksimal, sisanya minus. Penalti joker dan
// bonus closed ditambahkan di akhir.
export function scoreRound(state: RoundState): number[] {
  return state.hands.map((hand, seat) => {
    const onTable = state.table[seat].reduce((sum, meld) => sum + meldValue(meld, state.jokerRank), 0);
    const inHand = bestHandScore(hand, state.jokerRank);
    const bonus = state.result?.closedBy === seat ? state.result.bonus : 0;
    return onTable + inHand + state.penalties[seat] + bonus;
  });
}

function meldValue(meld: Card[], jokerRank: Rank | null): number {
  return classify(meld, jokerRank).values.reduce((sum, value) => sum + value, 0);
}

// Nilai terbaik untuk tangan: setiap kartu dipilih untuk masuk kombinasi (plus)
// atau tidak (minus). Dicari dengan rekursi karena tangan maksimal 8 kartu.
function bestHandScore(hand: Card[], jokerRank: Rank | null): number {
  if (hand.length === 0) return 0;
  const [first, ...rest] = hand;
  const isJoker = (card: Card) => jokerRank !== null && card.rank === jokerRank;
  const loneValue = isJoker(first)
    ? -JOKER_PENALTY_MULTIPLIER * baseValue(first.rank)
    : -baseValue(first.rank);

  let best = loneValue + bestHandScore(rest, jokerRank);
  for (const group of subsets(rest, 2, 3)) {
    const meld = [first, ...group];
    if (classify(meld, jokerRank).kind === "invalid") continue;
    const remaining = rest.filter((card) => !group.includes(card));
    best = Math.max(best, meldValue(meld, jokerRank) + bestHandScore(remaining, jokerRank));
  }
  return best;
}
