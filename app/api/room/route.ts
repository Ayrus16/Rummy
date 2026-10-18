import { bearerToken, respond, unauthorized } from "../../../server/http";
import { poll } from "../../../server/service";

// Polling state ruang. channelId dibaca dari query string, token dari header Authorization.
export async function GET(request: Request) {
  const token = bearerToken(request);
  if (token === null) return unauthorized();
  const channelId = new URL(request.url).searchParams.get("channelId");
  if (channelId === null) return Response.json({ error: "BAD_REQUEST" }, { status: 400 });
  return respond(() => poll(token, channelId));
}
