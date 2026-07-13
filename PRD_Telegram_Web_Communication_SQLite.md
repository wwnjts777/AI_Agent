# Product Requirements Document (PRD)
# Telegram Web Communication Hub

**Versi:** 1.0  
**Tanggal:** 10 Juli 2026  
**Status:** Acuan pembangunan MVP  
**Database:** SQLite  
**Arsitektur:** Next.js + NestJS + Prisma ORM + Telegram Bot API  

---

## 1. Ringkasan Produk

Telegram Web Communication Hub adalah aplikasi berbasis web yang memungkinkan administrator menerima, membaca, mengelola, dan membalas pesan pengguna Telegram melalui sebuah dashboard.

Pesan yang dikirim pengguna kepada Telegram Bot akan diteruskan ke backend melalui webhook, disimpan ke SQLite, lalu ditampilkan secara real-time pada dashboard web. Balasan administrator dari dashboard akan dikirim kembali kepada pengguna melalui Telegram Bot API.

Aplikasi versi awal berfokus pada komunikasi dua arah antara:

```text
Pengguna Telegram
        ⇅
Telegram Bot API
        ⇅
Backend NestJS
        ⇅
SQLite Database
        ⇅
Dashboard Next.js
```

Integrasi AI atau multi-agent belum menjadi fitur wajib MVP, tetapi struktur sistem harus memungkinkan fitur tersebut ditambahkan pada tahap berikutnya.

---

## 2. Latar Belakang

Komunikasi melalui Telegram Bot biasanya hanya berjalan sebagai bot otomatis atau menggunakan perintah sederhana. Administrator tidak selalu memiliki dashboard terpusat untuk:

- melihat seluruh percakapan;
- memantau pesan baru;
- membalas pengguna secara manual;
- mengetahui status pengiriman;
- menyimpan riwayat komunikasi;
- mengelola konfigurasi bot;
- meninjau aktivitas sistem.

Aplikasi ini dibuat untuk menyediakan pusat komunikasi Telegram yang mudah digunakan melalui browser.

---

## 3. Tujuan Produk

### 3.1 Tujuan utama

1. Menghubungkan satu Telegram Bot dengan aplikasi web.
2. Menerima pesan Telegram melalui webhook.
3. Menyimpan pengguna, percakapan, dan pesan ke SQLite.
4. Menampilkan pesan pada dashboard secara real-time.
5. Memungkinkan administrator membalas pesan dari dashboard.
6. Menyimpan status pesan masuk dan keluar.
7. Menyediakan autentikasi dan audit aktivitas dasar.
8. Menyediakan fondasi untuk pengembangan bot otomatis dan AI multi-agent.

### 3.2 Indikator keberhasilan MVP

MVP dinyatakan berhasil apabila:

- bot berhasil menerima pesan dari Telegram;
- webhook merespons request Telegram dengan status HTTP `2xx`;
- setiap pesan masuk tersimpan satu kali;
- pesan baru muncul di dashboard tanpa refresh manual;
- administrator dapat mengirim balasan dari dashboard;
- balasan diterima pengguna Telegram;
- token bot tidak pernah dikirim ke frontend;
- data tetap tersedia setelah aplikasi dimulai ulang;
- seluruh endpoint admin terlindungi autentikasi.

---

## 4. Ruang Lingkup MVP

### 4.1 Termasuk dalam MVP

- satu aplikasi;
- satu akun administrator awal;
- satu Telegram Bot aktif;
- komunikasi private chat;
- penerimaan pesan teks;
- penerimaan command seperti `/start` dan `/help`;
- daftar percakapan;
- riwayat pesan;
- balasan manual dari dashboard;
- pencarian percakapan;
- indikator pesan belum dibaca;
- status pesan masuk dan keluar;
- notifikasi pesan baru secara real-time;
- pengaturan bot;
- health check;
- audit log dasar;
- backup file SQLite secara manual atau terjadwal.

### 4.2 Tidak termasuk dalam MVP

- multi-tenant;
- banyak organisasi;
- banyak bot aktif sekaligus;
- voice call atau video call;
- pembayaran Telegram;
- chatbot AI penuh;
- orkestrasi multi-agent;
- broadcast massal;
- campaign management;
- integrasi WhatsApp atau platform lain;
- horizontal scaling dengan beberapa instance backend;
- aplikasi mobile native.

Fitur yang tidak termasuk MVP dapat masuk ke roadmap setelah sistem inti stabil.

---

## 5. Pengguna Sistem

### 5.1 Administrator

Administrator menggunakan dashboard untuk:

- login;
- melihat daftar chat;
- membaca riwayat pesan;
- membalas pesan;
- mencari pengguna atau isi percakapan;
- melihat status bot;
- memasang atau memeriksa webhook;
- melihat kegagalan pengiriman;
- melihat audit aktivitas.

### 5.2 Pengguna Telegram

Pengguna Telegram dapat:

- membuka percakapan dengan bot;
- mengirim `/start`;
- mengirim pesan teks;
- menerima balasan admin;
- menerima pesan kesalahan yang ramah apabila layanan bermasalah.

---

## 6. User Stories

### Administrator

1. Sebagai administrator, saya ingin login agar dashboard tidak dapat diakses sembarang orang.
2. Sebagai administrator, saya ingin melihat daftar percakapan agar mengetahui pengguna yang menghubungi bot.
3. Sebagai administrator, saya ingin melihat pesan terbaru agar dapat segera merespons.
4. Sebagai administrator, saya ingin membalas pesan dari web agar tidak perlu menggunakan akun Telegram pribadi.
5. Sebagai administrator, saya ingin melihat status pengiriman agar mengetahui apakah pesan berhasil dikirim.
6. Sebagai administrator, saya ingin mencari percakapan agar lebih mudah menemukan pengguna tertentu.
7. Sebagai administrator, saya ingin melihat log kesalahan agar dapat melakukan troubleshooting.
8. Sebagai administrator, saya ingin memeriksa status webhook agar dapat memastikan bot terhubung.

### Pengguna Telegram

