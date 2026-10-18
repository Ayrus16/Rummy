import { DurableObject } from "cloudflare:workers";
import type { PlayerId } from "../src/rules/opening";
import { verifyDiscordUserId } from "../server/auth";
import { BOT_PREFIX, createRoom, Room, type Intent, type RoomOptions, type RoomSnapshot } from "../server/room";
import { viewFor } from "../server/view";

export interface Env {
  TABLE: DurableObjectNamespace<Table>;
  DISCORD_APPLICATION_ID: string;
  // Secret: wrangler secret put DISCORD_BOT_TOKEN
  DISCORD_BOT_TOKEN: string;
}

type Attachment = { userId: string; seat: PlayerId };

type ClientMessage =
  | { type: "hello"; token: string; instanceId: string; addBots: boolean }
  | { type: "intent"; intent: Intent };

const ID_RE = /^[\w.:-]{1,200}$/;
const ROOM_OPTIONS: RoomOptions = { target: 1000, disconnectTimeoutMs: 60_000 };

// Tepat 4 kursi. Kursi kosong diisi bot hanya jika diminta (untuk testing).
function fillSeats(members: string[], addBots: boolean): string[] {
  if (members.length > 4) throw new Error("TOO_MANY_PLAYERS");
  if (members.length === 4) return members;
  if (!addBots) throw new Error("NOT_ENOUGH_PLAYERS");
  const bots = Array.from({ length: 4 - members.length }, (_, i) => `${BOT_PREFIX}${i + 1}`);
  return [...members, ...bots];
}

function errorOf(err: unknown): string {
  return err instanceof Error ? err.message : "UNKNOWN";
}

function parseMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const msg = data as Partial<Extract<ClientMessage, { type: "hello" }>> & Partial<Extract<ClientMessage, { type: "intent" }>>;
  if (msg.type === "hello" && typeof msg.token === "string" && typeof msg.instanceId === "string") {
    return msg as Extract<ClientMessage, { type: "hello" }>;
  }
  if (msg.type === "intent" && typeof msg.intent === "object" && msg.intent !== null) {
    return msg as Extract<ClientMessage, { type: "intent" }>;
  }
  return null;
}

// Satu Durable Object per peluncuran Activity (instanceId). State ruang disimpan di storage,
// dan timer bot serta batas putus pakai alarm.
export class Table extends DurableObject<Env> {
  async fetch(): Promise<Response> {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string") return;
    const msg = parseMessage(raw);
    if (msg === null) return;
    const attachment = ws.deserializeAttachment() as Attachment | null;

    if (msg.type === "hello") {
      if (attachment === null) await this.hello(ws, msg);
      return;
    }
    if (attachment === null) return; // belum hello: intent diabaikan
    await this.intent(ws, attachment.seat, msg.intent);
  }

  async webSocketClose(ws: WebSocket) {
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (attachment === null) return;
    const room = await this.load();
    if (room === null) return;
    room.disconnect(attachment.seat);
    await this.commit(room);
  }

  async alarm() {
    const room = await this.load();
    if (room === null) return;
    room.tick();
    await this.commit(room);
  }

  private async hello(ws: WebSocket, msg: Extract<ClientMessage, { type: "hello" }>) {
    let userId: string;
    try {
      userId = await verifyDiscordUserId(msg.token);
    } catch {
      ws.close(4001, "INVALID_TOKEN");
      return;
    }

    // Dua tab dengan akun yang sama: tab lama ditutup. Attachment dikosongkan dulu supaya tidak memicu disconnect.
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue;
      const otherAttachment = other.deserializeAttachment() as Attachment | null;
      if (otherAttachment?.userId === userId) {
        other.serializeAttachment(null);
        other.close(4002, "REPLACED_BY_OTHER_TAB");
      }
    }

    // Durable Object ini milik satu instanceId. Klien tidak boleh masuk dengan instanceId lain.
    const bound = await this.ctx.storage.get<string>("instanceId");
    if (bound !== undefined && bound !== msg.instanceId) return this.reject(ws, "INSTANCE_MISMATCH");

