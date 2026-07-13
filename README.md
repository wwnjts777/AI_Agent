# Telegram Web Communication Hub

MVP dashboard komunikasi Telegram sesuai `PRD_Telegram_Web_Communication_SQLite.md`.

## Fitur

- Backend NestJS dengan API `/api/v1`.
- Frontend Next.js App Router untuk login, inbox, pengaturan bot, dan audit log.
- SQLite via Prisma.
- HTTP-only JWT cookie untuk admin.
- Bot token dienkripsi AES-256-GCM.
- Telegram webhook dengan validasi `X-Telegram-Bot-Api-Secret-Token`.
- Deduplikasi `telegramUpdateId` dan `clientRequestId`.
- SSE untuk event `message.created`, `message.updated`, `chat.updated`, dan `bot.status`.
- Health check dan backup SQLite.
- Test backend untuk auth, webhook, idempotency, dan message sending mock.

## Setup

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm test
```

Jalankan aplikasi:

```bash
pnpm dev:api
pnpm dev:web
```

Default lokal:

- API: `http://localhost:3001/api/v1`
- Web: `http://localhost:3000`

## Catatan Produksi

- Ganti `JWT_ACCESS_SECRET`, `TOKEN_ENCRYPTION_KEY`, dan password admin awal.
- Set `COOKIE_SECURE=true` di HTTPS.
- Pastikan `storage/database` dan `storage/backups` memakai persistent volume.
- Jangan menjalankan lebih dari satu instance backend untuk satu file SQLite.
