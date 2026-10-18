"use client";

import { Children, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Card } from "../../src/rules/cards";
import { classify } from "../../src/rules/combos";
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

function bySuitThenRank(a: Card, b: Card): number {
  return SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) || RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
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
      <span className={styles.corner}>
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className={styles.center}>{SUIT_SYMBOL[card.suit]}</span>
      <span className={`${styles.corner} ${styles.cornerBottom}`}>
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
    </button>
  );
}

// Baris kartu yang menumpuk otomatis: rapat seperti biasa, dan kartu saling menutupi hanya kalau ruangnya sempit.
function FitRow({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const first = el.firstElementChild as HTMLElement | null;
      if (!first || count < 2) return setOverlap(0);
      const needed = count * first.offsetWidth - el.clientWidth;
      setOverlap(Math.max(0, Math.ceil(needed / (count - 1))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count]);
  return (
    <div ref={ref} className={styles.fitRow}>
      {Children.map(children, (child, i) => (
        <div className={styles.slot} style={{ marginLeft: i === 0 ? 0 : -overlap }}>
          {child}
        </div>
      ))}
    </div>
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
  // Susunan kombinasi saat fase penyusunan. Null berarti belum diubah, jadi pakai usulan server.
  const [edit, setEdit] = useState<{ round: number; groups: string[][] } | null>(null);
  const [targetInput, setTargetInput] = useState("");

  const board = view.board;
  const myTurn = board !== null && board.turn === view.you;
  const inOpening = board?.phase === "opening";
  const drawPhase = board?.phase === "draw";
  const discardPhase = board?.phase === "discard";
  // Pembukaan memakai status "opening", permainan memakai "playing". Keduanya boleh bertindak saat gilirannya.
  const playable = board !== null && (view.status === "opening" || view.status === "playing") && myTurn;
  const scoringPhase = view.status === "scoring" && view.scoring !== null;
  const myConfirmed = scoringPhase && view.scoring!.confirmed[view.you];
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

  // Kartu yang belum punya posisi (baru datang) ditaruh di belakang, sesuai urutan dari server.
  const handIds = [
    ...order.filter((id) => view.hand.some((card) => card.id === id)),
    ...view.hand.map((card) => card.id).filter((id) => !order.includes(id)),
  ];
  const hand = handIds.map((id) => view.hand.find((card) => card.id === id)!);

  // Penyusunan: kombinasi dari usulan server, atau dari hasil edit pemain di ronde ini.
  const serverGroups = (view.scoring?.mine?.melds ?? []).map((meld) => meld.map((card) => card.id));
  const groups = edit !== null && edit.round === view.rounds ? edit.groups : serverGroups;
  const groupedIds = groups.flat();
  const leftoverCards = view.hand.filter((card) => !groupedIds.includes(card.id));

  function setGroups(next: string[][]) {
    setEdit({ round: view.rounds, groups: next });
  }

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

  // Kartu terpilih dari sampah bisa dijadikan kombinasi baru kalau sah.
  const selectedLeftover = leftoverCards.filter((card) => selected.includes(card.id));
  const canGroup = scoringPhase && !myConfirmed && (board?.laidPureSeri[view.you] ?? false) && selectedLeftover.length >= 3 &&
    classify(selectedLeftover, jokerRank).kind !== "invalid";
  const waiting = scoringPhase
    ? view.scoring!.confirmed.map((ok, seat) => (ok ? null : `P${seat + 1}`)).filter(Boolean).join(", ")
    : "";

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

      {view.rounds === 0 && view.status !== "finished" && view.status !== "cancelled" && (
        <form
          className={styles.target}
          onSubmit={(event) => {
            event.preventDefault();
            onIntent({ type: "set_target", target: Number(targetInput) });
            setTargetInput("");
          }}
        >
          <label>
            Target poin{" "}
            <input
              type="number"
              min={100}
              max={5000}
              step={50}
              value={targetInput}
              placeholder={String(view.target)}
              onChange={(event) => setTargetInput(event.target.value)}
            />
          </label>
          <button type="submit" disabled={targetInput === ""}>
            Atur target
          </button>
        </form>
      )}
      {view.status === "paused" && <p className={styles.notice}>Permainan dijeda, menunggu pemain kembali.</p>}
      {view.status === "cancelled" && <p className={styles.notice}>Sesi dibatalkan karena pemain tidak kembali.</p>}
      {view.status === "finished" && (
        <p className={styles.notice}>Pemenang: P{(view.winner ?? 0) + 1}</p>
      )}
      {scoringPhase && (
        <p className={styles.notice}>
          Ronde selesai. {myConfirmed ? `Menunggu konfirmasi dari ${waiting}.` : "Susun kombinasimu lalu konfirmasi."}
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}

      {view.roundDetail !== null && !scoringPhase && (
        <section className={styles.detail}>
          <div className={styles.label}>Hasil ronde terakhir</div>
          <div className={styles.resultGrid}>
            {view.roundDetail.map((detail, seat) => (
              <div key={seat} className={styles.resultSeat}>
                <div className={styles.resultHead}>
                  <strong>P{seat + 1}</strong>
                  <span className={detail.score < 0 ? styles.minus : styles.plus}>{signed(detail.score)}</span>
                </div>
                {detail.melds.length > 0 && <div className={styles.resultSubtitle}>Kombinasi</div>}
                {detail.melds.map((meld, i) => (
                  <div key={i} className={styles.resultLine}>
                    <div className={styles.cards}>
                      {meld.map((card) => (
                        <CardFace key={card.id} card={card} disabled />
                      ))}
                    </div>
                    <span className={detail.meldValues[i] < 0 ? styles.minus : styles.plus}>{signed(detail.meldValues[i])}</span>
                  </div>
                ))}
                {detail.leftover.length > 0 && <div className={styles.resultSubtitle}>Sampah</div>}
                {detail.leftover.length > 0 && (
                  <div className={styles.cards}>
                    {detail.leftover.map((card, i) => (
                      <span key={card.id} className={styles.leftCard}>
                        <CardFace card={card} disabled />
                        <span className={styles.minus}>{signed(detail.leftoverValues[i])}</span>
                      </span>
                    ))}
                  </div>
                )}
                {detail.bonus !== 0 && <div className={styles.resultLine}>Bonus closed <span className={styles.plus}>{signed(detail.bonus)}</span></div>}
                {detail.penalty !== 0 && <div className={styles.resultLine}>Penalti joker <span className={styles.minus}>{signed(detail.penalty)}</span></div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {view.history.length > 0 && (
        <section className={styles.detail}>
          <div className={styles.label}>Riwayat poin (total setelah ronde)</div>
          <table className={styles.history}>
            <thead>
              <tr>
                <th>Ronde</th>
                {view.seats.map((_, seat) => (
                  <th key={seat}>P{seat + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.history.map((entry) => (
                <tr key={entry.round}>
                  <td>{entry.round}</td>
                  {entry.totals.map((total, seat) => (
                    <td key={seat}>
                      {total} <span className={entry.scores[seat] < 0 ? styles.minus : styles.plus}>({signed(entry.scores[seat])})</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

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
        {!playable && view.status !== "finished" && view.status !== "cancelled" && view.status !== "scoring" && (
          <span className={styles.label}>
            Giliran P{(board?.turn ?? 0) + 1}
          </span>
        )}
      </section>

      {board && board.table[view.you].length > 0 && !scoringPhase && (
        <section className={styles.hand}>
          <div className={styles.label}>Kombinasi yang kamu turunkan</div>
          <Melds melds={board.table[view.you]} />
        </section>
      )}

      {scoringPhase && !myConfirmed ? (
        <section className={styles.hand}>
          <div className={styles.label}>Kombinasimu (kartu yang tidak masuk kombinasi dihitung minus)</div>
          {!(board?.laidPureSeri[view.you] ?? false) && (
            <p className={styles.notice}>Kamu belum menurunkan seri murni, jadi semua kartumu dihitung minus.</p>
          )}
          {groups.map((group, index) => (
            <div key={index} className={styles.row}>
              {group.map((id) => {
                const card = view.hand.find((c) => c.id === id)!;
                return <CardFace key={id} card={card} disabled />;
              })}
              <button type="button" className={styles.tool} onClick={() => setGroups(groups.filter((_, i) => i !== index))}>
                Lepas
              </button>
            </div>
          ))}
          <div className={styles.label}>Sampah</div>
          <FitRow count={leftoverCards.length}>
            {leftoverCards.map((card) => (
              <CardFace
                key={card.id}
                card={card}
                selected={selected.includes(card.id)}
                onClick={() => toggle(card.id)}
              />
            ))}
          </FitRow>
          <div className={styles.row}>
            <button
              type="button"
              disabled={!canGroup}
              onClick={() => {
                setGroups([...groups, selectedLeftover.map((card) => card.id)]);
                clearSelection();
              }}
            >
              Jadikan kombinasi
            </button>
            <button type="button" onClick={() => onIntent({ type: "confirm", melds: groups })}>
              Konfirmasi susunan
            </button>
          </div>
        </section>
      ) : (
        <section className={styles.hand}>
          <div className={styles.label}>
            Kartumu{" "}
            <button type="button" className={styles.tool} onClick={() => setOrder([...view.hand].sort(bySuitThenRank).map((card) => card.id))}>
              Urutkan
            </button>
          </div>
          <FitRow count={hand.length}>
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
          </FitRow>
        </section>
      )}

      <section className={styles.actions}>
        <button type="button" className={styles.reset} onClick={resetClicked}>
          {confirmReset ? "Klik lagi untuk reset game" : "Reset game"}
        </button>
      </section>
    </main>
  );
}
