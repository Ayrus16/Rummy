import type { PlayerView } from "./view";

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

// Kode error dari server (misal NOT_SEATED) dikirim apa adanya. Error lain disamarkan jadi UNKNOWN.
export async function respond(run: () => Promise<PlayerView>): Promise<Response> {
  try {
    return Response.json(await run());
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!/^[A-Z_]+$/.test(message)) return Response.json({ error: "UNKNOWN" }, { status: 500 });
    const status = message === "INVALID_TOKEN" ? 401 : message === "ROOM_NOT_FOUND" ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}

export function unauthorized(): Response {
  return Response.json({ error: "INVALID_TOKEN" }, { status: 401 });
}
