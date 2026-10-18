import type { Intent } from "../../server/room";
import type { PlayerView } from "../../server/view";
import type { DiscordSession } from "./discord";

export type RoomResult = { ok: true; view: PlayerView } | { ok: false; error: string };

// Jeda polling. Lebih kecil = lebih responsif, tapi lebih banyak request ke Upstash dan Discord.
export const POLL_MS = 1500;

async function send(
  url: string,
  session: DiscordSession,
  init?: { method: "POST"; body: unknown },
): Promise<RoomResult> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
    body: init === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = (await response.json()) as PlayerView | { error: string };
  if (!response.ok) return { ok: false, error: (data as { error: string }).error };
  return { ok: true, view: data as PlayerView };
}

export function pollRoom(session: DiscordSession): Promise<RoomResult> {
  return send(`/api/room?channelId=${encodeURIComponent(session.channelId)}`, session);
}

export function joinRoom(session: DiscordSession, addBots: boolean): Promise<RoomResult> {
  return send("/api/room/join", session, {
    method: "POST",
    body: { channelId: session.channelId, participantIds: session.participantIds, addBots },
  });
}

export function sendIntent(session: DiscordSession, intent: Intent): Promise<RoomResult> {
  return send("/api/room/intent", session, { method: "POST", body: { channelId: session.channelId, intent } });
}