1. Sebagai pengguna, saya ingin mengirim pesan kepada bot agar dapat berkomunikasi dengan administrator.
2. Sebagai pengguna, saya ingin memperoleh konfirmasi awal setelah menggunakan `/start`.
3. Sebagai pengguna, saya ingin menerima balasan pada chat yang sama.
4. Sebagai pengguna, saya tidak ingin pesan saya diproses berulang kali.

---

## 7. Asumsi dan Batasan

1. MVP dijalankan menggunakan satu instance backend.
2. SQLite disimpan pada persistent disk atau volume.
3. Backend memiliki URL HTTPS publik untuk menerima webhook.
4. Bot dibuat melalui BotFather dan token tersedia.
5. Telegram Bot Token hanya diketahui oleh backend.
6. Penggunaan awal diperkirakan memiliki volume pesan rendah sampai menengah.
7. Pesan Telegram ID, chat ID, dan update ID disimpan sebagai `String`.
8. Versi pertama hanya menangani private chat.
9. Backend bertindak sebagai sumber data utama.
10. Frontend tidak berkomunikasi langsung dengan Telegram.

---

## 8. Arsitektur Sistem

```text
┌──────────────────┐
│ Pengguna Telegram│
└────────┬─────────┘
         │ Pesan
         ▼
┌──────────────────┐
│ Telegram Bot API │
└────────┬─────────┘
         │ HTTPS Webhook
         ▼
┌──────────────────────────────────────┐
│ Backend NestJS                       │
│                                      │
│  Telegram Module                     │
│  Chat Module                         │
│  Message Module                      │
│  Authentication Module               │
│  Event/SSE Module                    │
│  Audit Module                        │
│  Health Module                       │
└───────────────┬──────────────────────┘
                │ Prisma ORM
                ▼
┌──────────────────────────────────────┐
│ SQLite                               │
│ users.db / app.db                    │
└──────────────────────────────────────┘
                ▲
                │ REST API + SSE
                │
┌───────────────┴──────────────────────┐
│ Dashboard Next.js                    │
│ Login                                │
│ Inbox                                │
│ Conversation                         │
│ Bot Settings                         │
│ Logs                                 │
└──────────────────────────────────────┘
```

---

## 9. Keputusan Teknologi

| Komponen | Pilihan |
|---|---|
| Package manager | pnpm |
| Monorepo | pnpm workspace |
| Frontend | Next.js App Router |
| Backend | NestJS |
| Bahasa | TypeScript |
| Database | SQLite |
| ORM | Prisma ORM |
| Driver SQLite | `better-sqlite3` melalui Prisma adapter |
| Real-time | Server-Sent Events |
| Autentikasi | JWT access token melalui HTTP-only cookie |
| Validasi | `class-validator` dan DTO NestJS |
| Password hashing | Argon2 atau bcrypt |
| Testing backend | Jest |
| Testing end-to-end | Playwright |
| Logging | NestJS Logger atau Pino |
| Deployment | Docker atau Node.js process dengan persistent volume |
| Reverse proxy | Nginx atau layanan proxy setara |

### Alasan memilih SSE

Server-Sent Events dipilih untuk MVP karena dashboard hanya memerlukan aliran event satu arah dari backend ke browser, seperti:

- pesan baru;
- perubahan status pesan;
- perubahan jumlah unread;
- status koneksi bot.

Pengiriman balasan tetap menggunakan REST API. WebSocket dapat digunakan pada fase berikutnya apabila kebutuhan real-time menjadi lebih kompleks.

---

## 10. Struktur Monorepo

```text
telegram-web-hub/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── chats/
│   │   │   │   ├── settings/
│   │   │   │   └── logs/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   └── public/
│   │
│   └── api/
│       ├── src/
│       │   ├── auth/
│       │   ├── users/
│       │   ├── bots/
│       │   ├── telegram/
│       │   ├── chats/
│       │   ├── messages/
│       │   ├── events/
│       │   ├── audit/
│       │   ├── health/
│       │   ├── common/
│       │   ├── app.module.ts
│       │   └── main.ts
│       └── test/
│
├── packages/
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   └── prisma.config.ts
│   │
│   ├── shared-types/
│   ├── eslint-config/
│   └── typescript-config/
│
├── storage/
│   ├── database/
│   │   └── app.db
│   ├── backups/
│   └── logs/
│
├── .env.example
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 11. Modul Backend

### 11.1 Auth Module

Tanggung jawab:

- login administrator;
- verifikasi password;
- membuat access token;
- logout;
- guard endpoint;
- membaca identitas user aktif.

### 11.2 Users Module

Tanggung jawab:

- data administrator;
- mengubah nama;
- mengubah password;
- menonaktifkan user pada pengembangan berikutnya.

### 11.3 Bots Module

Tanggung jawab:

- konfigurasi bot;
- enkripsi token;
- memeriksa bot dengan `getMe`;
- memasang webhook;
- memeriksa webhook;
- mengaktifkan atau menonaktifkan bot.

### 11.4 Telegram Module

Tanggung jawab:

- menerima webhook;
- memvalidasi webhook secret;
- mengubah payload Telegram menjadi format internal;
- menangani command;
- mengirim pesan melalui Bot API;
- menangani kegagalan dan timeout;
- mencegah pemrosesan update ganda.

### 11.5 Chats Module

Tanggung jawab:

- membuat atau memperbarui Telegram chat;
- daftar percakapan;
- detail percakapan;
- pencarian;
- unread count;
- menandai percakapan telah dibaca.

### 11.6 Messages Module

Tanggung jawab:

- menyimpan pesan masuk;
- menyimpan pesan keluar;
- memperbarui status pesan;
- mengambil riwayat pesan;
- retry pesan gagal secara manual.

### 11.7 Events Module

Tanggung jawab:

- menyediakan endpoint SSE;
- mengirim event `message.created`;
- mengirim event `message.updated`;
- mengirim event `chat.updated`;
- mengirim event `bot.status`.

### 11.8 Audit Module

Tanggung jawab:

- mencatat login;
- mencatat logout;
- mencatat pengiriman pesan;
- mencatat perubahan konfigurasi bot;
- mencatat pemasangan webhook.

### 11.9 Health Module

Tanggung jawab:

- status API;
- koneksi database;
- status file database;
- status bot;
- informasi versi aplikasi tanpa mengekspos data rahasia.

---

## 12. Alur Utama

### 12.1 Pesan masuk

```text
1. Pengguna mengirim pesan kepada bot.
2. Telegram mengirim Update ke endpoint webhook.
3. Backend memeriksa secret token webhook.
4. Backend memeriksa apakah update_id sudah tersimpan.
5. Backend membuat atau memperbarui data chat.
6. Backend menyimpan pesan sebagai INBOUND.
7. Backend memperbarui unread count.
8. Backend memancarkan event SSE.
9. Dashboard menampilkan pesan baru.
10. Backend mengembalikan HTTP 200 kepada Telegram.
```

### 12.2 Pesan keluar

```text
1. Administrator mengetik balasan.
2. Frontend mengirim POST ke backend.
3. Backend memvalidasi autentikasi dan isi pesan.
4. Backend membuat data pesan berstatus PENDING.
5. Backend memanggil Telegram sendMessage.
6. Jika berhasil:
   - simpan telegramMessageId;
   - ubah status menjadi SENT;
   - kirim event SSE.
