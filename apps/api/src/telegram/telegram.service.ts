import { Injectable } from "@nestjs/common";
import { PrismaService } from "@telegram-hub/database";
import { randomUUID } from "crypto";
import { extname, resolve } from "path";
import { BotsService } from "../bots/bots.service";
import { ChatsService } from "../chats/chats.service";
import { MessagesService } from "../messages/messages.service";
import { TelegramUpdate } from "./telegram.types";

@Injectable()
export class TelegramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bots: BotsService,
    private readonly chats: ChatsService,
    private readonly messages: MessagesService
  ) {}

  async verifySecret(botId: string, secret?: string) {
    const bot = await this.prisma.bot.findUnique({ where: { id: botId } });
    return Boolean(bot && bot.webhookSecret === secret && bot.isActive);
  }

  async handleUpdate(botId: string, update: TelegramUpdate) {
    const updateId = String(update.update_id);
    const existing = await this.prisma.message.findUnique({ where: { telegramUpdateId: updateId } });
    if (existing) return { ok: true, duplicate: true };

    const telegramMessage = update.message ?? update.channel_post;
    if (!telegramMessage) return { ok: true, ignored: true };
    const text = telegramMessage.text ?? telegramMessage.caption;
    const photo = telegramMessage.photo?.at(-1);
    const document = telegramMessage.document;
    const telegramFileId = document?.file_id ?? photo?.file_id;
    const fileName = document?.file_name ?? (photo ? `telegram-photo-${telegramMessage.message_id}.jpg` : undefined);
    const mimeType = document?.mime_type ?? (photo ? "image/jpeg" : undefined);
    const fileSize = document?.file_size ?? photo?.file_size;
    const type = telegramMessage.text?.startsWith("/")
      ? "COMMAND"
      : photo
        ? "PHOTO"
        : document
          ? "DOCUMENT"
          : text
            ? "TEXT"
            : "UNSUPPORTED";
    const activityAt = telegramMessage.date ? new Date(telegramMessage.date * 1000) : new Date();

    const chat = await this.chats.upsert({
      botId,
      telegramChatId: String(telegramMessage.chat.id),
      type: telegramMessage.chat.type?.toUpperCase() === "PRIVATE" ? "PRIVATE" : telegramMessage.chat.type?.toUpperCase(),
      firstName: telegramMessage.chat.title ?? telegramMessage.chat.first_name ?? telegramMessage.from?.first_name,
      lastName: telegramMessage.chat.last_name ?? telegramMessage.from?.last_name,
      username: telegramMessage.chat.username ?? telegramMessage.from?.username,
      activityAt
    });

    let localFilePath: string | undefined;
    if (telegramFileId) {
      const extension = extname(fileName ?? "") || (type === "PHOTO" ? ".jpg" : "");
      const targetPath = resolve(process.cwd(), "../../storage/uploads/inbound", `${Date.now()}-${randomUUID()}${extension}`);
      try {
        const downloaded = await this.bots.downloadTelegramFile(botId, telegramFileId, targetPath);
        localFilePath = downloaded.localFilePath;
      } catch {
        localFilePath = undefined;
      }
    }

    const inbound = await this.messages.saveInbound({
      chatId: chat.id,
      telegramUpdateId: updateId,
      telegramMessageId: String(telegramMessage.message_id),
      content: text,
      type,
      telegramFileId,
      fileName,
      mimeType,
      fileSize,
      localFilePath,
      telegramCreatedAt: activityAt,
      fromBot: telegramMessage.from?.is_bot
    });

    if (inbound.created && (text === "/start" || text === "/help")) {
      const content =
        text === "/start"
          ? "Halo, pesan Anda sudah diterima. Admin akan membalas melalui dashboard."
          : "Kirim pesan teks di sini, dan admin akan membantu Anda.";
      await this.messages.send(chat.id, content, `command-${updateId}`, "system");
    }

    return { ok: true };
  }

  async syncUpdates(botId: string) {
    const { token } = await this.bots.tokenFor(botId);
    const offsetKey = `telegram.poll.offset.${botId}`;
    const storedOffset = await this.prisma.appSetting.findUnique({ where: { key: offsetKey } });
    const offset = storedOffset ? Number(storedOffset.value) : undefined;

    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        offset,
        limit: 25,
        timeout: 0,
        allowed_updates: ["message", "channel_post"]
      })
    });
    const payload = (await response.json()) as { ok: boolean; result?: TelegramUpdate[]; description?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.description ?? "Telegram getUpdates gagal");
    }

    const updates = payload.result ?? [];
    let processed = 0;
    let maxUpdateId = offset ?? 0;
    for (const update of updates) {
      await this.handleUpdate(botId, update);
      processed += 1;
      const updateId = Number(update.update_id);
      if (Number.isFinite(updateId)) maxUpdateId = Math.max(maxUpdateId, updateId + 1);
    }

    if (processed > 0) {
      await this.prisma.appSetting.upsert({
        where: { key: offsetKey },
        update: { value: String(maxUpdateId) },
        create: { key: offsetKey, value: String(maxUpdateId) }
      });
    }

    return { processed, nextOffset: processed > 0 ? maxUpdateId : offset ?? null };
  }
}
