import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@telegram-hub/database";
import { randomBytes } from "crypto";
import { readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import { mkdir } from "fs/promises";
import { AuditService } from "../audit/audit.service";
import { EventsService } from "../events/events.service";
import { CreateBotDto, UpdateBotDto } from "./bots.dto";
import { TelegramHttpService } from "./telegram-http.service";
import { TokenCryptoService } from "./token-crypto.service";

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: TokenCryptoService,
    private readonly telegram: TelegramHttpService,
    private readonly audit: AuditService,
    private readonly events: EventsService
  ) {}

  private safe(bot: {
    id: string;
    name: string;
    telegramBotId: string | null;
    username: string | null;
    tokenLast4: string | null;
    webhookSecret: string;
    webhookUrl: string | null;
    isActive: boolean;
    lastCheckedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: bot.id,
      name: bot.name,
      telegramBotId: bot.telegramBotId,
      username: bot.username,
      webhookUrl: bot.webhookUrl,
      isActive: bot.isActive,
      lastCheckedAt: bot.lastCheckedAt,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
      tokenMasked: this.crypto.mask(bot.tokenLast4)
    };
  }

  async list() {
    const bots = await this.prisma.bot.findMany({ orderBy: { createdAt: "desc" } });
    return bots.map((bot) => this.safe(bot));
  }

  async get(id: string) {
    const bot = await this.prisma.bot.findUnique({ where: { id } });
    if (!bot) throw new NotFoundException({ code: "BOT_NOT_FOUND", message: "Bot tidak ditemukan." });
    return this.safe(bot);
  }

  async create(dto: CreateBotDto, actorUserId: string) {
    const encrypted = this.crypto.encrypt(dto.token);
    const bot = await this.prisma.bot.create({
      data: {
        name: dto.name,
        ...encrypted,
        webhookSecret: randomBytes(32).toString("hex")
      }
    });
    await this.audit.record({ actorUserId, action: "bot.create", targetType: "Bot", targetId: bot.id });
    return this.safe(bot);
  }

  async update(id: string, dto: UpdateBotDto, actorUserId: string) {
    const encrypted = dto.token ? this.crypto.encrypt(dto.token) : {};
    const bot = await this.prisma.bot.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive, ...encrypted }
    });
    await this.audit.record({ actorUserId, action: "bot.update", targetType: "Bot", targetId: bot.id });
    return this.safe(bot);
  }

  async tokenFor(id: string) {
    const bot = await this.prisma.bot.findUnique({ where: { id } });
    if (!bot) throw new NotFoundException({ code: "BOT_NOT_FOUND", message: "Bot tidak ditemukan." });
    return { bot, token: this.crypto.decrypt(bot) };
  }

  async test(id: string) {
    const { bot, token } = await this.tokenFor(id);
    const result = (await this.telegram.call(token, "getMe")) as { id: number; username?: string };
    const updated = await this.prisma.bot.update({
      where: { id },
      data: {
        telegramBotId: String(result.id),
        username: result.username,
        lastCheckedAt: new Date()
      }
    });
    this.events.emit("bot.status", { id, ok: true });
    return this.safe(updated);
  }

  async setWebhook(id: string, actorUserId: string) {
    const { bot, token } = await this.tokenFor(id);
    const webhookUrl = `${process.env.API_PUBLIC_URL}/api/v1/webhooks/telegram/${id}`;
    await this.telegram.call(token, "setWebhook", {
      url: webhookUrl,
      secret_token: bot.webhookSecret,
      allowed_updates: ["message", "channel_post"]
    });
    const updated = await this.prisma.bot.update({ where: { id }, data: { webhookUrl } });
    await this.audit.record({ actorUserId, action: "bot.webhook.set", targetType: "Bot", targetId: id });
    return this.safe(updated);
  }

  async getWebhookInfo(id: string) {
    const { token } = await this.tokenFor(id);
    return this.telegram.call(token, "getWebhookInfo");
  }

  async deleteWebhook(id: string, actorUserId: string) {
    const { token } = await this.tokenFor(id);
    await this.telegram.call(token, "deleteWebhook", { drop_pending_updates: false });
    const updated = await this.prisma.bot.update({ where: { id }, data: { webhookUrl: null } });
    await this.audit.record({ actorUserId, action: "bot.webhook.delete", targetType: "Bot", targetId: id });
    return this.safe(updated);
  }

  async sendMessage(botId: string, chatId: string, text: string) {
    const { token } = await this.tokenFor(botId);
    return this.telegram.call(token, "sendMessage", { chat_id: chatId, text });
  }

  async sendFile(input: {
    botId: string;
    chatId: string;
    filePath: string;
    fileName: string;
    mimeType?: string;
    caption?: string;
    type: "PHOTO" | "DOCUMENT";
  }) {
    const { token } = await this.tokenFor(input.botId);
    const makeForm = (fieldName: "photo" | "document") => {
      const form = new FormData();
      form.set("chat_id", input.chatId);
      if (input.caption) form.set("caption", input.caption);
      return readFile(input.filePath).then((bytes) => {
        const blob = new Blob([bytes], { type: input.mimeType ?? "application/octet-stream" });
        form.set(fieldName, blob, input.fileName);
        return form;
      });
    };

    if (input.type === "PHOTO") {
      try {
        return await this.telegram.callForm(token, "sendPhoto", () => makeForm("photo"));
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("IMAGE_PROCESS_FAILED")) throw error;
        return this.telegram.callForm(token, "sendDocument", () => makeForm("document"));
      }
    }

    return this.telegram.callForm(token, "sendDocument", () => makeForm("document"));
  }

  async downloadTelegramFile(botId: string, telegramFileId: string, targetPath: string) {
    const { token } = await this.tokenFor(botId);
    const file = (await this.telegram.call(token, "getFile", { file_id: telegramFileId })) as { file_path?: string };
    if (!file.file_path) throw new Error("Telegram file path tidak tersedia");
    const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    if (!response.ok) throw new Error("Download file Telegram gagal");
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, Buffer.from(await response.arrayBuffer()));
    return { telegramPath: file.file_path, localFilePath: targetPath };
  }
}
