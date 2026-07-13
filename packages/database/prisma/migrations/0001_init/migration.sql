PRAGMA foreign_keys = ON;

CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'ADMIN',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Bot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "telegramBotId" TEXT,
  "username" TEXT,
  "tokenCiphertext" TEXT NOT NULL,
  "tokenIv" TEXT NOT NULL,
  "tokenAuthTag" TEXT NOT NULL,
  "tokenLast4" TEXT,
  "webhookSecret" TEXT NOT NULL,
  "webhookUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastCheckedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "TelegramChat" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "botId" TEXT NOT NULL,
  "telegramChatId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'PRIVATE',
  "firstName" TEXT,
  "lastName" TEXT,
  "username" TEXT,
  "displayName" TEXT,
  "lastMessageAt" DATETIME,
  "lastReadAt" DATETIME,
  "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TelegramChat_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chatId" TEXT NOT NULL,
  "telegramUpdateId" TEXT,
  "telegramMessageId" TEXT,
  "clientRequestId" TEXT,
  "direction" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'TEXT',
  "content" TEXT,
  "status" TEXT NOT NULL,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "sentByUserId" TEXT,
  "telegramCreatedAt" DATETIME,
  "sentAt" DATETIME,
  "failedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "TelegramChat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AppSetting" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");
CREATE UNIQUE INDEX "Bot_telegramBotId_key" ON "Bot" ("telegramBotId");
CREATE UNIQUE INDEX "TelegramChat_botId_telegramChatId_key" ON "TelegramChat" ("botId", "telegramChatId");
CREATE INDEX "TelegramChat_lastMessageAt_idx" ON "TelegramChat" ("lastMessageAt");
CREATE INDEX "TelegramChat_username_idx" ON "TelegramChat" ("username");
CREATE UNIQUE INDEX "Message_telegramUpdateId_key" ON "Message" ("telegramUpdateId");
CREATE UNIQUE INDEX "Message_clientRequestId_key" ON "Message" ("clientRequestId");
CREATE INDEX "Message_chatId_createdAt_idx" ON "Message" ("chatId", "createdAt");
CREATE INDEX "Message_chatId_status_idx" ON "Message" ("chatId", "status");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog" ("actorUserId", "createdAt");
