import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@telegram-hub/database";
import { displayName } from "../common/validation";
import { EventsService } from "../events/events.service";

type UpsertChatInput = {
  botId: string;
  telegramChatId: string;
  type?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  activityAt?: Date;
};

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  async upsert(input: UpsertChatInput) {
    const chat = await this.prisma.telegramChat.upsert({
      where: { botId_telegramChatId: { botId: input.botId, telegramChatId: input.telegramChatId } },
      update: {
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
        displayName: displayName(input.firstName, input.lastName, input.username),
        lastMessageAt: input.activityAt
      },
      create: {
        botId: input.botId,
        telegramChatId: input.telegramChatId,
        type: input.type ?? "PRIVATE",
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
        displayName: displayName(input.firstName, input.lastName, input.username),
        lastMessageAt: input.activityAt
      }
    });
    this.events.emit("chat.updated", chat);
    return chat;
  }

  async list(search?: string, limit = 50, cursor?: string, botId?: string) {
    const where = {
      ...(botId ? { botId } : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search } },
              { username: { contains: search } },
              { messages: { some: { content: { contains: search } } } }
            ]
          }
        : {})
    };
    const chats = await this.prisma.telegramChat.findMany({
      where,
      take: Math.min(limit, 100),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      include: {
        bot: { select: { id: true, name: true, username: true, isActive: true } },
        messages: { take: 1, orderBy: { createdAt: "desc" } }
      }
    });

    return Promise.all(
      chats.map(async (chat) => ({
        ...chat,
        lastMessage: chat.messages[0] ?? null,
        unreadCount: await this.unreadCount(chat.id)
      }))
    );
  }

  async detail(id: string) {
    const chat = await this.prisma.telegramChat.findUnique({
      where: { id },
      include: { bot: { select: { id: true, name: true, username: true, isActive: true } } }
    });
    if (!chat) throw new NotFoundException({ code: "CHAT_NOT_FOUND", message: "Chat tidak ditemukan." });
    return { ...chat, unreadCount: await this.unreadCount(id) };
  }

  async unreadCount(chatId: string) {
    const chat = await this.prisma.telegramChat.findUnique({ where: { id: chatId } });
    if (!chat) return 0;
    return this.prisma.message.count({
      where: {
        chatId,
        direction: "INBOUND",
        createdAt: chat.lastReadAt ? { gt: chat.lastReadAt } : undefined
      }
    });
  }

  async markRead(id: string) {
    const chat = await this.prisma.telegramChat.update({ where: { id }, data: { lastReadAt: new Date() } });
    this.events.emit("chat.updated", chat);
    return { ...chat, unreadCount: 0 };
  }
}
