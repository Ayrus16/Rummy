// Menukar kode OAuth dari Discord menjadi access token. Client secret hanya ada di server.
export async function POST(request: Request) {
  const { code } = (await request.json()) as { code?: unknown };
  if (typeof code !== "string") {
    return Response.json({ error: "BAD_CODE" }, { status: 400 });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({ error: "MISSING_DISCORD_CREDENTIALS" }, { status: 500 });
  }

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!response.ok) {
    return Response.json({ error: "TOKEN_EXCHANGE_FAILED" }, { status: 502 });
  }

  const { access_token } = (await response.json()) as { access_token: string };
  return Response.json({ access_token });
}
