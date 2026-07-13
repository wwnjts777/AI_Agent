import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "@telegram-hub/database";
import argon2 from "argon2";
import cookieParser from "cookie-parser";
import { existsSync, readFileSync, readdirSync, unlinkSync } from "fs";
import { resolve } from "path";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TelegramHttpService } from "../src/bots/telegram-http.service";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter";
import { ApiResponseInterceptor } from "../src/common/api-response.interceptor";

describe("Telegram Hub API", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const originalFetch = global.fetch;
  const telegramMock = {
    call: jest.fn(async (_token: string, method: string) => {
      if (method === "getMe") return { id: 12345, username: "demo_bot" };
      if (method === "sendMessage") return { message_id: 987 };
      return true;
    }),
    callForm: jest.fn(async (_token: string, method: string) => {
      if (method === "sendPhoto") return { message_id: 654, photo: [{ file_id: "photo-file" }] };
      if (method === "sendDocument") return { message_id: 655, document: { file_id: "document-file" } };
      return true;
    })
  };

  beforeAll(async () => {
    const dbPath = resolve(process.cwd(), "../../packages/database/prisma/test.db");
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        unlinkSync(`${dbPath}${suffix}`);
      } catch {
        // empty
      }
    }
    const setupPrisma = new PrismaClient();
    const migrationsDir = resolve(process.cwd(), "../../packages/database/prisma/migrations");
    const migrations = readdirSync(migrationsDir)
      .filter((name) => existsSync(resolve(migrationsDir, name, "migration.sql")))
      .sort();
    for (const migrationId of migrations) {
      const migration = readFileSync(resolve(migrationsDir, migrationId, "migration.sql"), "utf8");
      for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) {
        await setupPrisma.$executeRawUnsafe(statement);
      }
    }
    await setupPrisma.$disconnect();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TelegramHttpService)
      .useValue(telegramMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin",
        passwordHash: await argon2.hash("secret-password"),
        role: "ADMIN"
      }
    });
  });

  beforeEach(() => {
    telegramMock.call.mockClear();
    telegramMock.callForm.mockClear();
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await app?.close();
  });

  async function login() {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: "secret-password" })
      .expect(200);
    return response.headers["set-cookie"];
  }

  it("protects admin endpoints and logs in with an http-only cookie", async () => {
    await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);
    const cookie = await login();
    expect(String(cookie)).toContain("HttpOnly");
    await request(app.getHttpServer()).get("/api/v1/auth/me").set("Cookie", cookie).expect(200);
  });

  it("stores bot token encrypted and does not return the raw token", async () => {
    const cookie = await login();
    const response = await request(app.getHttpServer())
      .post("/api/v1/bots")
      .set("Cookie", cookie)
      .send({ name: "Demo", token: "123:telegram-token-secret" })
      .expect(201);
    expect(response.body.data.tokenCiphertext).toBeUndefined();
    expect(response.body.data.tokenMasked).toContain("cret");
  });

  it("stores AI agent API key encrypted and does not return the raw key", async () => {
    const cookie = await login();
    const response = await request(app.getHttpServer())
      .post("/api/v1/ai-agents")
      .set("Cookie", cookie)
      .send({
        name: "Agent_A",
        provider: "OpenAI Compatible",
        baseUrl: "https://router.jts.my.id/v1",
        modelId: "Agent_A",
        apiKey: "sk-test-secret-agent-key"
      })
      .expect(201);
    expect(response.body.data.apiKeyCiphertext).toBeUndefined();
    expect(response.body.data.apiKeyMasked).toContain("-key");
    expect(JSON.stringify(response.body)).not.toContain("sk-test-secret-agent-key");
  });

  it("rejects invalid webhook secret and deduplicates Telegram updates", async () => {
    const bot = await prisma.bot.findFirstOrThrow();
    await request(app.getHttpServer()).post(`/api/v1/webhooks/telegram/${bot.id}`).send({ update_id: 1 }).expect(403);

    const update = {
      update_id: 77,
      message: {
        message_id: 88,
        date: Math.floor(Date.now() / 1000),
        text: "Halo admin",
        chat: { id: "999999999999", type: "private", first_name: "Budi", username: "budi" }
      }
    };

    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/telegram/${bot.id}`)
      .set("X-Telegram-Bot-Api-Secret-Token", bot.webhookSecret)
      .send(update)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/telegram/${bot.id}`)
      .set("X-Telegram-Bot-Api-Secret-Token", bot.webhookSecret)
      .send(update)
      .expect(200);

    expect(await prisma.message.count({ where: { telegramUpdateId: "77" } })).toBe(1);
  });

  it("stores Telegram channel posts as inbound messages", async () => {
    const bot = await prisma.bot.findFirstOrThrow();
    const update = {
      update_id: 78,
      channel_post: {
        message_id: 89,
        date: Math.floor(Date.now() / 1000),
        text: "Update dari AI Project Room",
        chat: { id: "-1001234567890", type: "channel", title: "AI Project Room", username: "aiprojectroom" }
      }
    };

    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/telegram/${bot.id}`)
      .set("X-Telegram-Bot-Api-Secret-Token", bot.webhookSecret)
      .send(update)
      .expect(200);

    const chat = await prisma.telegramChat.findUniqueOrThrow({
      where: { botId_telegramChatId: { botId: bot.id, telegramChatId: "-1001234567890" } }
    });
    expect(chat.type).toBe("CHANNEL");
    expect(chat.displayName).toBe("AI Project Room");
    expect(chat.username).toBe("aiprojectroom");
    const message = await prisma.message.findUniqueOrThrow({ where: { telegramUpdateId: "78" } });
    expect(message.content).toBe("Update dari AI Project Room");
    expect(message.status).toBe("RECEIVED");
  });

  it("answers when a Telegram message calls a named agent", async () => {
    const bot = await prisma.bot.findFirstOrThrow();
    await prisma.bot.update({ where: { id: bot.id }, data: { name: "Agent_A", isActive: true } });
    const update = {
      update_id: 79,
      channel_post: {
        message_id: 90,
        date: Math.floor(Date.now() / 1000),
        text: "Agent_A",
        chat: { id: "-100333000", type: "channel", title: "Agent Room", username: "agentroom" }
      }
    };

    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/telegram/${bot.id}`)
      .set("X-Telegram-Bot-Api-Secret-Token", bot.webhookSecret)
      .send(update)
      .expect(200);

    const chat = await prisma.telegramChat.findUniqueOrThrow({
      where: { botId_telegramChatId: { botId: bot.id, telegramChatId: "-100333000" } }
    });
    const reply = await prisma.message.findFirstOrThrow({
      where: { chatId: chat.id, sentByUserId: "bot-interaction", direction: "OUTBOUND" }
    });
    expect(reply.status).toBe("SENT");
    expect(reply.content).toBe("Agent_A siap menerima perintah.");
  });

  it("answers a shared channel agent call only once across bots", async () => {
    const firstBot = await prisma.bot.findFirstOrThrow();
    await prisma.bot.update({ where: { id: firstBot.id }, data: { name: "Agent_A", isActive: true } });
    const secondBot = await prisma.bot.create({
      data: {
        name: "Agent_B",
        tokenCiphertext: firstBot.tokenCiphertext,
        tokenIv: firstBot.tokenIv,
        tokenAuthTag: firstBot.tokenAuthTag,
        tokenLast4: firstBot.tokenLast4,
        webhookSecret: "agent-b-webhook-secret"
      }
    });
    const channelPost = {
      message_id: 91,
      date: Math.floor(Date.now() / 1000),
      text: "Agent_A",
      chat: { id: "-100333001", type: "channel", title: "Agent Room", username: "agentroom" }
    };

    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/telegram/${firstBot.id}`)
      .set("X-Telegram-Bot-Api-Secret-Token", firstBot.webhookSecret)
      .send({ update_id: 80, channel_post: channelPost })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/telegram/${secondBot.id}`)
      .set("X-Telegram-Bot-Api-Secret-Token", secondBot.webhookSecret)
      .send({ update_id: 81, channel_post: channelPost })
      .expect(200);

    const replies = await prisma.message.findMany({
      where: {
        sentByUserId: "bot-interaction",
        content: "Agent_A siap menerima perintah.",
        chat: { telegramChatId: "-100333001" }
      }
    });
    expect(replies).toHaveLength(1);
  });

  it("asks for a target agent only once across bots when no agent is named", async () => {
    const firstBot = await prisma.bot.findFirstOrThrow();
    const secondBot = await prisma.bot.create({
      data: {
        name: "Agent_B",
        tokenCiphertext: firstBot.tokenCiphertext,
        tokenIv: firstBot.tokenIv,
        tokenAuthTag: firstBot.tokenAuthTag,
        tokenLast4: firstBot.tokenLast4,
        webhookSecret: "no-target-agent-b-secret"
      }
    });
    const channelPost = {
      message_id: 92,
      date: Math.floor(Date.now() / 1000),
      text: "apa cuaca surabaya hari ini?",
      chat: { id: "-100333002", type: "channel", title: "Agent Room", username: "agentroom" }
    };
    global.fetch = jest.fn();

    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/telegram/${firstBot.id}`)
      .set("X-Telegram-Bot-Api-Secret-Token", firstBot.webhookSecret)
      .send({ update_id: 82, channel_post: channelPost })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/webhooks/telegram/${secondBot.id}`)
      .set("X-Telegram-Bot-Api-Secret-Token", secondBot.webhookSecret)
      .send({ update_id: 83, channel_post: channelPost })
      .expect(200);

    const replies = await prisma.message.findMany({
      where: {
        sentByUserId: "bot-interaction",
        content: { contains: "Agent tujuan belum disebutkan" },
        chat: { telegramChatId: "-100333002" }
      }
    });
    expect(replies).toHaveLength(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends an outbound message once by clientRequestId", async () => {
    const cookie = await login();
    const chat = await prisma.telegramChat.findFirstOrThrow();
    const clientRequestId = "7e62851f-524a-4f9f-a357-98ba217ce326";
    await request(app.getHttpServer())
      .post(`/api/v1/chats/${chat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "Halo, ada yang bisa dibantu?", clientRequestId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/chats/${chat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "Halo, ada yang bisa dibantu?", clientRequestId })
      .expect(201);

    expect(await prisma.message.count({ where: { clientRequestId } })).toBe(1);
    const message = await prisma.message.findUniqueOrThrow({ where: { clientRequestId } });
    expect(message.status).toBe("SENT");
  });

  it("asks for a target agent when a channel message has no named agent", async () => {
    const cookie = await login();
    const primaryBot = await prisma.bot.findFirstOrThrow();
    const responderBot = await prisma.bot.create({
      data: {
        name: "Responder",
        tokenCiphertext: primaryBot.tokenCiphertext,
        tokenIv: primaryBot.tokenIv,
        tokenAuthTag: primaryBot.tokenAuthTag,
        tokenLast4: primaryBot.tokenLast4,
        webhookSecret: "responder-secret"
      }
    });
    const channelId = "-100777000";
    const askChat = await prisma.telegramChat.create({
      data: {
        botId: primaryBot.id,
        telegramChatId: channelId,
        type: "CHANNEL",
        displayName: "Bot Room",
        firstName: "Bot Room"
      }
    });
    const answerChat = await prisma.telegramChat.create({
      data: {
        botId: responderBot.id,
        telegramChatId: channelId,
        type: "CHANNEL",
        displayName: "Bot Room",
        firstName: "Bot Room"
      }
    });

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${askChat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "sekarang tanggal apa?", clientRequestId: "bc4cd9d9-c16f-4a53-a1d0-dddc78d95450" })
      .expect(201);

    const answer = await prisma.message.findFirstOrThrow({
      where: { chatId: askChat.id, sentByUserId: "bot-interaction" }
    });
    const otherAnswerCount = await prisma.message.count({
      where: { chatId: answerChat.id, sentByUserId: "bot-interaction" }
    });
    expect(answer.status).toBe("SENT");
    expect(answer.content).toContain("Agent tujuan belum disebutkan");
    expect(otherAnswerCount).toBe(0);
    expect(telegramMock.call.mock.calls.filter((call) => call[1] === "sendMessage")).toHaveLength(2);
  });

  it("does not call AI for general questions without a named agent", async () => {
    const cookie = await login();
    const primaryBot = await prisma.bot.findFirstOrThrow();
    await prisma.aiAgent.create({
      data: {
        name: "Agent_A",
        provider: "OpenAI Compatible",
        baseUrl: "https://router.jts.my.id/v1",
        modelId: "Agent_A",
        apiKeyCiphertext: primaryBot.tokenCiphertext,
        apiKeyIv: primaryBot.tokenIv,
        apiKeyAuthTag: primaryBot.tokenAuthTag,
        apiKeyLast4: primaryBot.tokenLast4
      }
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: "Telegram adalah aplikasi pesan instan berbasis cloud." } }] })
    })) as unknown as typeof fetch;
    const channelId = "-100888000";
    const askChat = await prisma.telegramChat.create({
      data: { botId: primaryBot.id, telegramChatId: channelId, type: "CHANNEL", displayName: "AI Room" }
    });

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${askChat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "apa itu telegram?", clientRequestId: "3f4501d8-a996-4023-8e4c-248eb03c2d2f" })
      .expect(201);

    const answer = await prisma.message.findFirstOrThrow({
      where: { chatId: askChat.id, sentByUserId: "bot-interaction" }
    });
    expect(answer.status).toBe("SENT");
    expect(answer.content).toContain("Agent tujuan belum disebutkan");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("uses the AI agent model matching the responder bot name", async () => {
    const cookie = await login();
    const primaryBot = await prisma.bot.findFirstOrThrow();
    const responderBot = await prisma.bot.create({
      data: {
        name: "Agent_B",
        tokenCiphertext: primaryBot.tokenCiphertext,
        tokenIv: primaryBot.tokenIv,
        tokenAuthTag: primaryBot.tokenAuthTag,
        tokenLast4: primaryBot.tokenLast4,
        webhookSecret: "agent-b-ai-secret"
      }
    });
    await prisma.aiAgent.create({
      data: {
        name: "Agent_B",
        provider: "OpenAI Compatible",
        baseUrl: "https://router.jts.my.id/v1",
        modelId: "Agent_B",
        apiKeyCiphertext: primaryBot.tokenCiphertext,
        apiKeyIv: primaryBot.tokenIv,
        apiKeyAuthTag: primaryBot.tokenAuthTag,
        apiKeyLast4: primaryBot.tokenLast4
      }
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: "Jawaban dari Agent_B." } }] })
    })) as unknown as typeof fetch;
    const channelId = "-100888001";
    const askChat = await prisma.telegramChat.create({
      data: { botId: primaryBot.id, telegramChatId: channelId, type: "CHANNEL", displayName: "AI Room B" }
    });
    const answerChat = await prisma.telegramChat.create({
      data: { botId: responderBot.id, telegramChatId: channelId, type: "CHANNEL", displayName: "AI Room B" }
    });

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${askChat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "Agent_B jelaskan tugasmu", clientRequestId: "476d20b1-e0ee-465b-a425-01cfc0ce7157" })
      .expect(201);

    const answer = await prisma.message.findFirstOrThrow({
      where: { chatId: answerChat.id, sentByUserId: "bot-interaction" }
    });
    expect(answer.status).toBe("SENT");
    expect(answer.content).toBe("Jawaban dari Agent_B.");
    const body = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1]?.body));
    expect(body.model).toBe("Agent_B");
  });

  it("routes prefixed commands only to the named agent", async () => {
    const cookie = await login();
    const primaryBot = await prisma.bot.findFirstOrThrow();
    const agentB = await prisma.bot.create({
      data: {
        name: "Agent_B",
        tokenCiphertext: primaryBot.tokenCiphertext,
        tokenIv: primaryBot.tokenIv,
        tokenAuthTag: primaryBot.tokenAuthTag,
        tokenLast4: primaryBot.tokenLast4,
        webhookSecret: "agent-b-target-secret"
      }
    });
    const agentC = await prisma.bot.create({
      data: {
        name: "Agent_C",
        tokenCiphertext: primaryBot.tokenCiphertext,
        tokenIv: primaryBot.tokenIv,
        tokenAuthTag: primaryBot.tokenAuthTag,
        tokenLast4: primaryBot.tokenLast4,
        webhookSecret: "agent-c-target-secret"
      }
    });
    await prisma.aiAgent.create({
      data: {
        name: "Agent_B",
        provider: "OpenAI Compatible",
        baseUrl: "https://router.jts.my.id/v1",
        modelId: "Agent_B",
        apiKeyCiphertext: primaryBot.tokenCiphertext,
        apiKeyIv: primaryBot.tokenIv,
        apiKeyAuthTag: primaryBot.tokenAuthTag,
        apiKeyLast4: primaryBot.tokenLast4
      }
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: "Cuaca hari ini cerah berawan." } }] })
    })) as unknown as typeof fetch;
    const channelId = "-100888002";
    const askChat = await prisma.telegramChat.create({
      data: { botId: primaryBot.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Target Room" }
    });
    const agentBChat = await prisma.telegramChat.create({
      data: { botId: agentB.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Target Room" }
    });
    const agentCChat = await prisma.telegramChat.create({
      data: { botId: agentC.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Target Room" }
    });

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${askChat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "Agent_B tolong beritahu cuaca hari ini", clientRequestId: "358fd6dd-2522-4bf2-852c-a3bda1f5032f" })
      .expect(201);

    const agentBAnswer = await prisma.message.findFirstOrThrow({
      where: { chatId: agentBChat.id, sentByUserId: "bot-interaction" }
    });
    const agentCAnswerCount = await prisma.message.count({
      where: { chatId: agentCChat.id, sentByUserId: "bot-interaction" }
    });
    expect(agentBAnswer.status).toBe("SENT");
    expect(agentBAnswer.content).toBe("Cuaca hari ini cerah berawan.");
    expect(agentCAnswerCount).toBe(0);
    const body = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1]?.body));
    expect(body.model).toBe("Agent_B");
    expect(body.messages.at(-1).content).toBe("tolong beritahu cuaca hari ini");
  });

  it("removes web search markup from AI replies", async () => {
    const cookie = await login();
    const primaryBot = await prisma.bot.findFirstOrThrow();
    const agentB = await prisma.bot.create({
      data: {
        name: "Agent_B",
        tokenCiphertext: primaryBot.tokenCiphertext,
        tokenIv: primaryBot.tokenIv,
        tokenAuthTag: primaryBot.tokenAuthTag,
        tokenLast4: primaryBot.tokenLast4,
        webhookSecret: "agent-b-clean-secret"
      }
    });
    await prisma.aiAgent.create({
      data: {
        name: "Agent_B",
        provider: "OpenAI Compatible",
        baseUrl: "https://router.jts.my.id/v1",
        modelId: "Agent_B",
        apiKeyCiphertext: primaryBot.tokenCiphertext,
        apiKeyIv: primaryBot.tokenIv,
        apiKeyAuthTag: primaryBot.tokenAuthTag,
        apiKeyLast4: primaryBot.tokenLast4
      }
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "Cek cuaca Surabaya sekarang.\n\n<web_search>\n<query>cuaca Surabaya hari ini 10 Juli 2026</query>\n</web_search>"
              }
            }
          ]
        })
    })) as unknown as typeof fetch;
    const channelId = "-100888003";
    const askChat = await prisma.telegramChat.create({
      data: { botId: primaryBot.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Clean Room" }
    });
    const answerChat = await prisma.telegramChat.create({
      data: { botId: agentB.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Clean Room" }
    });

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${askChat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "Agent_B tolong apa cuaca surabaya hari ini", clientRequestId: "b6f80666-3820-4670-a6a9-e2ee971d3d0f" })
      .expect(201);

    const answer = await prisma.message.findFirstOrThrow({
      where: { chatId: answerChat.id, sentByUserId: "bot-interaction" }
    });
    expect(answer.content).toBe("Cek cuaca Surabaya sekarang.");
    expect(answer.content).not.toContain("<web_search>");
    expect(answer.content).not.toContain("<query>");
  });

  it("adds workspace context when an AI agent has workspace access", async () => {
    const cookie = await login();
    const primaryBot = await prisma.bot.findFirstOrThrow();
    const agentB = await prisma.bot.create({
      data: {
        name: "Agent_B",
        tokenCiphertext: primaryBot.tokenCiphertext,
        tokenIv: primaryBot.tokenIv,
        tokenAuthTag: primaryBot.tokenAuthTag,
        tokenLast4: primaryBot.tokenLast4,
        webhookSecret: "agent-b-workspace-secret"
      }
    });
    await prisma.aiAgent.create({
      data: {
        name: "Agent_B",
        provider: "OpenAI Compatible",
        baseUrl: "https://router.jts.my.id/v1",
        modelId: "Agent_B",
        apiKeyCiphertext: primaryBot.tokenCiphertext,
        apiKeyIv: primaryBot.tokenIv,
        apiKeyAuthTag: primaryBot.tokenAuthTag,
        apiKeyLast4: primaryBot.tokenLast4,
        workspaceAccess: true,
        workspaceRoot: "apps/web"
      }
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: "Saya melihat konteks web dan bisa bantu membuat patch." } }] })
    })) as unknown as typeof fetch;
    const channelId = "-100888004";
    const askChat = await prisma.telegramChat.create({
      data: { botId: primaryBot.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Workspace Room" }
    });
    const answerChat = await prisma.telegramChat.create({
      data: { botId: agentB.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Workspace Room" }
    });

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${askChat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "Agent_B perbaiki bug web dashboard", clientRequestId: "89cd4758-9fd4-4ed0-9af3-c41da1a624cd" })
      .expect(201);

    const body = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1]?.body));
    const workspaceContext = body.messages.find((message: { content: string }) =>
      message.content.includes("Konteks workspace aplikasi")
    )?.content;
    expect(workspaceContext).toContain("Workspace root: apps/web");
    expect(workspaceContext).toContain("app/dashboard/page.tsx");
    const answer = await prisma.message.findFirstOrThrow({
      where: { chatId: answerChat.id, sentByUserId: "bot-interaction" }
    });
    expect(answer.status).toBe("SENT");
  });

  it("prioritizes documentation files for document study commands", async () => {
    const cookie = await login();
    const primaryBot = await prisma.bot.findFirstOrThrow();
    const agentB = await prisma.bot.create({
      data: {
        name: "Agent_B",
        tokenCiphertext: primaryBot.tokenCiphertext,
        tokenIv: primaryBot.tokenIv,
        tokenAuthTag: primaryBot.tokenAuthTag,
        tokenLast4: primaryBot.tokenLast4,
        webhookSecret: "agent-b-doc-secret"
      }
    });
    await prisma.aiAgent.create({
      data: {
        name: "Agent_B",
        provider: "OpenAI Compatible",
        baseUrl: "https://router.jts.my.id/v1",
        modelId: "Agent_B",
        apiKeyCiphertext: primaryBot.tokenCiphertext,
        apiKeyIv: primaryBot.tokenIv,
        apiKeyAuthTag: primaryBot.tokenAuthTag,
        apiKeyLast4: primaryBot.tokenLast4,
        workspaceAccess: true,
        workspaceRoot: "."
      }
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: "Dokumen aplikasi sudah saya baca." } }] })
    })) as unknown as typeof fetch;
    const channelId = "-100888005";
    const askChat = await prisma.telegramChat.create({
      data: { botId: primaryBot.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Document Room" }
    });
    const answerChat = await prisma.telegramChat.create({
      data: { botId: agentB.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Document Room" }
    });

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${askChat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "Agent_B tolong pelajari dokumen yang ada di folder aplikasi ini", clientRequestId: "8504decb-369f-4f66-999f-06ffbb7d5250" })
      .expect(201);

    const body = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1]?.body));
    const workspaceContext = body.messages.find((message: { content: string }) =>
      message.content.includes("Konteks workspace aplikasi")
    )?.content;
    expect(workspaceContext).toContain("PRD_Telegram_Web_Communication_SQLite.md");
    expect(workspaceContext).toContain("README.md");
    const answer = await prisma.message.findFirstOrThrow({
      where: { chatId: answerChat.id, sentByUserId: "bot-interaction" }
    });
    expect(answer.status).toBe("SENT");
  });

  it("sends a visible reply when the AI provider fails", async () => {
    const cookie = await login();
    const primaryBot = await prisma.bot.findFirstOrThrow();
    const agentB = await prisma.bot.create({
      data: {
        name: "Agent_B",
        tokenCiphertext: primaryBot.tokenCiphertext,
        tokenIv: primaryBot.tokenIv,
        tokenAuthTag: primaryBot.tokenAuthTag,
        tokenLast4: primaryBot.tokenLast4,
        webhookSecret: "agent-b-error-secret"
      }
    });
    await prisma.aiAgent.create({
      data: {
        name: "Agent_B",
        provider: "OpenAI Compatible",
        baseUrl: "https://router.jts.my.id/v1",
        modelId: "Agent_B",
        apiKeyCiphertext: primaryBot.tokenCiphertext,
        apiKeyIv: primaryBot.tokenIv,
        apiKeyAuthTag: primaryBot.tokenAuthTag,
        apiKeyLast4: primaryBot.tokenLast4
      }
    });
    global.fetch = jest.fn(async () => ({ ok: false, text: async () => JSON.stringify({ error: { message: "model timeout" } }) })) as unknown as typeof fetch;
    const channelId = "-100888006";
    const askChat = await prisma.telegramChat.create({
      data: { botId: primaryBot.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Error Room" }
    });
    const answerChat = await prisma.telegramChat.create({
      data: { botId: agentB.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Error Room" }
    });

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${askChat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "Agent_B tolong pelajari dokumen", clientRequestId: "4a755cb3-e43b-4e36-98f3-dd11c3a8656d" })
      .expect(201);

    const answer = await prisma.message.findFirstOrThrow({
      where: { chatId: answerChat.id, sentByUserId: "bot-interaction" }
    });
    expect(answer.status).toBe("SENT");
    expect(answer.content).toMatch(/belum bisa menjawab|File yang relevan ditemukan|sudah mempelajari dokumen/);
  });

  it("falls back to workspace file list when AI fails with workspace context", async () => {
    const cookie = await login();
    const primaryBot = await prisma.bot.findFirstOrThrow();
    const agentB = await prisma.bot.create({
      data: {
        name: "Agent_B",
        tokenCiphertext: primaryBot.tokenCiphertext,
        tokenIv: primaryBot.tokenIv,
        tokenAuthTag: primaryBot.tokenAuthTag,
        tokenLast4: primaryBot.tokenLast4,
        webhookSecret: "agent-b-workspace-fallback-secret"
      }
    });
    await prisma.aiAgent.create({
      data: {
        name: "Agent_B",
        provider: "OpenAI Compatible",
        baseUrl: "https://router.jts.my.id/v1",
        modelId: "Agent_B",
        apiKeyCiphertext: primaryBot.tokenCiphertext,
        apiKeyIv: primaryBot.tokenIv,
        apiKeyAuthTag: primaryBot.tokenAuthTag,
        apiKeyLast4: primaryBot.tokenLast4,
        workspaceAccess: true,
        workspaceRoot: "."
      }
    });
    global.fetch = jest.fn(async () => ({ ok: false, text: async () => JSON.stringify({ error: { message: "timeout" } }) })) as unknown as typeof fetch;
    const channelId = "-100888008";
    const askChat = await prisma.telegramChat.create({
      data: { botId: primaryBot.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Workspace Fallback Room" }
    });
    const answerChat = await prisma.telegramChat.create({
      data: { botId: agentB.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Workspace Fallback Room" }
    });

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${askChat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "Agent_B tolong pelajari dokumen yang ada di folder aplikasi ini", clientRequestId: "b9718fc0-2064-4d8f-8f79-2f0c54c06821" })
      .expect(201);

    const answer = await prisma.message.findFirstOrThrow({
      where: { chatId: answerChat.id, sentByUserId: "bot-interaction" }
    });
    expect(answer.status).toBe("SENT");
    expect(answer.content).toContain("sudah mempelajari dokumen");
    expect(answer.content).toContain("PRD_Telegram_Web_Communication_SQLite.md");
    expect(answer.content).toContain("Inti dokumen");
  });

  it("reads streaming delta content from AI providers", async () => {
    const cookie = await login();
    const primaryBot = await prisma.bot.findFirstOrThrow();
    const agentB = await prisma.bot.create({
      data: {
        name: "Agent_B",
        tokenCiphertext: primaryBot.tokenCiphertext,
        tokenIv: primaryBot.tokenIv,
        tokenAuthTag: primaryBot.tokenAuthTag,
        tokenLast4: primaryBot.tokenLast4,
        webhookSecret: "agent-b-stream-secret"
      }
    });
    await prisma.aiAgent.create({
      data: {
        name: "Agent_B",
        provider: "OpenAI Compatible",
        baseUrl: "https://router.jts.my.id/v1",
        modelId: "Agent_B",
        apiKeyCiphertext: primaryBot.tokenCiphertext,
        apiKeyIv: primaryBot.tokenIv,
        apiKeyAuthTag: primaryBot.tokenAuthTag,
        apiKeyLast4: primaryBot.tokenLast4
      }
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () =>
        [
          'data: {"choices":[{"delta":{"content":"Dokumen "}}]}',
          'data: {"choices":[{"delta":{"content":"sudah dibaca."}}]}',
          "data: [DONE]"
        ].join("\n")
    })) as unknown as typeof fetch;
    const channelId = "-100888007";
    const askChat = await prisma.telegramChat.create({
      data: { botId: primaryBot.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Stream Room" }
    });
    const answerChat = await prisma.telegramChat.create({
      data: { botId: agentB.id, telegramChatId: channelId, type: "CHANNEL", displayName: "Stream Room" }
    });

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${askChat.id}/messages`)
      .set("Cookie", cookie)
      .send({ text: "Agent_B tolong pelajari dokumen", clientRequestId: "84f353bf-5974-49dd-81e6-5aa8a27e49b8" })
      .expect(201);

    const answer = await prisma.message.findFirstOrThrow({
      where: { chatId: answerChat.id, sentByUserId: "bot-interaction" }
    });
    expect(answer.content).toBe("Dokumen sudah dibaca.");
  });

  it("falls back to sending images as documents when Telegram cannot process the photo", async () => {
    const cookie = await login();
    const chat = await prisma.telegramChat.findFirstOrThrow();
    const clientRequestId = "2b0fe6f9-64f7-4247-80ef-5c2d45c6709d";
    telegramMock.callForm
      .mockImplementationOnce(async (_token: string, method: string) => {
        expect(method).toBe("sendPhoto");
        throw new Error("Bad Request: IMAGE_PROCESS_FAILED");
      })
      .mockImplementationOnce(async (_token: string, method: string) => {
        expect(method).toBe("sendDocument");
        return { message_id: 321, document: { file_id: "fallback-document-file" } };
      });

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${chat.id}/messages`)
      .set("Cookie", cookie)
      .field("text", "Gambar gagal diproses sebagai photo")
      .field("clientRequestId", clientRequestId)
      .attach("file", Buffer.from("not-a-real-image"), { filename: "broken.png", contentType: "image/png" })
      .expect(201);

    expect(telegramMock.callForm.mock.calls.map((call) => call[1])).toEqual(["sendPhoto", "sendDocument"]);
    const message = await prisma.message.findUniqueOrThrow({ where: { clientRequestId } });
    expect(message.type).toBe("PHOTO");
    expect(message.status).toBe("SENT");
    expect(message.telegramFileId).toBe("fallback-document-file");
  });
});
