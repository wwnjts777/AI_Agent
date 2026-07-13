import { Injectable } from "@nestjs/common";

type TelegramJsonResponse = { ok: boolean; result?: unknown; description?: string };
type FormDataInput = FormData | (() => FormData | Promise<FormData>);

@Injectable()
export class TelegramHttpService {
  private retryDelay(attempt: number) {
    return new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }

  private isRetryable(error: unknown) {
    if (!(error instanceof Error)) return false;
    return [
      "fetch failed",
      "This operation was aborted",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "EAI_AGAIN",
      "UND_ERR"
    ].some((message) => error.message.includes(message));
  }

  private async withRetry<T>(operation: () => Promise<T>) {
    const attempts = Number(process.env.TELEGRAM_REQUEST_RETRIES ?? 3);
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt >= attempts || !this.isRetryable(error)) throw error;
        await this.retryDelay(attempt);
      }
    }
    throw lastError;
  }

  async call(token: string, method: string, body?: Record<string, unknown>) {
    return this.withRetry(async () => {
      const timeout = Number(process.env.TELEGRAM_REQUEST_TIMEOUT_MS ?? 10000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });
        const json = (await response.json()) as TelegramJsonResponse;
        if (!response.ok || !json.ok) {
          throw new Error(json.description ?? "Telegram request failed");
        }
        return json.result;
      } finally {
        clearTimeout(timer);
      }
    });
  }

  async callForm(token: string, method: string, formInput: FormDataInput) {
    return this.withRetry(async () => {
      const form = typeof formInput === "function" ? await formInput() : formInput;
      const timeout = Number(process.env.TELEGRAM_UPLOAD_TIMEOUT_MS ?? process.env.TELEGRAM_REQUEST_TIMEOUT_MS ?? 60000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: "POST",
          body: form,
          signal: controller.signal
        });
        const json = (await response.json()) as TelegramJsonResponse;
        if (!response.ok || !json.ok) {
          throw new Error(json.description ?? "Telegram request failed");
        }
        return json.result;
      } finally {
        clearTimeout(timer);
      }
    });
  }
}