7. Jika gagal:
   - ubah status menjadi FAILED;
   - simpan ringkasan error;
   - kirim event SSE.
8. Frontend memperbarui status pesan.
```

### 12.3 Command `/start`

```text
1. Pengguna mengirim /start.
2. Backend menyimpan command.
3. Backend mengirim pesan sambutan.
4. Pesan sambutan disimpan sebagai OUTBOUND.
5. Dashboard menampilkan kedua pesan.
```

---

## 13. Kebutuhan Fungsional

### FR-001 — Login

- Sistem harus menyediakan halaman login.
- Email atau username dan password wajib diisi.
- Password tidak boleh disimpan dalam bentuk plaintext.
- Login gagal tidak boleh memberitahukan secara spesifik field mana yang salah.
- Setelah login berhasil, pengguna diarahkan ke halaman chat.

**Acceptance criteria:**

- kredensial benar menghasilkan sesi aktif;
- kredensial salah menghasilkan status `401`;
- route dashboard tidak dapat dibuka tanpa sesi;
- logout menghapus sesi.

### FR-002 — Konfigurasi bot

- Administrator dapat menyimpan nama bot dan token bot.
- Token harus dienkripsi sebelum disimpan.
- Token asli tidak boleh dikembalikan oleh API.
- Sistem harus menyediakan tombol uji koneksi bot.
- Sistem harus menampilkan username bot hasil `getMe`.

**Acceptance criteria:**

- token valid menampilkan identitas bot;
- token tidak valid menghasilkan pesan error;
- response API hanya menampilkan token tersamarkan;
- token tidak terlihat di log.

### FR-003 — Pemasangan webhook

- Sistem dapat memasang webhook ke URL aplikasi.
- Sistem harus membuat webhook secret yang kuat.
- Sistem dapat membaca informasi webhook.
- Sistem menampilkan last error webhook apabila tersedia.

**Acceptance criteria:**

- webhook aktif mengarah ke URL backend;
- request tanpa secret yang benar ditolak;
- request valid merespons `200`;
- endpoint webhook tidak menggunakan JWT admin.

### FR-004 — Menerima pesan

- Sistem menerima update bertipe `message`.
- Sistem menangani pesan teks dan command.
- Pesan disimpan tepat satu kali.
- Data pengguna Telegram diperbarui saat berubah.

**Acceptance criteria:**

- pesan masuk muncul di database;
- update yang sama tidak membuat duplikasi;
- `telegramChatId`, `telegramMessageId`, dan `updateId` tersimpan sebagai string;
- payload yang tidak didukung tetap menghasilkan respons aman.

### FR-005 — Daftar chat

- Sistem menampilkan nama, username, pesan terakhir, waktu, dan unread count.
- Daftar diurutkan berdasarkan aktivitas terbaru.
- Administrator dapat mencari berdasarkan nama atau username.

**Acceptance criteria:**

- percakapan terbaru berada paling atas;
- pencarian bersifat case-insensitive;
- chat kosong tidak membuat halaman error.

### FR-006 — Riwayat pesan

- Sistem menampilkan pesan masuk dan keluar.
- Sistem mendukung pagination berbasis cursor.
- Arah pesan dibedakan secara visual.
- Status pesan keluar harus terlihat.

**Acceptance criteria:**

- tidak ada pesan duplikat;
- pagination tidak melewatkan pesan;
- urutan kronologis konsisten;
- pesan gagal memiliki indikator error.

### FR-007 — Mengirim balasan

- Administrator dapat mengirim teks.
- Pesan kosong ditolak.
- Panjang teks dibatasi mengikuti batas Telegram yang berlaku.
- Tombol kirim dinonaktifkan ketika request sedang diproses.

**Acceptance criteria:**

- pesan valid diterima Telegram;
- status berubah dari `PENDING` menjadi `SENT`;
- kegagalan mengubah status menjadi `FAILED`;
- klik berulang tidak membuat pengiriman ganda.

### FR-008 — Real-time

- Sistem menggunakan SSE untuk menyampaikan event.
- Frontend melakukan reconnect otomatis.
- Frontend melakukan refetch apabila koneksi terputus terlalu lama.

**Acceptance criteria:**

- pesan baru tampil tanpa refresh;
- reconnect tidak menggandakan pesan;
- event hanya dapat diakses user terautentikasi.

### FR-009 — Menandai telah dibaca

- Ketika chat dibuka, backend memperbarui waktu terakhir dibaca.
- Unread count dihitung dari pesan masuk setelah waktu tersebut.

**Acceptance criteria:**

- membuka chat mengubah unread menjadi nol;
- pesan baru setelah chat dibaca menambah unread.

### FR-010 — Audit log

- Sistem mencatat aksi penting administrator.
- Audit log tidak boleh menyimpan password atau token lengkap.
- Log minimal berisi actor, action, target, waktu, dan metadata aman.

---

## 14. Kebutuhan Nonfungsional

### 14.1 Keamanan

- seluruh trafik produksi menggunakan HTTPS;
- token Telegram hanya berada di backend;
- token bot dienkripsi menggunakan AES-256-GCM;
- encryption key berasal dari environment variable;
- password di-hash dengan Argon2 atau bcrypt;
- cookie menggunakan `HttpOnly`, `Secure`, dan `SameSite`;
- endpoint login memiliki rate limit;
- endpoint webhook memvalidasi secret header;
- request body memiliki batas ukuran;
- input divalidasi menggunakan DTO;
- error response tidak mengekspos stack trace;
- log melakukan redaction terhadap token dan password;
- CORS hanya mengizinkan origin frontend;
- dependency diperbarui secara berkala.

### 14.2 Performa

Target MVP:

- endpoint daftar chat: p95 kurang dari 500 ms;
- endpoint riwayat pesan: p95 kurang dari 500 ms;
- penyimpanan webhook: normalnya kurang dari 1 detik;
- pesan baru tampil di dashboard kurang dari 3 detik;
- pagination default maksimal 50 data;
- query penting memiliki index.

### 14.3 Reliabilitas

- webhook harus idempotent;
- kegagalan Telegram tidak boleh menghilangkan data pesan keluar;
- file SQLite harus disimpan pada persistent disk;
- aplikasi menyediakan health endpoint;
- backup dapat dipulihkan dan diuji;
- shutdown harus menutup koneksi database dengan benar.

### 14.4 Maintainability

- TypeScript strict mode aktif;
- modul dipisahkan berdasarkan domain;
- controller hanya menangani transport HTTP;
- business logic ditempatkan pada service;
- akses database melalui Prisma service;
- tidak ada penggunaan token langsung di frontend;
- lint, test, dan build harus lulus sebelum merge.

---

## 15. Model Data

Untuk kompatibilitas dan kemudahan migrasi, status disimpan sebagai `String` dengan validasi pada aplikasi.

### 15.1 Prisma Schema

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "sqlite"
}

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  name         String
  passwordHash String
  role         String     @default("ADMIN")
  isActive     Boolean    @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  auditLogs    AuditLog[]
}

model Bot {
  id               String         @id @default(cuid())
  name             String
  telegramBotId    String?        @unique
  username         String?
  tokenCiphertext  String
  tokenIv          String
  tokenAuthTag     String
  tokenLast4       String?
  webhookSecret    String
  webhookUrl       String?
  isActive         Boolean        @default(true)
  lastCheckedAt    DateTime?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  chats            TelegramChat[]
}

model TelegramChat {
  id                String    @id @default(cuid())
  botId             String
  telegramChatId    String
  type              String    @default("PRIVATE")
  firstName         String?
  lastName          String?
  username          String?
  displayName       String?
  lastMessageAt     DateTime?
  lastReadAt        DateTime?
  isBlocked         Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  bot               Bot       @relation(fields: [botId], references: [id], onDelete: Cascade)
  messages          Message[]

  @@unique([botId, telegramChatId])
  @@index([lastMessageAt])
  @@index([username])
}

model Message {
  id                  String       @id @default(cuid())
  chatId              String
  telegramUpdateId    String?      @unique
  telegramMessageId   String?
  clientRequestId     String?      @unique
  direction           String
  type                String       @default("TEXT")
  content             String?
  status              String
  errorCode           String?
  errorMessage        String?
  sentByUserId        String?
  telegramCreatedAt   DateTime?
  sentAt              DateTime?
  failedAt            DateTime?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt
  chat                TelegramChat @relation(fields: [chatId], references: [id], onDelete: Cascade)

  @@index([chatId, createdAt])
  @@index([chatId, status])
}

model AuditLog {
  id          String   @id @default(cuid())
  actorUserId String?
  action      String
  targetType  String?
  targetId    String?
  ipAddress   String?
  userAgent   String?
  metadata    String?
  createdAt   DateTime @default(now())
  actor       User?    @relation(fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([actorUserId, createdAt])
}

model AppSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}
```

