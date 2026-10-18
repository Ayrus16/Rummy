"use client";

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type { PlayerView } from "../../server/view";
import { connectDiscord, type DiscordSession } from "../../src/client/discord";
import { connectSocket, joinChannel, sendIntent, type Ack } from "../../src/client/socket";
import { Table } from "./Table";
import styles from "./Table.module.css";

const JOIN_RETRY_MS = 2000;

function messageFor(error: string | undefined): string {
  switch (error) {
    case "NOT_ENOUGH_PLAYERS":
      return "Menunggu 4 pemain di Activity ini...";
    case "NOT_SEATED":
      return "Kamu tidak terdaftar sebagai pemain di sesi ini.";
    default:
      return error ?? "Gagal terhubung.";
  }
}

export default function ActivityPage() {
  const [view, setView] = useState<PlayerView | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState("Menghubungkan ke Discord...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let current: Socket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function start() {
      let session: DiscordSession;
      try {
        session = await connectDiscord();
      } catch (err) {
        if (!cancelled) setStatus(err instanceof Error ? err.message : "Gagal terhubung ke Discord.");
        return;
      }
      if (cancelled) return;

      const socketConnection = connectSocket();
      current = socketConnection;
      setSocket(socketConnection);
      socketConnection.on("state", (next: PlayerView) => {
        if (cancelled) return;
        setView(next);
        setError(null);
      });

      // Mode testing: ?bots=1 mengisi kursi kosong dengan bot.
      const addBots = new URLSearchParams(window.location.search).get("bots") === "1";

      // Dipanggil ulang setiap kali tersambung, termasuk setelah reconnect.
      const tryJoin = async () => {
        const result: Ack = await joinChannel(socketConnection, session, addBots);
        if (cancelled) return;
        if (result.ok) {
          setStatus("");
        } else if (result.error === "NOT_ENOUGH_PLAYERS") {
          setStatus(messageFor(result.error));
          retry = setTimeout(tryJoin, JOIN_RETRY_MS);
        } else {
          setStatus(messageFor(result.error));
        }
      };
      socketConnection.on("connect", tryJoin);
    }

    void start();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      current?.disconnect();
    };
  }, []);

  if (view === null || socket === null) {
    return <main className={styles.centered}>{status}</main>;
  }

  async function onIntent(intent: Parameters<typeof sendIntent>[1]) {
    const result = await sendIntent(socket!, intent);
    setError(result.ok ? null : messageFor(result.error));
  }

  return (
    <Table view={view} error={error ?? status} onIntent={onIntent} />
  );
}
