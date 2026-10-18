import { DiscordSDK } from "@discord/embedded-app-sdk";

const REDIRECT_URI = "https://remi-indo.vercel.app";

export interface DiscordSession {
  // ID peluncuran Activity. Baru untuk setiap peluncuran, dan dipakai server untuk memverifikasi peserta.
  instanceId: string;
  accessToken: string;
}

// Alur: ready -> authorize (kode) -> tukar kode di server kita -> authenticate.
// onStep dipanggil di setiap langkah, supaya macet di langkah mana pun kelihatan di layar.
// Error dari SDK sering berupa objek biasa, jadi langkah terakhir dan detailnya ikut dilaporkan.
export async function connectDiscord(onStep: (message: string) => void): Promise<DiscordSession> {
  let step = "Memulai";
  const at = (message: string) => {
    step = message;
    onStep(message);
  };

  try {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
    if (!clientId) throw new Error("MISSING_CLIENT_ID");

    at("Menunggu handshake dengan Discord (ready)...");
    const sdk = new DiscordSDK(clientId);
    await sdk.ready();

    at("Menunggu izin di Discord (authorize)...");
    // Discord menolak request tanpa redirect_uri. Nilainya harus sama dengan yang terdaftar di OAuth2 -> Redirects.
    // Tipe SDK tidak memuat field ini, jadi request disimpan di variabel dulu (tidak kena cek properti berlebih).
    const request = {
      client_id: clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify"],
      redirect_uri: REDIRECT_URI,
    };
    const { code } = await sdk.commands.authorize(request);

    at("Menukar kode menjadi token...");
    // Root mapping "/" di Developer Portal meneruskan /api/token ke server Next.
    const tokenResponse = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!tokenResponse.ok) throw new Error(`TOKEN_EXCHANGE_FAILED (HTTP ${tokenResponse.status})`);
    const { access_token } = (await tokenResponse.json()) as { access_token: string };

    at("Autentikasi pengguna...");
    const auth = await sdk.commands.authenticate({ access_token });

    return { instanceId: sdk.instanceId, accessToken: auth.access_token };
  } catch (err) {
    throw new Error(`${step} | ${describeError(err)}`);
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) return JSON.stringify(err);
  return String(err);
}
