import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Message } from "@prisma/client";
import { PrismaService } from "@telegram-hub/database";
import { randomUUID } from "crypto";
import { existsSync, statSync } from "fs";
import { basename, resolve } from "path";
import { AiAgentsService } from "../ai-agents/ai-agents.service";
import { AuditService } from "../audit/audit.service";
import { BotsService } from "../bots/bots.service";
import { MESSAGE_LIMIT } from "../common/validation";
import { EventsService } from "../events/events.service";

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiAgents: AiAgentsService,
    private readonly bots: BotsService,
    private readonly audit: AuditService,
    private readonly events: EventsService
  ) {}

  private async recordAudit(input: Parameters<AuditService["record"]>[0]) {
    try {
      await this.audit.record(input);
    } catch {
      // Audit failure must not mark an already delivered Telegram message as failed.
    }
  }

  private async touchChat(chatId: string, activityAt = new Date()) {
    const chat = await this.prisma.telegramChat.update({
      where: { id: chatId },
      data: { lastMessageAt: activityAt }
    });
    this.events.emit("chat.updated", chat);
  }

  private messageTimelineAt(message: Pick<Message, "telegramCreatedAt" | "sentAt" | "createdAt">) {
    return message.telegramCreatedAt ?? message.sentAt ?? message.createdAt;
  }

  private async botAnswerFor(
    text: string,
    agentName?: string,
    conversationContext?: Array<{ role: "user" | "assistant"; content: string }>
  ) {
    const normalized = text.toLowerCase();
    if (normalized.includes("tanggal")) {
      const date = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta"
      }).format(new Date());
      return `Sekarang tanggal ${date}.`;
    }
    return this.aiAgents.answer(text, agentName, conversationContext);
  }

  private async conversationContext(chatId: string, excludeMessageId?: string) {
    const messages = await this.prisma.message.findMany({
      where: { chatId, ...(excludeMessageId ? { id: { not: excludeMessageId } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 24
    });
    const seen = new Set<string>();
    return messages
      .reverse()
      .filter((message) => {
        const content = message.content?.trim();
        if (!content || seen.has(content)) return false;
        seen.add(content);
        return true;
      })
      .map((message) => {
        const role = message.sentByUserId === "bot-interaction" ? "assistant" : "user";
        return { role, content: message.content?.trim() ?? "" } as const;
      });
  }

  private agentCommand(text: string) {
    const match = text.trim().match(/^(Agent_(?:A|B|C|AI))(?:\s+([\s\S]+))?$/i);
    if (!match) return undefined;
    const suffix = match[1].split("_")[1]?.toUpperCase();
    if (!suffix) return undefined;
    return { agentName: `Agent_${suffix}`, prompt: match[2]?.trim() };
  }

  private agentReadyAnswer(agentName: string) {
    return `${agentName} siap menerima perintah.`;
  }

  private chooseAgentAnswer() {
    return [
      "Agent tujuan belum disebutkan.",
      "Ulangi perintah dengan format: Agent_A <perintah>, Agent_B <perintah>, Agent_C <perintah>, atau Agent_AI <perintah>."
    ].join(" ");
  }

  private shouldTriggerBotInteraction(chatType: string, text: string) {
    if (["CHANNEL", "GROUP", "SUPERGROUP"].includes(chatType)) return true;
    return chatType === "PRIVATE" && Boolean(this.agentCommand(text));
  }

  private queueBotInteraction(input: Parameters<MessagesService["sendBotInteraction"]>[0]) {
    void this.sendBotInteraction(input).catch((error) => {
      // Bot interaction must not make the original dashboard send fail.
      console.error("Bot interaction failed", error);
    });
  }

  private async sendBotInteraction(input: {
    sourceMessageId: string;
    sourceTelegramMessageId?: string;
    telegramChatId: string;
    sourceBotId: string;
    text: string;
    actorUserId: string;
  }) {
    if (input.actorUserId === "bot-interaction") return;
    const command = this.agentCommand(input.text);

    const responder = await this.prisma.telegramChat.findFirst({
      where: command
        ? { telegramChatId: input.telegramChatId, bot: { name: command.agentName, isActive: true } }
        : { telegramChatId: input.telegramChatId, bot: { isActive: true } },
      orderBy: { createdAt: "asc" },
      include: { bot: { select: { name: true } } }
    });
    if (!responder) return;
    const answer =
      !command
        ? this.chooseAgentAnswer()
        : !command.prompt
          ? this.agentReadyAnswer(command.agentName)
          : await this.botAnswerFor(command.prompt, responder.bot.name, await this.conversationContext(responder.id, input.sourceMessageId));
    if (!answer) return;

    const clientRequestId = input.sourceTelegramMessageId
      ? `bot-reply-tg-${input.telegramChatId}-${input.sourceTelegramMessageId}-${responder.botId}`
      : `bot-reply-${input.sourceMessageId}-${responder.botId}`;
    const existing = await this.prisma.message.findUnique({ where: { clientRequestId } });
    if (existing) return;

    let reply = await this.prisma.message.create({
      data: {
        chatId: responder.id,
        clientRequestId,
        direction: "OUTBOUND",
        type: "TEXT",
        content: answer,
        status: "PENDING",
        sentByUserId: "bot-interaction"
      }
    });
    await this.touchChat(reply.chatId, reply.createdAt);
    this.events.emit("message.created", reply);

    try {
      reply = await this.prisma.message.update({ where: { id: reply.id }, data: { status: "SENDING" } });
      const result = (await this.bots.sendMessage(responder.botId, responder.telegramChatId, answer)) as { message_id?: number };
      reply = await this.prisma.message.update({
        where: { id: reply.id },
        data: {
          status: "SENT",
          telegramMessageId: result.message_id ? String(result.message_id) : undefined,
          sentAt: new Date()
        }
      });
      await this.recordAudit({
        action: "message.bot_interaction",
        targetType: "Message",
        targetId: reply.id
      });
    } catch (error) {
      reply = await this.prisma.message.update({
        where: { id: reply.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: "TELEGRAM_REQUEST_FAILED",
          errorMessage: error instanceof Error ? error.message : "Telegram API gagal"
        }
      });
    }
    this.events.emit("message.updated", reply);
  }

  async history(chatId: string, limit = 50, cursor?: string) {
    const messages = await this.prisma.message.findMany({
      where: { chatId },
      take: Math.min(limit, 100),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" }
    });
    return messages.sort((left, right) => {
      const leftTime = this.messageTimelineAt(left).getTime();
      const rightTime = this.messageTimelineAt(right).getTime();
      return leftTime - rightTime || left.createdAt.getTime() - right.createdAt.getTime();
    });
  }

  async saveInbound(input: {
    chatId: string;
    telegramUpdateId: string;
    telegramMessageId?: string;
    content?: string;
    type: string;
    telegramFileId?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    localFilePath?: string;
    telegramCreatedAt?: Date;
    fromBot?: boolean;
  }) {
    const existing = await this.prisma.message.findUnique({ where: { telegramUpdateId: input.telegramUpdateId } });
    if (existing) return { message: existing, created: false };
    const message = await this.prisma.message.create({
      data: {
        chatId: input.chatId,
        telegramUpdateId: input.telegramUpdateId,
        telegramMessageId: input.telegramMessageId,
        direction: "INBOUND",
        type: input.type,
        content: input.content,
        telegramFileId: input.telegramFileId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        localFilePath: input.localFilePath,
        status: "RECEIVED",
        telegramCreatedAt: input.telegramCreatedAt
      }
    });
    await this.touchChat(message.chatId, input.telegramCreatedAt ?? message.createdAt);
    this.events.emit("message.created", message);
    if (input.content && !input.fromBot) {
      const chat = await this.prisma.telegramChat.findUnique({ where: { id: input.chatId } });
      if (chat && ["CHANNEL", "GROUP", "SUPERGROUP", "PRIVATE"].includes(chat.type)) {
        await this.sendBotInteraction({
          sourceMessageId: message.id,
          sourceTelegramMessageId: input.telegramMessageId,
          telegramChatId: chat.telegramChatId,
          sourceBotId: chat.botId,
          text: input.content,
          actorUserId: "telegram-user"
        });
      }
    }
    return { message, created: true };
  }

  async send(chatId: string, text: string, clientRequestId: string, actorUserId: string) {
    if (!text.trim()) throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Pesan tidak boleh kosong." });
    if (text.length > MESSAGE_LIMIT) throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Pesan terlalu panjang." });

    const chat = await this.prisma.telegramChat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException({ code: "CHAT_NOT_FOUND", message: "Chat tidak ditemukan." });

    const existing = await this.prisma.message.findUnique({ where: { clientRequestId } });
    if (existing) return existing;

    let message = await this.prisma.message.create({
      data: {
        chatId,
        clientRequestId,
        direction: "OUTBOUND",
        type: "TEXT",
        content: text,
        status: "PENDING",
        sentByUserId: actorUserId
      }
    });
    await this.touchChat(message.chatId, message.createdAt);
    this.events.emit("message.created", message);

    try {
      message = await this.prisma.message.update({ where: { id: message.id }, data: { status: "SENDING" } });
      const result = (await this.bots.sendMessage(chat.botId, chat.telegramChatId, text)) as { message_id?: number };
      message = await this.prisma.message.update({
        where: { id: message.id },
        data: { status: "SENT", telegramMessageId: result.message_id ? String(result.message_id) : undefined, sentAt: new Date() }
      });
      await this.recordAudit({ actorUserId, action: "message.send", targetType: "Message", targetId: message.id });
      if (this.shouldTriggerBotInteraction(chat.type, text)) {
        this.queueBotInteraction({
          sourceMessageId: message.id,
          sourceTelegramMessageId: message.telegramMessageId ?? undefined,
          telegramChatId: chat.telegramChatId,
          sourceBotId: chat.botId,
          text,
          actorUserId
        });
      }
    } catch (error) {
      message = await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: "TELEGRAM_REQUEST_FAILED",
          errorMessage: error instanceof Error ? error.message : "Telegram API gagal"
        }
      });
    }
    this.events.emit("message.updated", message);
    return message;
  }

  async sendFile(
    chatId: string,
    file: Express.Multer.File,
    text: string | undefined,
    clientRequestId: string,
    actorUserId: string
  ) {
    const caption = text?.trim() || undefined;
    if (caption && caption.length > MESSAGE_LIMIT) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Caption terlalu panjang." });
    }
    const chat = await this.prisma.telegramChat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException({ code: "CHAT_NOT_FOUND", message: "Chat tidak ditemukan." });

    const existing = await this.prisma.message.findUnique({ where: { clientRequestId } });
    if (existing) return existing;

    const type = file.mimetype.startsWith("image/") ? "PHOTO" : "DOCUMENT";
    let message = await this.prisma.message.create({
      data: {
        chatId,
        clientRequestId,
        direction: "OUTBOUND",
        type,
        content: caption,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        localFilePath: file.path,
        status: "PENDING",
        sentByUserId: actorUserId
      }
    });
    await this.touchChat(message.chatId, message.createdAt);
    this.events.emit("message.created", message);

    try {
      message = await this.prisma.message.update({ where: { id: message.id }, data: { status: "SENDING" } });
      const result = (await this.bots.sendFile({
        botId: chat.botId,
        chatId: chat.telegramChatId,
        filePath: file.path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        caption,
        type
      })) as {
        message_id?: number;
        photo?: Array<{ file_id: string }>;
        document?: { file_id: string };
      };
      const telegramFileId = result.document?.file_id ?? result.photo?.at(-1)?.file_id;
      message = await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: "SENT",
          telegramMessageId: result.message_id ? String(result.message_id) : undefined,
          telegramFileId,
          sentAt: new Date()
        }
      });
      await this.recordAudit({ actorUserId, action: "message.send_file", targetType: "Message", targetId: message.id });
    } catch (error) {
      message = await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: "TELEGRAM_REQUEST_FAILED",
          errorMessage: error instanceof Error ? error.message : "Telegram API gagal"
        }
      });
    }
    this.events.emit("message.updated", message);
    return message;
  }

  async fileFor(id: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException({ code: "MESSAGE_NOT_FOUND", message: "Pesan tidak ditemukan." });
    if (!message.localFilePath) throw new NotFoundException({ code: "MESSAGE_FILE_NOT_FOUND", message: "File tidak ditemukan." });
    const absolutePath = resolve(message.localFilePath);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException({ code: "MESSAGE_FILE_NOT_FOUND", message: "File tidak ditemukan." });
    }
    return {
      absolutePath,
      fileName: message.fileName ?? basename(absolutePath),
      mimeType: message.mimeType ?? "application/octet-stream"
    };
  }

  private async deliverFileMessage(messageId: string, actorUserId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId }, include: { chat: true } });
    if (!message) throw new NotFoundException({ code: "MESSAGE_NOT_FOUND", message: "Pesan tidak ditemukan." });
    if (!message.localFilePath || !message.fileName || !existsSync(message.localFilePath)) {
      throw new NotFoundException({ code: "MESSAGE_FILE_NOT_FOUND", message: "File tidak ditemukan." });
    }
    const filePath = message.localFilePath;
    const fileName = message.fileName;
    let updated: Message = message;

    try {
      updated = await this.prisma.message.update({
        where: { id: message.id },
        data: { status: "SENDING", errorCode: null, errorMessage: null, failedAt: null }
      });
      this.events.emit("message.updated", updated);
      const result = (await this.bots.sendFile({
        botId: message.chat.botId,
        chatId: message.chat.telegramChatId,
        filePath,
        fileName,
        mimeType: message.mimeType ?? undefined,
        caption: message.content ?? undefined,
        type: message.type === "PHOTO" ? "PHOTO" : "DOCUMENT"
      })) as {
        message_id?: number;
        photo?: Array<{ file_id: string }>;
        document?: { file_id: string };
      };
      const telegramFileId = result.document?.file_id ?? result.photo?.at(-1)?.file_id;
      updated = await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: "SENT",
          telegramMessageId: result.message_id ? String(result.message_id) : undefined,
          telegramFileId,
          sentAt: new Date()
        }
      });
      await this.recordAudit({ actorUserId, action: "message.retry_file", targetType: "Message", targetId: message.id });
    } catch (error) {
      updated = await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: "TELEGRAM_REQUEST_FAILED",
          errorMessage: error instanceof Error ? error.message : "Telegram API gagal"
        }
      });
    }
    this.events.emit("message.updated", updated);
    return updated;
  }

  async retry(id: string, actorUserId: string) {
    const message = await this.prisma.message.findUnique({ where: { id }, include: { chat: true } });
    if (!message) throw new NotFoundException({ code: "MESSAGE_NOT_FOUND", message: "Pesan tidak ditemukan." });
    if (message.localFilePath) {
      const size = existsSync(message.localFilePath) ? statSync(message.localFilePath).size : undefined;
      return this.deliverFileMessage(
        (
          await this.prisma.message.update({
            where: { id },
            data: {
              clientRequestId: randomUUID(),
              fileSize: size,
              sentByUserId: actorUserId
            }
          })
        ).id,
        actorUserId
      );
    }
    return this.send(message.chatId, message.content ?? "", randomUUID(), actorUserId);
  }
}