### 15.2 Nilai status yang digunakan

#### `Message.direction`

- `INBOUND`
- `OUTBOUND`

#### `Message.type`

- `TEXT`
- `COMMAND`
- `PHOTO`
- `DOCUMENT`
- `UNSUPPORTED`

#### `Message.status`

- pesan masuk: `RECEIVED`;
- pesan keluar baru: `PENDING`;
- sedang dikirim: `SENDING`;
- berhasil: `SENT`;
- gagal: `FAILED`.

---

## 16. Konfigurasi Prisma dan SQLite

### 16.1 `prisma.config.ts`

```typescript
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

### 16.2 Environment database

```env
DATABASE_URL="file:../../../storage/database/app.db"
```

Path harus disesuaikan dengan lokasi `prisma.config.ts` dan cara aplikasi dijalankan.

### 16.3 Rekomendasi SQLite

Pada startup database, aktifkan:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

Tujuan:

- menjaga foreign key;
- meningkatkan pola baca-tulis;
- memberi waktu tunggu ketika database sedang terkunci.

SQLite MVP sebaiknya hanya digunakan oleh satu instance backend.

---

## 17. API Contract

Base path:

```text
/api/v1
```

### 17.1 Authentication

| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/auth/login` | Login admin |
| `POST` | `/auth/logout` | Logout |
| `GET` | `/auth/me` | User aktif |
| `POST` | `/auth/change-password` | Ubah password |

### 17.2 Bot

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/bots` | Daftar bot |
| `POST` | `/bots` | Simpan bot |
| `GET` | `/bots/:id` | Detail bot |
| `PATCH` | `/bots/:id` | Ubah konfigurasi |
| `POST` | `/bots/:id/test` | Panggil `getMe` |
| `POST` | `/bots/:id/webhook` | Pasang webhook |
| `GET` | `/bots/:id/webhook` | Informasi webhook |
| `DELETE` | `/bots/:id/webhook` | Hapus webhook |

### 17.3 Webhook Telegram

| Method | Endpoint | Autentikasi |
|---|---|---|
| `POST` | `/webhooks/telegram/:botId` | Telegram webhook secret |

Endpoint ini tidak menggunakan JWT admin.

### 17.4 Chat

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/chats` | Daftar chat |
| `GET` | `/chats/:id` | Detail chat |
| `GET` | `/chats/:id/messages` | Riwayat pesan |
| `POST` | `/chats/:id/read` | Tandai telah dibaca |

