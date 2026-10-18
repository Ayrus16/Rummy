import { io, type Socket } from "socket.io-client";
import type { Intent } from "../../server/room";
import type { DiscordSession } from "./discord";

export interface Ack {
  ok: boolean;
  error?: string;
}

// NEXT_PUBLIC_SOCKET_URL berisi origin saja. Path dipisah karena Socket.IO menganggap
// path di URL sebagai namespace. Path ini juga dipakai server dan cocok dengan mapping /ws.
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";
export const SOCKET_PATH = "/ws/socket.io";

export function connectSocket(): Socket {
  return io(SOCKET_URL, { path: SOCKET_PATH, transports: ["websocket"] });
}

export function joinChannel(socket: Socket, session: DiscordSession, addBots: boolean): Promise<Ack> {
  return new Promise((resolve) => socket.emit("join_channel", { ...session, addBots }, resolve));
}

export function sendIntent(socket: Socket, intent: Intent): Promise<Ack> {
  return new Promise((resolve) => socket.emit("intent", intent, resolve));
}
