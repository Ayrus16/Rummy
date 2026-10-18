"use client";

import { useEffect, useState } from "react";
import type { Intent } from "../../server/room";
import type { PlayerView } from "../../server/view";
import { joinRoom, POLL_MS, pollRoom, sendIntent, type RoomResult } from "../../src/client/api";
import { connectDiscord, type DiscordSession } from "../../src/client/discord";
import { Table } from "./Table";
import styles from "./Table.module.css";

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
  const [session, setSession] = useState<DiscordSession | null>(null);
  const [status, setStatus] = useState("Menghubungkan ke Discord...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Mode testing: NEXT_PUBLIC_ALLOW_BOTS=1 mengisi kursi kosong dengan bot.
    const addBots = process.env.NEXT_PUBLIC_ALLOW_BOTS === "1";

    // Pemain yang belum punya kursi (atau ruang belum ada) bergabung dulu, lalu polling berjalan seterusnya.
    async function refresh(current: DiscordSession): Promise<RoomResult> {
      const polled = await pollRoom(current);
      if (polled.ok || (polled.error !== "ROOM_NOT_FOUND" && polled.error !== "NOT_SEATED")) return polled;
      return joinRoom(current, addBots);
    }

    async function start() {
      let current: DiscordSession;
      try {
        current = await connectDiscord(setStatus);
      } catch (err) {
        if (!cancelled) setStatus(err instanceof Error ? err.message : "Gagal terhubung ke Discord.");
        return;
      }
      if (cancelled) return;
      setSession(current);

      const tick = async () => {
        try {
          const result = await refresh(current);
          if (cancelled) return;
          if (result.ok) {
            setView(result.view);
            setError(null);
            setStatus("");
          } else {
            setStatus(messageFor(result.error));
          }
        } catch {
          if (!cancelled) setStatus("Koneksi ke server terputus, mencoba lagi...");
        }
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      };
      void tick();
    }

    void start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (view === null || session === null) {
    return <main className={styles.centered}>{status}</main>;
  }

  async function onIntent(intent: Intent) {
    try {
      const result = await sendIntent(session!, intent);
      if (result.ok) setView(result.view);
      setError(result.ok ? null : messageFor(result.error));
    } catch {
      setError("Gagal mengirim langkah, coba lagi.");
    }
  }

  return <Table view={view} error={error ?? status} onIntent={onIntent} />;
}
