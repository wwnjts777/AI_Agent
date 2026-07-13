CREATE TABLE "AiAgent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'OpenAI Compatible',
  "baseUrl" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "apiKeyCiphertext" TEXT NOT NULL,
  "apiKeyIv" TEXT NOT NULL,
  "apiKeyAuthTag" TEXT NOT NULL,
  "apiKeyLast4" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastCheckedAt" DATETIME,
  "lastError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
