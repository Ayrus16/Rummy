"use client";

import { useEffect, useRef, useState } from "react";
import type { Intent } from "../../server/room";
import type { PlayerView } from "../../server/view";
import { connectDiscord } from "../../src/client/discord";
import { messageForError } from "../../src/client/messages";
import { connectRoom, type RoomConnection } from "../../src/client/realtime";
import { Table } from "./Table";
import styles from "./Table.module.css";


export default function ActivityPage() {
  const [view, setView] = useState<PlayerView | null>(null);
  const [status, setStatus] = useState("Menghubungkan ke Discord...");
  const [error, setError] = useState<string | null>(null);
  const connection = useRef<RoomConnection | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Mode testing: NEXT_PUBLIC_ALLOW_BOTS=1 mengisi kursi kosong dengan bot.
    const addBots = process.env.NEXT_PUBLIC_ALLOW_BOTS === "1";

    async function start() {
      let session;
      try {
        session = await connectDiscord(setStatus);
      } catch (err) {
        if (!cancelled) setStatus(err instanceof Error ? err.message : "Gagal terhubung ke Discord.");
        return;
      }
      if (cancelled) return;

      connection.current = connectRoom(session, addBots, {
        onView: (next) => {
          setView(next);
          setError(null);
        },
        onError: (message) => setError(messageForError(message)),
        onStatus: setStatus,
      });
    }

    void start();
    return () => {
      cancelled = true;
      connection.current?.close();
    };
  }, []);

  if (view === null) {
    return <main className={styles.centered}>{error ?? status}</main>;
  }

  function onIntent(intent: Intent) {
    if (!connection.current?.send(intent)) setError("Belum tersambung ke server, coba lagi.");
  }

  return <Table view={view} error={error ?? status} onIntent={onIntent} />;
}
