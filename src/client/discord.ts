import { DiscordSDK } from "@discord/embedded-app-sdk";

export interface DiscordSession {
  channelId: string;
  accessToken: string;
  participantIds: string[];
}

// Alur: ready -> authorize (kode) -> tukar kode di server kita -> authenticate.
export async function connectDiscord(): Promise<DiscordSession> {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  if (!clientId) throw new Error("MISSING_CLIENT_ID");

  const sdk = new DiscordSDK(clientId);
  await sdk.ready();

  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });

  // Discord meneruskan /.proxy/* ke server kita (lihat URL mapping di Developer Portal).
  const tokenResponse = await fetch("/.proxy/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!tokenResponse.ok) throw new Error("TOKEN_EXCHANGE_FAILED");
  const { access_token } = (await tokenResponse.json()) as { access_token: string };

  const auth = await sdk.commands.authenticate({ access_token });
  if (sdk.channelId === null) throw new Error("NO_CHANNEL");
  const { participants } = await sdk.commands.getInstanceConnectedParticipants();

  return {
    channelId: sdk.channelId,
    accessToken: auth.access_token,
    participantIds: participants.map((p) => p.id),
  };
}
