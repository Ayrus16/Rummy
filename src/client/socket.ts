import { io, type Socket } from "socket.io-client";
import type { Intent } from "../../server/room";
import type { DiscordSession } from "./discord";

export interface Ack {
  ok: boolean;
  error?: string;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

export function connectSocket(): Socket {
  return io(SOCKET_URL, { transports: ["websocket"] });
}

export function joinChannel(socket: Socket, session: DiscordSession, addBots: boolean): Promise<Ack> {
  return new Promise((resolve) => socket.emit("join_channel", { ...session, addBots }, resolve));
}

export function sendIntent(socket: Socket, intent: Intent): Promise<Ack> {
  return new Promise((resolve) => socket.emit("intent", intent, resolve));
}
