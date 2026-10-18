import { bearerToken, respond, unauthorized } from "../../../../server/http";
import type { Intent } from "../../../../server/room";
import { act } from "../../../../server/service";

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (token === null) return unauthorized();
  const body = (await request.json()) as { channelId?: unknown; intent?: Intent };
  if (typeof body.channelId !== "string" || typeof body.intent?.type !== "string") {
    return Response.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  const channelId = body.channelId;
  const intent = body.intent;
  return respond(() => act(token, channelId, intent));
}
