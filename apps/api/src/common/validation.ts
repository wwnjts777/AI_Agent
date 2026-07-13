export const MESSAGE_LIMIT = 4096;

export function displayName(firstName?: string | null, lastName?: string | null, username?: string | null) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || (username ? `@${username}` : "Pengguna Telegram");
}