Contoh query:

```text
GET /api/v1/chats?search=budi&cursor=abc&limit=30
```

### 17.5 Message

| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/chats/:id/messages` | Kirim pesan |
| `POST` | `/messages/:id/retry` | Retry pesan gagal |

Contoh request:

```json
{
  "text": "Halo, pesan Anda sudah kami terima.",
  "clientRequestId": "7e62851f-524a-4f9f-a357-98ba217ce326"
}
```

`clientRequestId` digunakan untuk mencegah pengiriman ganda akibat double click atau retry browser.

### 17.6 Events

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/events/stream` | Koneksi SSE |

Event minimal:

```text
message.created
message.updated
chat.updated
bot.status
```

### 17.7 Health

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/health/live` | Proses hidup |
| `GET` | `/health/ready` | Database siap |
| `GET` | `/health/bot` | Koneksi bot |

---

## 18. Format Respons API

### Berhasil

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_123"
  }
}
```

### Gagal

```json
{
  "success": false,
  "error": {
    "code": "MESSAGE_SEND_FAILED",
    "message": "Pesan belum berhasil dikirim."
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

Jangan mengirim raw stack trace atau raw Telegram token pada response.

---

## 19. Webhook Telegram

### 19.1 Header yang diperiksa

Backend harus membaca:

```text
X-Telegram-Bot-Api-Secret-Token
```

Nilainya harus sama dengan webhook secret yang disimpan untuk bot tersebut.

### 19.2 Update yang diizinkan pada MVP

```json
{
  "allowed_updates": [
    "message"
  ]
}
```

### 19.3 Idempotency

Sebelum memproses update:

1. ubah `update_id` menjadi string;
2. cari `telegramUpdateId`;
3. apabila sudah ada, respons `200` tanpa memproses ulang;
4. apabila belum ada, simpan dan proses.

### 19.4 Respons webhook

Webhook harus memberikan respons cepat:

```json
{
  "ok": true
}
```

Proses berat tidak boleh menahan request webhook. Pada MVP, proses yang dilakukan hanya validasi, normalisasi, penyimpanan, command sederhana, dan event SSE.

---

## 20. Halaman Frontend

### 20.1 Login

Komponen:

- logo atau nama aplikasi;
- email;
- password;
- tombol login;
- pesan error umum.

### 20.2 Inbox

Layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ Header: Nama aplikasi | Status Bot | Admin | Logout          │
├───────────────────────┬──────────────────────────────────────┤
│ Search                │ Nama Pengguna                        │
│                       │ @username                            │
│ Daftar Chat           ├──────────────────────────────────────┤
│ - Nama                │ Riwayat Pesan                        │
│ - Pesan terakhir      │                                      │
│ - Waktu               │ Pengguna: Halo                       │
│ - Unread              │ Admin: Halo, ada yang bisa dibantu?  │
│                       │                                      │
│                       ├──────────────────────────────────────┤
│                       │ Input pesan                 [Kirim]   │
└───────────────────────┴──────────────────────────────────────┘
```

### 20.3 Pengaturan bot

Menampilkan:

- nama internal bot;
- username Telegram;
- token tersamarkan;
- status aktif;
- URL webhook;
- last check;
- webhook error;
- tombol tes;
- tombol pasang webhook;
- tombol hapus webhook.

### 20.4 Audit log

Menampilkan:

- waktu;
- nama admin;
- aksi;
- target;
- detail aman.

---

## 21. State Frontend

State utama:

- authenticated user;
- daftar chat;
- chat aktif;
- daftar pesan;
- unread count;
- status SSE;
- status bot;
- status pengiriman.

Aturan sinkronisasi:

1. data awal diambil melalui REST;
2. perubahan baru diterima melalui SSE;
3. event harus di-deduplicate menggunakan ID;
4. setelah reconnect, frontend melakukan refetch data aktif;
5. optimistic update boleh digunakan untuk pesan keluar;
6. status final tetap berasal dari backend.

---

## 22. Environment Variables

Contoh `.env.example`:

```env
NODE_ENV="development"

API_PORT="3001"
WEB_PORT="3000"

WEB_URL="http://localhost:3000"
API_PUBLIC_URL="https://api.example.com"

DATABASE_URL="file:../../../storage/database/app.db"

JWT_ACCESS_SECRET="replace-with-strong-random-value"
JWT_ACCESS_EXPIRES_IN="8h"

COOKIE_NAME="telegram_hub_session"
COOKIE_SECURE="false"

TOKEN_ENCRYPTION_KEY="base64-encoded-32-byte-key"

INITIAL_ADMIN_EMAIL="admin@example.com"
INITIAL_ADMIN_PASSWORD="replace-before-production"

TELEGRAM_REQUEST_TIMEOUT_MS="10000"

LOG_LEVEL="info"
```

Untuk produksi:

- `COOKIE_SECURE=true`;
- gunakan secret random;
- jangan commit file `.env`;
- jangan gunakan password awal setelah setup;
- simpan encryption key pada secret manager atau konfigurasi server yang aman.

---

## 23. Setup Awal

### 23.1 Prasyarat

- Node.js LTS;
- pnpm;
- akun Telegram;
- Telegram Bot Token;
- URL HTTPS publik untuk webhook;
- Git.

### 23.2 Membuat workspace

```bash
mkdir telegram-web-hub
cd telegram-web-hub
pnpm init
```

