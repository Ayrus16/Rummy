"use client";

import { useState } from "react";
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

function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

function CardFace({
  card,
  selected,
  onClick,
  disabled,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const red = card.suit === "H" || card.suit === "D";
  return (
    <button
      type="button"
      className={`${styles.card} ${red ? styles.red : ""} ${selected ? styles.selected : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {cardLabel(card)}
    </button>
  );
}

export function Table({ view, error, onIntent }: TableProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pickupTarget, setPickupTarget] = useState<string | null>(null);

  const board = view.board;
  const myTurn = board !== null && board.turn === view.you;
  const inOpening = board?.phase === "opening";
  const drawPhase = board?.phase === "draw";
  const discardPhase = board?.phase === "discard";
  // Pembukaan memakai status "opening", permainan memakai "playing". Keduanya boleh bertindak saat gilirannya.
  const playable = board !== null && (view.status === "opening" || view.status === "playing") && myTurn;

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

  // Kartu yang bisa dipakai untuk menurunkan seri murni atau membuang.
  const canDiscard = discardPhase && playable && selected.length === 1;
  const canLayDown = (drawPhase || discardPhase) && playable && selected.length >= 3;
  const canPickup = drawPhase && playable && pickupTarget !== null && selected.length >= 2;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          Target {view.target} · Ronde {view.rounds}
          {board?.jokerRank && <> · Joker: {board.jokerRank}</>}
        </div>
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
      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.opponents}>
        {view.handCounts.map((count, seat) =>
          seat === view.you ? null : (
            <div key={seat} className={styles.opponent}>
              P{seat + 1}: {count} kartu
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

      <section className={styles.hand}>
        <div className={styles.label}>Kartumu</div>
        <div className={styles.row}>
          {view.hand.map((card) => (
            <CardFace
              key={card.id}
              card={card}
              selected={selected.includes(card.id)}
              disabled={!playable}
              onClick={() => toggle(card.id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
