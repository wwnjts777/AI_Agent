const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export function apiUrl() {
  if (typeof window === "undefined") return CONFIGURED_API_URL;
  try {
    const url = new URL(CONFIGURED_API_URL);
    const currentHost = window.location.hostname;
    const configuredHost = url.hostname;
    if (currentHost && currentHost !== configuredHost) {
      url.hostname = currentHost;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return CONFIGURED_API_URL;
  }
}

export type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      ...init,
      credentials: "include",
      headers: isFormData
        ? init.headers
        : {
            "content-type": "application/json",
            ...(init.headers ?? {})
          }
    });
  } catch {
    throw new Error(`Tidak bisa terhubung ke API ${apiUrl()}. Pastikan server API berjalan di port 3001.`);
  }
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !body.success) {
    throw new Error("error" in body ? body.error.message : "Request gagal");
  }
  return body.data;
}

export type User = { id: string; email: string; name: string; role: string };
export type Message = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: "TEXT" | "COMMAND" | "PHOTO" | "DOCUMENT" | "UNSUPPORTED";
  content?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  localFilePath?: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
};
export type Chat = {
  id: string;
  botId: string;
  telegramChatId: string;
  type: string;
  displayName?: string;
  username?: string;
  lastMessageAt?: string;
  unreadCount: number;
  lastMessage?: Message | null;
  bot?: Pick<Bot, "id" | "name" | "username" | "isActive">;
};
export type Bot = {
  id: string;
  name: string;
  username?: string;
  tokenMasked?: string;
  webhookUrl?: string;
  isActive: boolean;
  lastCheckedAt?: string;
};

export type AiAgent = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  modelId: string;
  apiKeyMasked?: string;
  isActive: boolean;
  workspaceAccess: boolean;
  workspaceRoot?: string;
  lastCheckedAt?: string;
  lastError?: string;
  sample?: string;
};