Buat `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

### 23.3 Membuat frontend

```bash
pnpm create next-app apps/web
```

Gunakan:

- TypeScript;
- App Router;
- ESLint;
- folder `src` opsional;
- Tailwind CSS apabila diperlukan.

### 23.4 Membuat backend

```bash
pnpm dlx @nestjs/cli new apps/api --package-manager pnpm
```

### 23.5 Membuat package database

```bash
mkdir -p packages/database
cd packages/database
pnpm init
```

Pasang dependency Prisma sesuai dokumentasi stable yang digunakan pada saat implementasi. Untuk Prisma versi yang menggunakan driver adapter SQLite, dependency utamanya mencakup:

```bash
pnpm add @prisma/client @prisma/adapter-better-sqlite3 better-sqlite3
pnpm add -D prisma @types/better-sqlite3
```

### 23.6 Inisialisasi Prisma

```bash
pnpm exec prisma init --datasource-provider sqlite
pnpm exec prisma migrate dev --name init
pnpm exec prisma generate
```

### 23.7 Membuat admin awal

Buat script seed yang:

1. membaca `INITIAL_ADMIN_EMAIL`;
2. membaca `INITIAL_ADMIN_PASSWORD`;
3. melakukan hash password;
4. melakukan upsert user admin;
5. tidak mencetak password ke log.

---

## 24. Tahapan Implementasi

## Fase 0 — Fondasi proyek

### Pekerjaan

- membuat repository;
- membuat pnpm workspace;
- membuat Next.js;
- membuat NestJS;
- membuat package database;
- mengatur ESLint dan TypeScript;
- menambahkan `.env.example`;
- membuat health endpoint;
- menyiapkan CI dasar.

### Selesai apabila

- `pnpm install` berhasil;
- `pnpm build` berhasil;
- `pnpm lint` berhasil;
- frontend dan backend dapat dijalankan;
- health endpoint mengembalikan `200`.

---

## Fase 1 — Database dan autentikasi

### Pekerjaan

- membuat schema Prisma;
- membuat migration;
- membuat Prisma module;
- membuat seed admin;
- membuat login;
- membuat JWT cookie;
- membuat auth guard;
- membuat halaman login;
- membuat logout.

### Selesai apabila

- admin dapat login;
- route dashboard terlindungi;
- password tersimpan sebagai hash;
- logout mengakhiri sesi;
- test auth lulus.

---

## Fase 2 — Koneksi Telegram

### Pekerjaan

- membuat Bot module;
- membuat service enkripsi token;
- menyimpan token bot;
- membuat `getMe`;
- membuat webhook secret;
- membuat endpoint set webhook;
- membuat endpoint get webhook info;
- membuat endpoint webhook;
- memvalidasi secret header.

### Selesai apabila

- bot berhasil diuji;
- webhook berhasil terpasang;
- request palsu ditolak;
- update Telegram valid menghasilkan `200`;
- token tidak muncul di response atau log.

---

## Fase 3 — Pesan masuk

### Pekerjaan

- membuat tipe payload Telegram minimal;
- membuat normalizer;
- membuat upsert chat;
- menyimpan pesan masuk;
- menangani `/start`;
- menangani `/help`;
- menerapkan deduplication update;
- membuat endpoint daftar chat;
- membuat endpoint riwayat pesan.

### Selesai apabila

- pesan Telegram tersimpan;
- chat baru otomatis dibuat;
- update ganda tidak membuat pesan ganda;
- daftar chat dan riwayat dapat dibaca API.

---

## Fase 4 — Dashboard percakapan

### Pekerjaan

- membuat layout dashboard;
- membuat sidebar chat;
- membuat conversation panel;
- membuat bubble pesan;
- membuat pagination;
- membuat pencarian;
- membuat unread count;
- membuat mark as read.

### Selesai apabila

- admin dapat membuka chat;
- riwayat tampil benar;
- pencarian bekerja;
- chat terbaru berada di atas;
- unread count diperbarui.

---

## Fase 5 — Pesan keluar

### Pekerjaan

- membuat endpoint kirim pesan;
- membuat `clientRequestId`;
- menyimpan status `PENDING`;
- mengirim ke Telegram;
- menyimpan status `SENT` atau `FAILED`;
- menampilkan status di frontend;
- membuat retry manual.

### Selesai apabila

- pesan dari dashboard diterima Telegram;
- status pesan konsisten;
- double click tidak mengirim dua kali;
- pesan gagal dapat dicoba kembali.

---

## Fase 6 — Real-time SSE

### Pekerjaan

- membuat event service;
- membuat SSE endpoint;
- memancarkan event pesan baru;
- memancarkan perubahan status;
- membuat reconnect frontend;
- membuat refetch setelah reconnect.

### Selesai apabila

- pesan baru tampil tanpa refresh;
- perubahan status tampil otomatis;
- reconnect tidak menggandakan data;
- SSE hanya dapat diakses admin.

---

## Fase 7 — Keamanan, audit, dan deployment

### Pekerjaan

- rate limiting;
- CORS;
- secure cookie;
- log redaction;
- audit log;
- request ID;
- backup database;
- Docker atau process manager;
- HTTPS;
- production environment;
- test restore backup.

### Selesai apabila

- seluruh checklist keamanan lulus;
- file database persisten;
- backup dapat dipulihkan;
- webhook produksi aktif;
- health check produksi lulus.

---

## 25. Strategi Testing

### 25.1 Unit test

Minimal mencakup:

- token encryption dan decryption;
- password hashing;
- Telegram payload normalizer;
- command parser;
- status mapping;
- unread calculation;
- idempotency logic.

### 25.2 Integration test

Minimal mencakup:

- Prisma repository;
- login dan guard;
- create/update bot;
- webhook secret validation;
- upsert chat;
- save inbound message;
- create outbound message.

Gunakan file SQLite khusus test:

```env
DATABASE_URL="file:./test.db"
```

Hapus atau reset database test pada setiap suite sesuai strategi test.

### 25.3 End-to-end test

Minimal mencakup:

1. login;
2. membuka daftar chat;
3. membuka percakapan;
4. mengirim pesan;
5. menampilkan status;
6. logout.

Telegram API sebaiknya di-mock pada automated test agar test tidak mengirim pesan sungguhan.

### 25.4 Manual acceptance test

- kirim `/start`;
- kirim pesan biasa;
- kirim pesan yang sama dua kali;
- restart backend;
- buka dashboard;
- kirim balasan;
- matikan internet sementara;
- uji SSE reconnect;
- gunakan token bot salah;
- uji webhook secret salah;
- uji backup dan restore.

---

## 26. Checklist Keamanan

- [ ] Password menggunakan hash kuat.
- [ ] Bot token dienkripsi.
- [ ] Encryption key tidak disimpan di repository.
- [ ] Token lengkap tidak pernah dikirim ke frontend.
- [ ] Secret webhook divalidasi.
- [ ] JWT/session disimpan dalam HTTP-only cookie.
- [ ] Cookie produksi menggunakan `Secure`.
- [ ] CORS dibatasi.
- [ ] Login memiliki rate limit.
- [ ] Input menggunakan DTO validation.
- [ ] Error produksi tidak menampilkan stack trace.
- [ ] Log melakukan redaction.
- [ ] Database file tidak dapat diakses melalui URL publik.
- [ ] Folder backup tidak dapat diakses publik.
- [ ] Dependency audit dilakukan.
- [ ] Admin mengganti password awal.
- [ ] Endpoint webhook hanya menerima method POST.
- [ ] Payload request memiliki size limit.
- [ ] Audit log tidak menyimpan secret.

---

## 27. Backup SQLite

### Strategi MVP

Simpan:

```text
storage/database/app.db
storage/backups/
```

Backup dapat dilakukan ketika trafik rendah menggunakan mekanisme backup SQLite yang aman atau perintah database yang menghasilkan salinan konsisten.

Contoh penamaan:

```text
app-2026-07-10T020000Z.db
```

Kebijakan awal:

- backup harian;
- simpan 7 backup harian;
- simpan 4 backup mingguan;
- uji restore secara berkala;
- backup disimpan di lokasi berbeda dari disk utama untuk produksi.

Jangan hanya mengandalkan copy file sembarangan ketika proses tulis sedang berlangsung.

---

## 28. Deployment

### 28.1 Kebutuhan server

- Linux server;
- Node.js LTS atau Docker;
- domain;
- HTTPS;
- persistent storage;
- akses outbound ke Telegram API;
- reverse proxy.

### 28.2 Aturan penting SQLite

- jalankan satu instance backend;
- mount folder database sebagai persistent volume;
- jangan menyimpan database di filesystem sementara;
- jangan menjalankan beberapa replica yang menulis ke file yang sama;
- sertakan file database dan backup dalam monitoring disk;
- migrasi dijalankan satu kali sebelum aplikasi aktif.

### 28.3 Contoh volume Docker

```yaml
services:
  api:
    volumes:
      - ./storage/database:/app/storage/database
      - ./storage/backups:/app/storage/backups
