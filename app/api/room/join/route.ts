import { bearerToken, respond, unauthorized } from "../../../../server/http";
import { join } from "../../../../server/service";

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (token === null) return unauthorized();
  const body = (await request.json()) as { channelId?: unknown; participantIds?: unknown; addBots?: unknown };
  if (typeof body.channelId !== "string" || !Array.isArray(body.participantIds)) {
    return Response.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  const participantIds = body.participantIds as string[];
  return respond(() => join(token, body.channelId as string, participantIds, body.addBots === true));
}
