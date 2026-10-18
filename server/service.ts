import { Redis } from "@upstash/redis";
import type { PlayerId } from "../src/rules/opening";
import { verifyDiscordUserId } from "./auth";
import { BOT_PREFIX, createRoom, Room, type Intent, type RoomOptions, type RoomSnapshot } from "./room";
import { viewFor, type PlayerView } from "./view";

const TARGET_SCORE = 1000;
const DISCONNECT_TIMEOUT_MS = 60_000;
// Pemain yang tidak polling selama ini dianggap terputus. Klien polling sekitar 1,5 detik.
const PRESENCE_MS = 5_000;
// Ruang yang tidak disentuh selama ini dihapus dari Redis.
const ROOM_TTL_SECONDS = 6 * 60 * 60;

const ROOM_OPTIONS: RoomOptions = {
  target: TARGET_SCORE,
  disconnectTimeoutMs: DISCONNECT_TIMEOUT_MS,
  presenceMs: PRESENCE_MS,
};

// Dibuat saat dipakai, bukan saat modul dimuat, supaya `next build` tidak gagal kalau env belum ada.
let redis: Redis | undefined;
function store(): Redis {
  redis ??= Redis.fromEnv();
  return redis;
}

function roomKey(channelId: string): string {
  return `room:${channelId}`;
}

async function loadRoom(channelId: string): Promise<Room | null> {
  const snapshot = await store().get<RoomSnapshot>(roomKey(channelId));
  return snapshot === null ? null : Room.restore(snapshot, ROOM_OPTIONS);
}

async function saveRoom(channelId: string, room: Room): Promise<void> {
  await store().set(roomKey(channelId), room.snapshot(), { ex: ROOM_TTL_SECONDS });
}

// Tepat 4 kursi. Kursi kosong diisi bot hanya jika diminta (untuk testing).
function fillSeats(participantIds: string[], addBots: boolean): string[] {
  if (participantIds.length > 4) throw new Error("TOO_MANY_PLAYERS");
  if (participantIds.length === 4) return participantIds;
  if (!addBots) throw new Error("NOT_ENOUGH_PLAYERS");
  const bots = Array.from({ length: 4 - participantIds.length }, (_, i) => `${BOT_PREFIX}${i + 1}`);
  return [...participantIds, ...bots];
}

function seatOf(room: Room, userId: string): PlayerId {
  const seat = room.seats.indexOf(userId);
  if (seat === -1) throw new Error("NOT_SEATED");
  return seat as PlayerId;
}

// Masuk ke ruang. Membuat ruang jika belum ada, dan mengambil kursi bot jika pemain belum punya kursi.
export async function join(
  accessToken: string,
  channelId: string,
  participantIds: string[],
  addBots: boolean,
): Promise<PlayerView> {
  const userId = await verifyDiscordUserId(accessToken);
  let room = await loadRoom(channelId);
  if (room === null || room.status === "finished" || room.status === "cancelled") {
    // Pembuat ruang harus termasuk dalam daftar peserta, supaya tidak membuat ruang untuk orang lain.
    if (!participantIds.includes(userId)) throw new Error("NOT_SEATED");
    room = createRoom(fillSeats(participantIds, addBots), ROOM_OPTIONS);
  }
  room.tick();
  let seat: PlayerId;
  if (room.seats.includes(userId)) {
    seat = seatOf(room, userId);
  } else {
    const claimed = room.claimBotSeat(userId);
    if (claimed === null) throw new Error("NOT_SEATED");
    seat = claimed;
  }
  room.touch(seat);
  await saveRoom(channelId, room);
  return viewFor(room, seat);
}

// Dipanggil klien setiap beberapa detik. Juga menandai pemain sebagai hadir.
export async function poll(accessToken: string, channelId: string): Promise<PlayerView> {
  const userId = await verifyDiscordUserId(accessToken);
  const room = await loadRoom(channelId);
  if (room === null) throw new Error("ROOM_NOT_FOUND");
  room.tick();
  const seat = seatOf(room, userId);
  room.touch(seat);
  await saveRoom(channelId, room);
  return viewFor(room, seat);
}

export async function act(accessToken: string, channelId: string, intent: Intent): Promise<PlayerView> {
  const userId = await verifyDiscordUserId(accessToken);
  const room = await loadRoom(channelId);
  if (room === null) throw new Error("ROOM_NOT_FOUND");
  room.tick();
  const seat = seatOf(room, userId);
  room.touch(seat);
  room.handle(seat, intent);
  await saveRoom(channelId, room);
  return viewFor(room, seat);
}