```

### 28.4 Urutan deploy

```text
1. Pull source code.
2. Install dependency.
3. Build packages.
4. Jalankan Prisma migrate deploy.
5. Pastikan persistent folder tersedia.
6. Jalankan backend.
7. Jalankan frontend.
8. Periksa health endpoint.
9. Uji koneksi bot.
10. Pasang webhook produksi.
11. Kirim pesan uji.
12. Periksa log dan database.
```

---

## 29. Monitoring dan Logging

Setiap log minimal memiliki:

- timestamp;
- level;
- request ID;
- module;
- message;
- bot ID internal jika relevan;
- chat ID internal jika relevan;
- error code.

Jangan log:

- password;
- password hash;
- bot token;
- encryption key;
- JWT lengkap;
- webhook secret lengkap;
- isi cookie.

Metric awal:

- jumlah webhook diterima;
- jumlah webhook ditolak;
- jumlah pesan masuk;
- jumlah pesan terkirim;
- jumlah pesan gagal;
- waktu proses webhook;
- jumlah koneksi SSE;
- ukuran file database;
- ruang disk tersisa.

---

## 30. Error Handling

Contoh error code internal:

| Code | Keterangan |
|---|---|
| `AUTH_INVALID_CREDENTIALS` | Login salah |
| `AUTH_UNAUTHORIZED` | Sesi tidak valid |
| `BOT_TOKEN_INVALID` | Token bot tidak valid |
| `BOT_NOT_ACTIVE` | Bot tidak aktif |
| `WEBHOOK_SECRET_INVALID` | Secret webhook salah |
| `TELEGRAM_REQUEST_FAILED` | Telegram API gagal |
| `MESSAGE_NOT_FOUND` | Pesan tidak ditemukan |
| `MESSAGE_SEND_FAILED` | Pesan gagal dikirim |
| `CHAT_NOT_FOUND` | Chat tidak ditemukan |
| `DATABASE_BUSY` | SQLite sedang terkunci |
| `VALIDATION_FAILED` | Input tidak valid |

Pesan kepada admin harus jelas, tetapi tidak membocorkan detail sensitif.

---

## 31. Risiko dan Mitigasi

### Risiko 1 — SQLite terkunci

**Penyebab:** banyak proses tulis bersamaan.

**Mitigasi:**

- satu instance backend;
- transaksi singkat;
- aktifkan WAL dan busy timeout;
- hindari query lambat;
- migrasi ke PostgreSQL ketika concurrency meningkat.

### Risiko 2 — Pesan Telegram diproses dua kali

**Penyebab:** Telegram melakukan retry atau backend menerima request berulang.

**Mitigasi:**

- `telegramUpdateId` unique;
- proses idempotent;
- response webhook cepat.

### Risiko 3 — Pesan keluar terkirim dua kali

**Penyebab:** double click atau retry frontend.

**Mitigasi:**

- `clientRequestId` unique;
- disable tombol saat request;
- backend memeriksa idempotency key.

### Risiko 4 — Bot token bocor

**Mitigasi:**

- enkripsi token;
- redaction log;
- token tidak masuk frontend;
- environment key terpisah;
- rotasi token apabila terjadi kebocoran.

### Risiko 5 — Data hilang

**Mitigasi:**

- persistent volume;
- backup terjadwal;
- restore test;
- monitoring disk.

### Risiko 6 — Webhook tidak dapat diakses

**Mitigasi:**

- HTTPS valid;
- health monitoring;
- halaman webhook status;
- catat last error;
- endpoint tidak melalui autentikasi admin.

---

## 32. Kapan Harus Migrasi dari SQLite

Pertimbangkan PostgreSQL apabila:

- backend perlu dijalankan lebih dari satu instance;
- jumlah penulisan paralel meningkat;
- sering terjadi `database is locked`;
- aplikasi menjadi multi-tenant;
- banyak bot aktif;
- sistem multi-agent membuat banyak job;
- dibutuhkan high availability;
- ukuran data dan kebutuhan analitik meningkat;
- deployment dilakukan pada platform dengan filesystem sementara.

Karena akses data menggunakan Prisma, struktur domain dapat dipertahankan, tetapi migration data tetap harus direncanakan dan diuji.

---

## 33. Roadmap Setelah MVP

### Tahap 2

- upload dan penerimaan foto;
- penerimaan dokumen;
- template balasan;
- tag percakapan;
- assignment admin;
- role admin dan operator;
- status online operator;
- export percakapan.

### Tahap 3

- banyak bot;
- banyak user dashboard;
- autoresponder;
- rule engine;
- scheduled message;
- notifikasi browser;
- analytics.

### Tahap 4 — AI

- klasifikasi intent;
- pembuatan draft balasan;
- knowledge base;
- approval sebelum AI mengirim;
- ringkasan percakapan;
- pencarian semantik.

### Tahap 5 — Multi-agent

Contoh alur:

```text
Telegram User
     │
     ▼
