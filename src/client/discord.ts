import { DiscordSDK } from "@discord/embedded-app-sdk";

export interface DiscordSession {
  // ID peluncuran Activity. Baru untuk setiap peluncuran, dan dipakai server untuk memverifikasi peserta.
  instanceId: string;
  accessToken: string;
}

// Alur: ready -> authorize (kode) -> tukar kode di server kita -> authenticate.
// onStep dipanggil di setiap langkah, supaya macet di langkah mana pun kelihatan di layar.
export async function connectDiscord(onStep: (message: string) => void): Promise<DiscordSession> {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  if (!clientId) throw new Error("MISSING_CLIENT_ID");

  onStep("Menunggu handshake dengan Discord (ready)...");
  const sdk = new DiscordSDK(clientId);
  await sdk.ready();

  onStep("Menunggu izin di Discord (authorize)...");
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });

  onStep("Menukar kode menjadi token...");
  // Root mapping "/" di Developer Portal meneruskan /api/token ke server Next.
  const tokenResponse = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!tokenResponse.ok) throw new Error("TOKEN_EXCHANGE_FAILED");
  const { access_token } = (await tokenResponse.json()) as { access_token: string };

  onStep("Autentikasi pengguna...");
  const auth = await sdk.commands.authenticate({ access_token });

  return { instanceId: sdk.instanceId, accessToken: auth.access_token };
}
