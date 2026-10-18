"use client";

import { useEffect, useState, type ButtonHTMLAttributes } from "react";
import type { Card } from "../../src/rules/cards";
import type { Intent } from "../../server/room";
import type { PlayerView } from "../../server/view";
import styles from "./Table.module.css";

interface TableProps {
  view: PlayerView;
  error: string | null;
  onIntent: (intent: Intent) => void;
}

const SUIT_SYMBOL: Record<Card["suit"], string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_ORDER: Card["suit"][] = ["S", "H", "D", "C"];
const RANK_ORDER = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

function bySuitThenRank(a: Card, b: Card): number {
  return SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) || RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
}

type DragProps = Pick<ButtonHTMLAttributes<HTMLButtonElement>, "draggable" | "onDragStart" | "onDragOver" | "onDrop" | "onDragEnd">;

function CardFace({
  card,
  selected,
  onClick,
  disabled,
  ...drag
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
} & DragProps) {
  const red = card.suit === "H" || card.suit === "D";
  return (
    <button
      type="button"
      className={`${styles.card} ${red ? styles.red : ""} ${selected ? styles.selected : ""}`}
      onClick={onClick}
      disabled={disabled}
      {...drag}
    >
      {cardLabel(card)}
    </button>
  );
}

function Melds({ melds }: { melds: Card[][] }) {
  return (
    <div className={styles.row}>
      {melds.map((meld, i) => (
        <div key={i} className={styles.meld}>
          {meld.map((card) => (
            <CardFace key={card.id} card={card} disabled />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Table({ view, error, onIntent }: TableProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pickupTarget, setPickupTarget] = useState<string | null>(null);
  // Urutan tampilan kartu di tangan. Hanya di klien, tidak dikirim ke server.
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const board = view.board;
  const jokerRank = board?.jokerRank ?? null;
  // Joker diumumkan sekali saat ditentukan (popup 5 detik), lalu hilang dan tidak ditampilkan lagi.
  const [jokerPopup, setJokerPopup] = useState<string | null>(null);
  const [prevJoker, setPrevJoker] = useState(jokerRank);
  if (jokerRank !== prevJoker) {
    setPrevJoker(jokerRank);
    if (jokerRank !== null) setJokerPopup(jokerRank);
  }
  useEffect(() => {
    if (jokerPopup === null) return;
    const timer = setTimeout(() => setJokerPopup(null), 5000);
    return () => clearTimeout(timer);
  }, [jokerPopup]);

  // Konfirmasi reset kembali normal sendiri kalau tidak diklik lagi dalam beberapa detik.
  useEffect(() => {
    if (!confirmReset) return;
    const timer = setTimeout(() => setConfirmReset(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  const myTurn = board !== null && board.turn === view.you;
  const inOpening = board?.phase === "opening";
  const drawPhase = board?.phase === "draw";
  const discardPhase = board?.phase === "discard";
  // Pembukaan memakai status "opening", permainan memakai "playing". Keduanya boleh bertindak saat gilirannya.
  const playable = board !== null && (view.status === "opening" || view.status === "playing") && myTurn;

  // Kartu yang belum punya posisi (baru datang) ditaruh di belakang, sesuai urutan dari server.
  const handIds = [
    ...order.filter((id) => view.hand.some((card) => card.id === id)),
    ...view.hand.map((card) => card.id).filter((id) => !order.includes(id)),
  ];
  const hand = handIds.map((id) => view.hand.find((card) => card.id === id)!);

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function clearSelection() {
    setSelected([]);
    setPickupTarget(null);
  }

  function send(intent: Intent) {
    onIntent(intent);
    clearSelection();
  }

  function moveBefore(dragged: string, target: string) {
    if (dragged === target) return;
    const ids = handIds.filter((id) => id !== dragged);
    ids.splice(ids.indexOf(target), 0, dragged);
    setOrder(ids);
  }

  function resetClicked() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    clearSelection();
    onIntent({ type: "reset" });
  }

  // Kartu yang bisa dipakai untuk menurunkan seri murni atau membuang.
  const canDiscard = discardPhase && playable && selected.length === 1;
  const canLayDown = (drawPhase || discardPhase) && playable && selected.length >= 3;
  const canPickup = drawPhase && playable && pickupTarget !== null && selected.length >= 2;

  return (
    <main className={styles.page}>
      {jokerPopup !== null && <div className={styles.jokerPopup}>Joker ditentukan: {jokerPopup}</div>}
      <header className={styles.header}>
        <div>Target {view.target} · Ronde {view.rounds}</div>
        <div className={styles.totals}>
          {view.seats.map((_, seat) => (
            <span key={seat} className={seat === view.you ? styles.me : undefined}>
              P{seat + 1}: {view.totals[seat]}
              {view.pausedSeat === seat ? " (terputus)" : ""}
            </span>
          ))}
        </div>
      </header>

      {view.status === "paused" && <p className={styles.notice}>Permainan dijeda, menunggu pemain kembali.</p>}
      {view.status === "cancelled" && <p className={styles.notice}>Sesi dibatalkan karena pemain tidak kembali.</p>}
      {view.status === "finished" && (
        <p className={styles.notice}>Pemenang: P{(view.winner ?? 0) + 1}</p>
      )}
      {view.status === "opening" && view.lastRoundScores !== null && (
        <p className={styles.notice}>
          Skor ronde terakhir:{" "}
          {view.lastRoundScores.map((score, seat) => `P${seat + 1} ${score > 0 ? "+" : ""}${score}`).join(" · ")}
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.opponents}>
        {view.handCounts.map((count, seat) =>
          seat === view.you ? null : (
            <div key={seat} className={styles.opponent}>
              P{seat + 1}: {count} kartu
              {board && board.table[seat].length > 0 && <Melds melds={board.table[seat]} />}
            </div>
          ),
        )}
      </section>

      <section className={styles.middle}>
        <div className={styles.pile}>
          <div className={styles.label}>Cangkulan: {board?.stockCount ?? 0}</div>
          <button
            type="button"
            className={styles.stock}
            disabled={!playable || !drawPhase}
            onClick={() => send({ type: "draw_stock" })}
          >
            Ambil
          </button>
        </div>

        <div className={styles.discard}>
          <div className={styles.label}>Buangan (klik kartu untuk ambil)</div>
          <div className={styles.row}>
            {board?.discard.cards.map((card, index) => (
              <CardFace
                key={card.id}
                card={card}
                selected={pickupTarget === card.id}
                disabled={!playable || !drawPhase || (board.discard.closedIndex !== null && index <= board.discard.closedIndex)}
                onClick={() => setPickupTarget(pickupTarget === card.id ? null : card.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.actions}>
        {inOpening && playable && view.hand.length === 7 && (
          <button type="button" onClick={() => send({ type: "opening_draw" })}>
            Ambil dari cangkulan
          </button>
        )}
        {inOpening && playable && view.hand.length === 8 && (
          <button
            type="button"
            disabled={selected.length !== 1}
            onClick={() => send({ type: "opening_discard", cardId: selected[0] })}
          >
            Buang kartu terpilih
          </button>
        )}
        {drawPhase && playable && (
          <button
            type="button"
            disabled={!canPickup}
            onClick={() => send({ type: "pickup", targetId: pickupTarget!, handIds: selected })}
          >
            Ambil dari buangan
          </button>
        )}
        {(drawPhase || discardPhase) && playable && !inOpening && (
          <button
            type="button"
            disabled={!canLayDown}
            onClick={() => send({ type: "lay_down", cardIds: selected })}
          >
            Turunkan seri murni
          </button>
        )}
        {discardPhase && playable && !inOpening && (
          <button
            type="button"
            disabled={!canDiscard}
            onClick={() => send({ type: "discard", cardId: selected[0] })}
          >
            Buang
          </button>
        )}
        {!playable && view.status !== "finished" && view.status !== "cancelled" && (
          <span className={styles.label}>
            Giliran P{(board?.turn ?? 0) + 1}
          </span>
        )}
      </section>

      {board && board.table[view.you].length > 0 && (
        <section className={styles.hand}>
          <div className={styles.label}>Kombinasi yang kamu turunkan</div>
          <Melds melds={board.table[view.you]} />
        </section>
      )}

      <section className={styles.hand}>
        <div className={styles.label}>
          Kartumu{" "}
          <button type="button" className={styles.tool} onClick={() => setOrder([...view.hand].sort(bySuitThenRank).map((card) => card.id))}>
            Urutkan
          </button>
        </div>
        <div className={styles.row}>
          {hand.map((card) => (
            <CardFace
              key={card.id}
              card={card}
              selected={selected.includes(card.id)}
              onClick={() => playable && toggle(card.id)}
              draggable
              onDragStart={() => setDragId(card.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dragId !== null && moveBefore(dragId, card.id)}
              onDragEnd={() => setDragId(null)}
            />
          ))}
        </div>
      </section>

      <section className={styles.actions}>
        <button type="button" className={styles.reset} onClick={resetClicked}>
          {confirmReset ? "Klik lagi untuk reset game" : "Reset game"}
        </button>
      </section>
    </main>
  );
}