    let room = await this.load();
    const seated = room !== null && room.seats.includes(userId);
    try {
      if (room === null || room.status === "finished" || room.status === "cancelled") {
        // Peserta diambil dari Discord, bukan dari klien. Hanya anggota instance yang boleh membuat meja.
        const members = await this.instanceMembers(msg.instanceId);
        if (!members.includes(userId)) return this.reject(ws, "NOT_SEATED");
        room = createRoom(fillSeats(members, msg.addBots === true), ROOM_OPTIONS);
        await this.ctx.storage.put("instanceId", msg.instanceId);
      } else if (!seated) {
        const members = await this.instanceMembers(msg.instanceId);
        if (!members.includes(userId)) return this.reject(ws, "NOT_SEATED");
      }
    } catch (err) {
      return this.reject(ws, errorOf(err));
    }
    room!.tick();

    const existing = room!.seats.indexOf(userId);
    let seat: PlayerId;
    if (existing !== -1) {
      seat = existing as PlayerId;
    } else {
      const claimed = room!.claimBotSeat(userId);
      if (claimed === null) return this.reject(ws, "NOT_SEATED");
      seat = claimed;
    }
    ws.serializeAttachment({ userId, seat } satisfies Attachment);
    room!.connect(seat);
    await this.commit(room!);
  }

  private async intent(ws: WebSocket, seat: PlayerId, intent: Intent) {
    const loaded = await this.load();
    if (loaded === null) return ws.send(JSON.stringify({ type: "error", error: "ROOM_NOT_FOUND" }));
    // Reset membuat ruang baru dengan kursi yang sama (termasuk bot dan pemain yang sudah masuk).
    if (intent.type === "reset") {
      if (seat !== 0) return ws.send(JSON.stringify({ type: "error", error: "RESET_NOT_ALLOWED" }));
      return this.commit(createRoom([...loaded.seats], ROOM_OPTIONS));
    }
    const room = loaded;
    room.tick();
    let error: string | null = null;
    try {
      room.handle(seat, intent);
    } catch (err) {
      error = errorOf(err);
    }
    // Commit tetap dijalankan walaupun intent ditolak, karena tick() bisa sudah mengubah state.
    await this.commit(room);
    if (error !== null) ws.send(JSON.stringify({ type: "error", error }));
  }

  private reject(ws: WebSocket, error: string) {
    ws.send(JSON.stringify({ type: "error", error }));
    ws.close(4003, error);
  }

  // Daftar user ID yang sedang terhubung ke instance ini, dari REST Discord (butuh bot token).
  private async instanceMembers(instanceId: string): Promise<string[]> {
    const url = `https://discord.com/api/v10/applications/${this.env.DISCORD_APPLICATION_ID}/activity-instances/${instanceId}`;
    const res = await fetch(url, { headers: { Authorization: `Bot ${this.env.DISCORD_BOT_TOKEN}` } });
    if (!res.ok) throw new Error("INSTANCE_NOT_FOUND");
    const body = (await res.json()) as { users?: (string | { id: string })[] };
    return (body.users ?? []).map((u) => (typeof u === "string" ? u : u.id));
  }

  private async load(): Promise<Room | null> {
    const snapshot = await this.ctx.storage.get<RoomSnapshot>("room");
    return snapshot === undefined ? null : Room.restore(snapshot, ROOM_OPTIONS);
  }

  // Simpan state, kirim view ke tiap pemain, dan jadwalkan alarm berikutnya.
  private async commit(room: Room) {
    await this.ctx.storage.put("room", room.snapshot());
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (attachment === null) continue;
      ws.send(JSON.stringify({ type: "state", view: viewFor(room, attachment.seat) }));
    }
    const deadline = room.nextDeadline();
    if (deadline === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(deadline);
  }
}

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const match = new URL(req.url).pathname.match(/^(?:\/ws)?\/room\/([^/]+)\/?$/);
    if (!match || !ID_RE.test(match[1])) {
      const pair = new WebSocketPair();
      pair[1].accept();
      pair[1].close(4003, "ROOM_NOT_FOUND");
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return env.TABLE.get(env.TABLE.idFromName(match[1])).fetch(req);
  },
};

export default worker;
