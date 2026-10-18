import { createServer } from "node:http";
import { Server } from "socket.io";
import type { PlayerId } from "../src/rules/opening";
import { verifyDiscordUserId } from "./auth";
import { createRoom, type Intent, type Room } from "./room";
import { viewFor } from "./view";

const PORT = Number(process.env.PORT ?? 4000);
const DISCONNECT_TIMEOUT_MS = Number(process.env.DISCONNECT_TIMEOUT_MS ?? 60_000);
const TARGET_SCORE = 1000;

// Satu ruang per voice channel. Nama ruang Socket.IO memakai channelId yang sama.
const rooms = new Map<string, Room>();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

interface SocketData {
  channelId?: string;
  seat?: PlayerId;
}

async function broadcast(channelId: string): Promise<void> {
  const room = rooms.get(channelId);
  if (room === undefined) return;
  const sockets = await io.in(channelId).fetchSockets();
  for (const socket of sockets) {
    const data = socket.data as SocketData;
    if (data.seat === undefined) continue;
    socket.emit("state", viewFor(room, data.seat));
  }
}

function errorCode(err: unknown): string {
  return err instanceof Error ? err.message : "UNKNOWN";
}

io.on("connection", (socket) => {
  socket.emit("hello", { message: "server ready" });

  // Identitas diverifikasi lewat token Discord. Kursi diisi dari anggota Activity yang dikirim klien.
  socket.on(
    "join_channel",
    async (
      payload: { channelId: string; accessToken: string; participantIds: string[] },
      ack: (res: object) => void,
    ) => {
      try {
        const userId = await verifyDiscordUserId(payload.accessToken);
        let room = rooms.get(payload.channelId);
        if (room === undefined || room.status === "finished" || room.status === "cancelled") {
          if (payload.participantIds.length !== 4) throw new Error("NOT_ENOUGH_PLAYERS");
          // Pembuat ruang harus termasuk dalam daftar peserta, supaya tidak membuat ruang untuk orang lain.
          if (!payload.participantIds.includes(userId)) throw new Error("NOT_SEATED");
          const channelId = payload.channelId;
          room = createRoom(payload.participantIds, {
            target: TARGET_SCORE,
            disconnectTimeoutMs: DISCONNECT_TIMEOUT_MS,
            onChange: () => void broadcast(channelId),
          });
          rooms.set(channelId, room);
        }

        const seat = room.seats.indexOf(userId);
        if (seat === -1) throw new Error("NOT_SEATED");

        const data = socket.data as SocketData;
        data.channelId = payload.channelId;
        data.seat = seat as PlayerId;
        void socket.join(payload.channelId);
        room.onReconnect(seat as PlayerId);
        socket.emit("state", viewFor(room, seat as PlayerId));
        ack({ ok: true });
      } catch (err) {
        ack({ ok: false, error: errorCode(err) });
      }
    },
  );

  socket.on("intent", (intent: Intent, ack: (res: object) => void) => {
    const data = socket.data as SocketData;
    if (data.channelId === undefined || data.seat === undefined) return ack({ ok: false, error: "NOT_JOINED" });
    const room = rooms.get(data.channelId);
    if (room === undefined) return ack({ ok: false, error: "ROOM_NOT_FOUND" });
    try {
      room.handle(data.seat, intent);
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: errorCode(err) });
    }
  });

  socket.on("disconnect", () => {
    const data = socket.data as SocketData;
    if (data.channelId === undefined || data.seat === undefined) return;
    rooms.get(data.channelId)?.onDisconnect(data.seat);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server listening on port ${PORT}`);
});
