// Profil pemain dari Discord: nama dan avatar. Dipanggil Worker memakai bot token.
export interface PlayerProfile {
  name: string;
  avatarUrl: string;
}

const API = "https://discord.com/api/v10";

// Avatar default Discord untuk user tanpa foto profil. Dipilih dari ID user, seperti di Discord.
export function defaultAvatarUrl(userId: string): string {
  const index = Number((BigInt(userId) >> BigInt(22)) % BigInt(6));
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

// Nama dan avatar user. Kalau gagal diambil, pakai nama umum dan avatar default supaya meja tetap tampil.
export async function fetchProfile(userId: string, botToken: string): Promise<PlayerProfile> {
  const fallback = { name: "Pemain", avatarUrl: defaultAvatarUrl(userId) };
  try {
    const res = await fetch(`${API}/users/${userId}`, { headers: { Authorization: `Bot ${botToken}` } });
    if (!res.ok) return fallback;
    const user = (await res.json()) as { id: string; username: string; global_name?: string | null; avatar?: string | null };
    return {
      name: user.global_name ?? user.username,
      avatarUrl: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
        : defaultAvatarUrl(userId),
    };
  } catch {
    return fallback;
  }
}
