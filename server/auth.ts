const DISCORD_ME_URL = "https://discord.com/api/users/@me";

// Identitas pemain diambil dari Discord, bukan dari klien. Token yang tidak valid ditolak.
export async function verifyDiscordUserId(accessToken: string): Promise<string> {
  const response = await fetch(DISCORD_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("INVALID_TOKEN");
  const user = (await response.json()) as { id: string };
  return user.id;
}