Agent Orchestrator
     │
     ├── Agent A: memahami dan mengerjakan permintaan
     │
     ├── Agent B: review dan bug checking
     │
     └── Agent C: validasi hasil akhir
     │
     ▼
Approval Dashboard
     │
     ▼
Telegram User
```

Data tambahan yang diperlukan:

- project;
- task;
- agent;
- agent run;
- agent message;
- artifact;
- approval;
- execution log.

Multi-agent tidak boleh digabungkan ke MVP sebelum komunikasi dasar, keamanan, idempotency, dan audit log stabil.

---

## 34. Definition of Done MVP

MVP dinyatakan selesai jika seluruh kondisi berikut terpenuhi:

### Project

- [ ] Monorepo dapat di-install dari kondisi bersih.
- [ ] Build frontend dan backend berhasil.
- [ ] Lint berhasil.
- [ ] Test wajib berhasil.
- [ ] `.env.example` tersedia.
- [ ] README setup tersedia.

### Authentication

- [ ] Admin dapat login dan logout.
- [ ] Dashboard terlindungi.
- [ ] Password tersimpan sebagai hash.
- [ ] Cookie produksi aman.

### Telegram

- [ ] Bot dapat diuji melalui `getMe`.
- [ ] Webhook dapat dipasang.
- [ ] Secret webhook divalidasi.
- [ ] Pesan masuk disimpan.
- [ ] Update ganda tidak menghasilkan duplikasi.
- [ ] Balasan dashboard diterima Telegram.

### Dashboard

- [ ] Daftar chat tersedia.
- [ ] Riwayat pesan tersedia.
- [ ] Pencarian tersedia.
- [ ] Unread count tersedia.
- [ ] Pesan dapat dikirim.
- [ ] Status pesan terlihat.
- [ ] Real-time berjalan.

### Database

- [ ] SQLite berada pada persistent storage.
- [ ] Migration terdokumentasi.
- [ ] Backup berhasil.
- [ ] Restore berhasil diuji.

### Security and Operations

- [ ] Token dienkripsi.
- [ ] Secret tidak muncul di log.
- [ ] Rate limit tersedia.
- [ ] Health endpoint tersedia.
- [ ] Audit log tersedia.
- [ ] HTTPS aktif di produksi.

---

## 35. Urutan Pengerjaan yang Disarankan

Jangan langsung membuat seluruh UI. Gunakan urutan berikut:

```text
1. Repository dan monorepo.
2. NestJS health endpoint.
3. Prisma dan SQLite.
4. Admin seed dan login.
5. Penyimpanan bot terenkripsi.
6. Telegram getMe.
7. Webhook.
8. Simpan pesan masuk.
9. Endpoint daftar chat.
10. Endpoint riwayat pesan.
11. Dashboard chat.
12. Kirim balasan.
13. Status pesan.
14. SSE real-time.
15. Audit dan keamanan.
16. Backup dan deployment.
17. Automated test.
18. Dokumentasi akhir.
```

Setiap langkah harus lulus build dan test sebelum melanjutkan ke langkah berikutnya.

---

## 36. Catatan Implementasi Penting

1. Jangan memanggil Telegram API langsung dari Next.js client.
2. Jangan menyimpan token bot di `localStorage`.
3. Jangan menggunakan ID Telegram sebagai JavaScript integer; ubah menjadi string.
4. Jangan menganggap webhook hanya dikirim sekali.
5. Jangan mengembalikan error internal mentah.
6. Jangan menaruh file SQLite di folder yang dapat diakses publik.
7. Jangan menjalankan banyak backend replica menggunakan satu file SQLite.
8. Jangan mengembangkan AI sebelum jalur pesan dasar stabil.
9. Simpan seluruh waktu dalam UTC dan ubah zona waktu hanya pada tampilan.
10. Gunakan cursor pagination, bukan mengambil seluruh pesan sekaligus.
11. Gunakan `clientRequestId` untuk idempotency pesan keluar.
12. Gunakan transaksi hanya ketika benar-benar diperlukan dan buat sesingkat mungkin.

---

## 37. Ringkasan Hasil Akhir

Setelah PRD ini selesai diimplementasikan, aplikasi memiliki kemampuan berikut:

```text
Pengguna mengirim pesan melalui Telegram
                ↓
Webhook menerima dan memvalidasi pesan
                ↓
Pesan disimpan satu kali ke SQLite
                ↓
Dashboard menampilkan pesan secara real-time
                ↓
Administrator mengirim balasan dari web
                ↓
Backend mengirim balasan melalui Telegram Bot API
                ↓
Status pesan dan aktivitas tersimpan
```

Fondasi tersebut sudah cukup untuk dikembangkan menjadi platform komunikasi Telegram yang lebih besar, termasuk autoresponder, AI assistant, dan sistem multi-agent.
