import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type { PlayerId } from "../src/rules/opening";
import { createRoom, type Intent, type Room } from "./room";
import { viewFor } from "./view";

const PORT = Number(process.env.PORT ?? 4000);
const DISCONNECT_TIMEOUT_MS = Number(process.env.DISCONNECT_TIMEOUT_MS ?? 60_000);
const DEFAULT_TARGET = 1000;

const rooms = new Map<string, Room>();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// Identitas pemain masih dari klien (userId). Verifikasi Discord dikerjakan di Task 9.
interface SocketData {
  roomId?: string;
  seat?: PlayerId;
}

async function broadcast(roomId: string): Promise<void> {
  const room = rooms.get(roomId);
  if (room === undefined) return;
  const sockets = await io.in(roomId).fetchSockets();
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

  socket.on("create_room", (payload: { seats: string[]; target?: number }, ack: (res: object) => void) => {
    try {
      const roomId = randomUUID();
      const room = createRoom(payload.seats, {
        target: payload.target ?? DEFAULT_TARGET,
        disconnectTimeoutMs: DISCONNECT_TIMEOUT_MS,
        onChange: () => void broadcast(roomId),
      });
      rooms.set(roomId, room);
      ack({ ok: true, roomId });
    } catch (err) {
      ack({ ok: false, error: errorCode(err) });
    }
  });

  socket.on("join_room", (payload: { roomId: string; userId: string }, ack: (res: object) => void) => {
    const room = rooms.get(payload.roomId);
    if (room === undefined) return ack({ ok: false, error: "ROOM_NOT_FOUND" });
    const seat = room.seats.indexOf(payload.userId);
    if (seat === -1) return ack({ ok: false, error: "NOT_SEATED" });

    const data = socket.data as SocketData;
    data.roomId = payload.roomId;
    data.seat = seat as PlayerId;
    void socket.join(payload.roomId);
    room.onReconnect(seat as PlayerId);
    socket.emit("state", viewFor(room, seat as PlayerId));
    ack({ ok: true });
  });

  socket.on("intent", (intent: Intent, ack: (res: object) => void) => {
    const data = socket.data as SocketData;
    if (data.roomId === undefined || data.seat === undefined) return ack({ ok: false, error: "NOT_JOINED" });
    const room = rooms.get(data.roomId);
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
    if (data.roomId === undefined || data.seat === undefined) return;
    rooms.get(data.roomId)?.onDisconnect(data.seat);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server listening on port ${PORT}`);
});
