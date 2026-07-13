# PRD dan Panduan Pengembangan Aplikasi Network Monitoring

## 1. Ringkasan Proyek

### Nama Proyek

**NetWatch — Web-Based IP Monitoring Dashboard**

### Deskripsi

NetWatch adalah aplikasi berbasis web untuk memantau koneksi beberapa alamat IP secara berkala. Setiap perangkat akan diperiksa melalui ICMP ping, TCP port check, atau HTTP health check.

Status perangkat ditampilkan secara real-time dalam satu dashboard. Ketika perangkat terputus, mengalami keterlambatan tinggi, atau kembali online, aplikasi dapat mengirimkan notifikasi melalui Telegram.

### Tujuan Utama

1. Memantau banyak alamat IP dalam satu layar.
2. Menampilkan status perangkat secara real-time.
3. Mengirim notifikasi ketika perangkat offline.
4. Mengirim notifikasi ketika perangkat kembali online.
5. Menyimpan riwayat gangguan dan latency.
6. Menampilkan persentase uptime perangkat.
7. Mengurangi false alarm akibat kegagalan ping sesaat.

---

## 2. Permasalahan yang Diselesaikan

Pemantauan perangkat jaringan secara manual memiliki beberapa kelemahan:

- Admin harus melakukan ping satu per satu.
- Gangguan sering terlambat diketahui.
- Tidak ada catatan waktu perangkat mulai offline.
- Tidak ada data durasi gangguan.
- Tidak ada laporan uptime.
- Satu kali ping gagal dapat dianggap sebagai gangguan, padahal mungkin hanya packet loss sesaat.

NetWatch mengotomatisasi proses tersebut dan menyajikan kondisi jaringan dalam satu dashboard.

---

## 3. Target Pengguna

Aplikasi dapat digunakan oleh:

- Administrator jaringan.
- Teknisi IT.
- Pengelola laboratorium komputer.
- Pengelola CCTV.
- Sekolah dan kampus.
- Kantor.
- Warnet.
- Data center kecil.
- Pengelola access point dan router.
- Pengelola server lokal.

---

## 4. Ruang Lingkup MVP

Versi pertama atau Minimum Viable Product harus memiliki fitur berikut:

### 4.1 Autentikasi

- Login admin.
- Logout.
- Password disimpan dalam bentuk hash.
- Hanya admin yang dapat menambah, mengubah, dan menghapus perangkat.

### 4.2 Manajemen Perangkat

Admin dapat:

- Menambah perangkat.
- Mengubah perangkat.
- Menghapus perangkat.
- Mengaktifkan atau menonaktifkan monitoring.
- Menentukan interval pengecekan.
- Menentukan timeout.
- Menentukan batas latency warning.
- Mengelompokkan perangkat.

Data perangkat minimal:

- Nama perangkat.
- Alamat IP atau hostname.
- Grup.
- Jenis pemeriksaan.
- Port jika menggunakan TCP.
- URL jika menggunakan HTTP.
- Interval pemeriksaan.
- Timeout.
- Failure threshold.
- Recovery threshold.
- Status aktif.

### 4.3 Monitoring

Aplikasi melakukan pemeriksaan otomatis terhadap perangkat aktif.

Metode pemeriksaan:

- ICMP ping.
- TCP port check.
- HTTP health check.

Data hasil pemeriksaan:

- Status berhasil atau gagal.
- Latency.
- Waktu pemeriksaan.
- Pesan error.
- Jumlah kegagalan berturut-turut.
- Jumlah keberhasilan berturut-turut.

### 4.4 Status Perangkat

Status perangkat:

| Status | Keterangan |
|---|---|
| `UNKNOWN` | Belum pernah diperiksa |
| `ONLINE` | Perangkat merespons normal |
| `WARNING` | Latency tinggi atau mulai mengalami kegagalan |
| `OFFLINE` | Gagal setelah melewati failure threshold |
| `MAINTENANCE` | Perangkat sedang dalam pemeliharaan |
| `DISABLED` | Monitoring dinonaktifkan |

### 4.5 Dashboard Real-Time

Dashboard menampilkan:

- Total perangkat.
- Total online.
- Total warning.
- Total offline.
- Total maintenance.
- Nama perangkat.
- IP atau hostname.
- Grup perangkat.
- Status.
- Latency terakhir.
- Waktu pemeriksaan terakhir.
- Waktu terakhir online.
- Durasi offline.
- Metode pemeriksaan.

Dashboard harus dapat diperbarui tanpa reload halaman menggunakan WebSocket atau Server-Sent Events.

### 4.6 Notifikasi Telegram

Notifikasi dikirim saat:

- Perangkat berubah dari online menjadi offline.
- Perangkat berubah dari offline menjadi online.
- Perangkat mengalami latency tinggi dalam waktu tertentu.
- Perangkat tetap offline dalam durasi tertentu, jika reminder diaktifkan.

Aplikasi tidak boleh mengirim notifikasi berulang setiap kali ping gagal.

### 4.7 Riwayat Gangguan

Aplikasi menyimpan:

- Waktu gangguan dimulai.
- Waktu gangguan selesai.
- Durasi gangguan.
- Penyebab atau error terakhir.
- Jumlah pemeriksaan gagal.
- Status notifikasi.

---

## 5. Rekomendasi Teknologi

### 5.1 Stack Utama

```text
Frontend      : React + Vite
UI            : Tailwind CSS
Backend       : Node.js + Express
Realtime      : Socket.IO
Database      : SQLite
ORM           : Prisma
Queue/Worker  : Node.js worker internal
Notification  : Telegram Bot API
Authentication: JWT atau session-based authentication
Deployment    : Docker
```

### 5.2 Alasan Pemilihan

#### React

React cocok untuk dashboard karena:

- Mudah mengelola data yang berubah terus-menerus.
- Komponen dapat digunakan kembali.
- Mudah menambahkan filter, grafik, dan tabel.

#### Node.js

Node.js cocok untuk:

- Menjalankan banyak proses pengecekan secara asynchronous.
- Mengelola WebSocket.
- Mengintegrasikan Telegram.
- Menangani API frontend.

#### SQLite

SQLite cocok untuk versi awal karena:

- Tidak perlu server database tambahan.
- Mudah digunakan.
- File database dapat dipindahkan.
- Cocok untuk skala kecil hingga menengah.

Untuk penggunaan besar, database dapat dipindahkan ke PostgreSQL.

#### Socket.IO

Socket.IO digunakan agar perubahan status perangkat dikirim langsung ke browser tanpa polling berlebihan.

---

## 6. Arsitektur Sistem

```text
┌────────────────────────────┐
│        Web Browser         │
│ React + Tailwind CSS       │
└─────────────┬──────────────┘
              │ REST API
              │ WebSocket
┌─────────────▼──────────────┐
│     Express API Server     │
│ Auth, Device, Incident API │
└───────┬───────────┬────────┘
        │           │
        │           │
┌───────▼──────┐ ┌──▼────────────────┐
│   SQLite     │ │ Monitoring Worker │
│   Prisma     │ │ ICMP/TCP/HTTP     │
└──────────────┘ └──────┬────────────┘
                        │
             ┌──────────▼──────────┐
             │ Device / Router /   │
             │ Server / CCTV / AP  │
             └─────────────────────┘

Monitoring Worker
        │
        ▼
Telegram Notification
```

---

## 7. Cara Kerja Monitoring

### 7.1 Alur Pemeriksaan

1. Worker membaca daftar perangkat aktif.
2. Worker menentukan perangkat yang sudah waktunya diperiksa.
3. Worker menjalankan metode check sesuai konfigurasi.
4. Worker menghitung latency.
5. Worker menyimpan hasil pemeriksaan.
6. Worker memperbarui status perangkat.
7. Worker mendeteksi perubahan status.
8. Worker membuat atau menutup incident.
9. Worker mengirim notifikasi jika diperlukan.
10. Worker mengirim pembaruan ke dashboard melalui Socket.IO.

### 7.2 Aturan Failure Threshold

Satu kali kegagalan tidak langsung dianggap offline.

Contoh aturan:

```text
0 kegagalan             = ONLINE
1 kegagalan berturut    = ONLINE
2 kegagalan berturut    = WARNING
3 kegagalan berturut    = OFFLINE
```

Nilai `3` harus dapat diubah melalui pengaturan perangkat.

### 7.3 Aturan Recovery Threshold

Perangkat yang offline tidak langsung dianggap pulih hanya karena satu kali berhasil.

Contoh:

```text
1 keberhasilan setelah offline = masih OFFLINE
2 keberhasilan berturut-turut  = ONLINE
```

Tujuannya untuk mencegah status naik-turun terlalu cepat.

### 7.4 Aturan Latency

Contoh nilai awal:

| Latency | Status |
|---|---|
| 0–50 ms | Normal |
| 51–150 ms | Sedang |
| 151–300 ms | Lambat |
| Di atas 300 ms | Sangat lambat |
| Timeout | Gagal |

Batas latency harus dapat disesuaikan untuk setiap perangkat.

### 7.5 Status Transition

```text
UNKNOWN → ONLINE
UNKNOWN → WARNING
UNKNOWN → OFFLINE

ONLINE → WARNING
ONLINE → OFFLINE

WARNING → ONLINE
WARNING → OFFLINE

OFFLINE → ONLINE
OFFLINE → WARNING

ANY STATUS → MAINTENANCE
MAINTENANCE → UNKNOWN
```

---

## 8. Metode Pemeriksaan

### 8.1 ICMP Ping

Digunakan untuk mengetahui apakah perangkat merespons ping.

Cocok untuk:

- Router.
- Access point.
- Komputer.
- Server.
- CCTV.
- Switch yang memiliki IP management.

Kelemahan:

- Beberapa perangkat memblokir ICMP.
- Perangkat dapat aktif tetapi tidak merespons ping.

Contoh library Node.js:

```bash
pnpm add ping
```

Contoh fungsi:

```javascript
import ping from "ping";

export async function checkIcmp(host, timeoutSeconds = 2) {
  try {
    const result = await ping.promise.probe(host, {
      timeout: timeoutSeconds,
      min_reply: 1,
    });

    return {
      success: result.alive,
      latency: result.alive ? Number(result.time) : null,
      error: result.alive ? null : "ICMP timeout",
    };
  } catch (error) {
    return {
      success: false,
      latency: null,
      error: error instanceof Error ? error.message : "Unknown ICMP error",
    };
  }
}
```

### 8.2 TCP Port Check

Digunakan untuk mengetahui apakah suatu port dapat diakses.

Contoh port:

- `22` untuk SSH.
- `80` untuk HTTP.
- `443` untuk HTTPS.
- `3306` untuk MySQL.
- `5432` untuk PostgreSQL.
- `3389` untuk Remote Desktop.

Contoh fungsi:

```javascript
import net from "node:net";

export function checkTcp(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const startedAt = Date.now();

    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      finish({
        success: true,
        latency: Date.now() - startedAt,
        error: null,
      });
    });

    socket.once("timeout", () => {
      finish({
        success: false,
        latency: null,
        error: "TCP timeout",
      });
    });

    socket.once("error", (error) => {
      finish({
        success: false,
        latency: null,
        error: error.message,
      });
    });

    socket.connect(port, host);
  });
}
```

### 8.3 HTTP Health Check

Digunakan untuk memastikan aplikasi web atau API benar-benar berfungsi.

Contoh fungsi:

```javascript
export async function checkHttp(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    return {
      success: response.ok,
      latency: Date.now() - startedAt,
      statusCode: response.status,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      latency: null,
      statusCode: null,
      error: error instanceof Error ? error.message : "HTTP request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
```

---

## 9. Struktur Database

### 9.1 Tabel User

```text
users
- id
- name
- email
- password_hash
- role
- created_at
- updated_at
```

### 9.2 Tabel Group

```text
device_groups
- id
- name
- description
- created_at
- updated_at
```

### 9.3 Tabel Device

```text
devices
- id
- name
- host
- group_id
- check_type
- port
- url
- interval_seconds
- timeout_ms
- warning_latency_ms
- failure_threshold
- recovery_threshold
- current_status
- consecutive_failures
- consecutive_successes
- last_latency_ms
- last_checked_at
- last_online_at
- last_offline_at
- is_active
- is_maintenance
- created_at
- updated_at
```

### 9.4 Tabel Monitoring Result

```text
monitoring_results
- id
- device_id
- success
- status
- latency_ms
- error_message
- checked_at
```

### 9.5 Tabel Incident

```text
incidents
- id
- device_id
- status
- started_at
- ended_at
- duration_seconds
- opening_message
- closing_message
- created_at
- updated_at
```

### 9.6 Tabel Notification Log

```text
notification_logs
- id
- device_id
- incident_id
- channel
- notification_type
- message
- success
- error_message
- sent_at
```

### 9.7 Tabel Application Setting

```text
application_settings
- id
- key
- value
- updated_at
```

Contoh key:

```text
telegram_bot_token
telegram_chat_id
default_interval_seconds
default_timeout_ms
offline_reminder_minutes
retention_days
```

---

## 10. Contoh Prisma Schema

```prisma
enum DeviceStatus {
  UNKNOWN
  ONLINE
  WARNING
  OFFLINE
  MAINTENANCE
  DISABLED
}

enum CheckType {
  ICMP
  TCP
  HTTP
}

model DeviceGroup {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  description String?
  devices     Device[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Device {
  id                   Int              @id @default(autoincrement())
  name                 String
  host                 String
  groupId              Int?
  group                DeviceGroup?     @relation(fields: [groupId], references: [id])
  checkType            CheckType        @default(ICMP)
  port                 Int?
  url                  String?
  intervalSeconds      Int              @default(5)
  timeoutMs            Int              @default(2000)
  warningLatencyMs     Int              @default(150)
  failureThreshold     Int              @default(3)
  recoveryThreshold    Int              @default(2)
  currentStatus        DeviceStatus     @default(UNKNOWN)
  consecutiveFailures  Int              @default(0)
  consecutiveSuccesses Int              @default(0)
  lastLatencyMs        Float?
  lastCheckedAt        DateTime?
  lastOnlineAt         DateTime?
  lastOfflineAt        DateTime?
  isActive             Boolean          @default(true)
  isMaintenance        Boolean          @default(false)
  results              MonitoringResult[]
  incidents            Incident[]
  notifications        NotificationLog[]
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt
}

model MonitoringResult {
  id           Int          @id @default(autoincrement())
  deviceId     Int
  device       Device       @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  success      Boolean
  status       DeviceStatus
  latencyMs    Float?
  errorMessage String?
  checkedAt    DateTime     @default(now())

  @@index([deviceId, checkedAt])
}

model Incident {
  id              Int       @id @default(autoincrement())
  deviceId        Int
  device          Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  status          String    @default("OPEN")
  startedAt       DateTime  @default(now())
  endedAt         DateTime?
  durationSeconds Int?
  openingMessage  String?
  closingMessage  String?
  notifications   NotificationLog[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([deviceId, startedAt])
}

model NotificationLog {
  id               Int      @id @default(autoincrement())
  deviceId         Int
  device           Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  incidentId       Int?
  incident         Incident? @relation(fields: [incidentId], references: [id], onDelete: SetNull)
  channel          String
  notificationType String
  message          String
  success          Boolean
  errorMessage     String?
  sentAt           DateTime @default(now())
}
```

---

## 11. Struktur Folder Proyek

Rekomendasi menggunakan monorepo:

```text
netwatch/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── controllers/
│   │   │   ├── middlewares/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   │   ├── monitoring/
│   │   │   │   │   ├── icmp.service.js
│   │   │   │   │   ├── tcp.service.js
│   │   │   │   │   ├── http.service.js
│   │   │   │   │   ├── status.service.js
│   │   │   │   │   └── worker.service.js
│   │   │   │   ├── telegram.service.js
│   │   │   │   ├── incident.service.js
│   │   │   │   └── auth.service.js
│   │   │   ├── socket/
│   │   │   ├── utils/
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.js
│   │   ├── package.json
│   │   └── .env.example
│   │
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── hooks/
│       │   ├── services/
│       │   ├── stores/
│       │   ├── utils/
│       │   ├── App.jsx
│       │   └── main.jsx
│       ├── package.json
│       └── vite.config.js
│
├── docker/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── README.md
└── .gitignore
```

---

## 12. Desain API

### 12.1 Authentication

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

### 12.2 Device

```text
GET    /api/devices
GET    /api/devices/:id
POST   /api/devices
PUT    /api/devices/:id
DELETE /api/devices/:id
POST   /api/devices/:id/check
PATCH  /api/devices/:id/toggle
PATCH  /api/devices/:id/maintenance
```

### 12.3 Group

```text
GET    /api/groups
POST   /api/groups
PUT    /api/groups/:id
DELETE /api/groups/:id
```

### 12.4 Monitoring Result

```text
GET /api/devices/:id/results
GET /api/devices/:id/results?from=...&to=...
GET /api/devices/:id/latency
```

### 12.5 Incident

```text
GET /api/incidents
GET /api/incidents/:id
GET /api/incidents?status=OPEN
GET /api/devices/:id/incidents
```

### 12.6 Dashboard

```text
GET /api/dashboard/summary
GET /api/dashboard/devices
GET /api/dashboard/recent-incidents
```

### 12.7 Notification

```text
GET  /api/settings/telegram
PUT  /api/settings/telegram
POST /api/settings/telegram/test
```

---

## 13. Contoh Response API

### Daftar Perangkat

```json
{
  "data": [
    {
      "id": 1,
      "name": "Router Utama",
      "host": "192.168.1.1",
      "group": "Router",
      "checkType": "ICMP",
      "status": "ONLINE",
      "latencyMs": 3,
      "lastCheckedAt": "2026-07-13T09:20:10.000Z",
      "lastOnlineAt": "2026-07-13T09:20:10.000Z",
      "consecutiveFailures": 0
    }
  ]
}
```

### Ringkasan Dashboard

```json
{
  "total": 20,
  "online": 16,
  "warning": 2,
  "offline": 1,
  "maintenance": 1
}
```

---

## 14. WebSocket Event

Server mengirim event berikut:

```text
device:updated
device:online
device:warning
device:offline
incident:opened
incident:closed
dashboard:summary
```

Contoh payload:

```json
{
  "event": "device:offline",
  "data": {
    "id": 4,
    "name": "CCTV Gudang",
    "host": "192.168.1.25",
    "status": "OFFLINE",
    "lastCheckedAt": "2026-07-13T09:20:10.000Z",
    "consecutiveFailures": 3,
    "error": "ICMP timeout"
  }
}
```

Contoh penggunaan pada React:

```javascript
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_API_URL);

socket.on("device:updated", (device) => {
  console.log("Device updated:", device);
});

socket.on("dashboard:summary", (summary) => {
  console.log("Summary:", summary);
});
```

---

## 15. Logika Perubahan Status

Pseudo-code:

```text
function determineStatus(device, result):

    if device.isMaintenance:
        return MAINTENANCE

    if not device.isActive:
        return DISABLED

    if result.success:
        device.consecutiveFailures = 0
        device.consecutiveSuccesses += 1

        if device.currentStatus == OFFLINE:
            if device.consecutiveSuccesses >= device.recoveryThreshold:
                return ONLINE
            else:
                return OFFLINE

        if result.latency > device.warningLatencyMs:
            return WARNING

        return ONLINE

    else:
        device.consecutiveSuccesses = 0
        device.consecutiveFailures += 1

        if device.consecutiveFailures >= device.failureThreshold:
            return OFFLINE

        if device.consecutiveFailures >= 2:
            return WARNING

        return device.currentStatus
```

Pseudocode incident:

```text
if oldStatus != OFFLINE and newStatus == OFFLINE:
    create incident
    send offline notification

if oldStatus == OFFLINE and newStatus == ONLINE:
    close active incident
    calculate downtime
    send recovery notification
```

---

## 16. Monitoring Scheduler

Hindari penggunaan satu `setInterval` untuk setiap perangkat jika jumlah perangkat besar.

Gunakan satu scheduler utama:

```text
Setiap 1 detik:
1. Cari perangkat yang lastCheckedAt + intervalSeconds <= waktu sekarang.
2. Ambil maksimal sejumlah perangkat.
3. Jalankan check dengan concurrency limit.
4. Simpan hasil.
5. Kirim update.
```

Contoh dengan `p-limit`:

```bash
pnpm add p-limit
```

```javascript
import pLimit from "p-limit";

const limit = pLimit(20);

const tasks = devices.map((device) =>
  limit(() => monitorDevice(device))
);

await Promise.allSettled(tasks);
```

Nilai concurrency awal yang disarankan:

```text
1–20 perangkat      : concurrency 10
21–100 perangkat    : concurrency 20
101–500 perangkat   : concurrency 30–50
```

---

## 17. Notifikasi Telegram

### 17.1 Membuat Bot

1. Buka Telegram.
2. Cari `@BotFather`.
3. Jalankan perintah `/newbot`.
4. Masukkan nama bot.
5. Masukkan username bot.
6. Simpan bot token.
7. Tambahkan bot ke grup atau chat tujuan.
8. Dapatkan `chat_id`.

### 17.2 Environment Variable

```env
TELEGRAM_BOT_TOKEN=123456:ABCDEF
TELEGRAM_CHAT_ID=-1001234567890
```

### 17.3 Fungsi Kirim Pesan

```javascript
export async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Telegram configuration is incomplete");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Telegram API returned ${response.status}`);
  }

  return response.json();
}
```

### 17.4 Format Notifikasi Offline

```text
🔴 PERANGKAT OFFLINE

Nama       : Router Kantor
IP         : 192.168.1.1
Grup       : Router
Metode     : ICMP
Mulai Gagal: 13 Juli 2026, 16:20:48
Percobaan  : 3 kali
Error      : ICMP timeout
```

### 17.5 Format Notifikasi Recovery

```text
🟢 PERANGKAT KEMBALI ONLINE

Nama       : Router Kantor
IP         : 192.168.1.1
Pulih Pada : 13 Juli 2026, 16:25:06
Downtime   : 4 menit 18 detik
Latency    : 5 ms
```

### 17.6 Aturan Anti-Spam

- Kirim hanya ketika status berubah.
- Jangan kirim pesan setiap ping gagal.
- Reminder offline maksimal setiap 30–60 menit.
- Notifikasi warning dapat diaktifkan atau dinonaktifkan.
- Recovery notification dikirim hanya setelah recovery threshold terpenuhi.

---

## 18. Desain Dashboard

### 18.1 Bagian Header

Tampilkan:

- Nama aplikasi.
- Waktu server.
- Status koneksi WebSocket.
- Tombol tambah perangkat.
- Tombol refresh manual.
- Profil pengguna.

### 18.2 Summary Card

```text
Total        : 20
Online       : 16
Warning      : 2
Offline      : 1
Maintenance  : 1
```

### 18.3 Tabel Perangkat

Kolom yang disarankan:

| Kolom | Keterangan |
|---|---|
| Nama | Nama perangkat |
| IP/Host | Alamat IP atau hostname |
| Grup | Kelompok perangkat |
| Metode | ICMP, TCP, atau HTTP |
| Status | Online, warning, offline |
| Latency | Latency terakhir |
| Last Check | Waktu pemeriksaan terakhir |
| Downtime | Lama offline |
| Aksi | Detail, edit, check manual |

### 18.4 Filter

Dashboard harus memiliki:

- Search nama atau IP.
- Filter grup.
- Filter status.
- Filter metode check.
- Urutan berdasarkan status.
- Urutan berdasarkan latency.
- Tampilkan hanya perangkat offline.

### 18.5 Tampilan Detail Perangkat

Halaman detail perangkat menampilkan:

- Nama dan alamat perangkat.
- Status saat ini.
- Latency terakhir.
- Rata-rata latency.
- Uptime 24 jam.
- Uptime 7 hari.
- Uptime 30 hari.
- Grafik latency.
- Riwayat incident.
- Riwayat hasil pemeriksaan.
- Tombol manual check.
- Tombol maintenance.

---

## 19. Rekomendasi UI

### Warna Status

```text
ONLINE       : Hijau
WARNING      : Kuning atau oranye
OFFLINE      : Merah
MAINTENANCE  : Biru
UNKNOWN      : Abu-abu
DISABLED     : Abu-abu gelap
```

### Ketentuan Tampilan

- Warna bukan satu-satunya penanda.
- Selalu tampilkan teks status.
- Tambahkan ikon status.
- Hindari animasi berlebihan.
- Gunakan tabel untuk banyak perangkat.
- Gunakan card untuk perangkat penting.
- Pastikan dashboard responsif.

---

## 20. Keamanan

### 20.1 Validasi Host

Alamat IP dan hostname harus divalidasi.

Jangan menerima input seperti:

```text
192.168.1.1 && rm -rf /
```

Jika menggunakan command system, jangan merangkai command dari input pengguna secara langsung.

Lebih aman menggunakan library ping yang tidak bergantung pada shell command bebas.

### 20.2 Server-Side Request Forgery

HTTP health check berpotensi digunakan untuk mengakses resource internal yang tidak seharusnya.

Batasi:

- Protocol hanya `http` dan `https`.
- Port tertentu jika diperlukan.
- Host yang boleh dipantau.
- Redirect maksimal.
- Timeout request.
- Ukuran response.

### 20.3 Authentication

- Gunakan bcrypt atau argon2.
- Gunakan HTTP-only cookie jika memakai session.
- Tambahkan rate limit pada login.
- Jangan menyimpan password biasa.
- Jangan menampilkan bot token pada frontend.

### 20.4 Permission

Proses ping kadang membutuhkan permission tertentu pada Linux.

Gunakan container atau konfigurasi capability:

```yaml
cap_add:
  - NET_RAW
```

### 20.5 Audit Log

Simpan aktivitas penting:

- Login.
- Tambah perangkat.
- Edit perangkat.
- Hapus perangkat.
- Maintenance.
- Perubahan pengaturan Telegram.

---

## 21. Penyimpanan Data dan Retention

Hasil ping dapat bertambah sangat cepat.

Contoh:

```text
20 perangkat × setiap 5 detik
= 240 hasil per menit
= 14.400 hasil per jam
= 345.600 hasil per hari
```

Karena itu gunakan strategi retention.

Rekomendasi:

```text
Raw monitoring result : simpan 7–30 hari
Incident              : simpan permanen
Daily uptime summary  : simpan permanen
Notification log      : simpan 90 hari
```

Tambahkan scheduled cleanup setiap malam.

Alternatif:

- Simpan semua hasil selama 7 hari.
- Setelah itu agregasikan menjadi rata-rata per 5 menit.
- Setelah 30 hari agregasikan menjadi rata-rata per jam.

---

## 22. Uptime Calculation

Rumus uptime:

```text
Uptime (%) =
Total waktu online
------------------ × 100
Total waktu pemantauan
```

Cara sederhana:

```text
Uptime (%) =
Jumlah check berhasil
--------------------- × 100
Total check
```

Cara yang lebih akurat menggunakan durasi incident.

Contoh:

```text
Total waktu periode : 24 jam
Total downtime      : 20 menit

Uptime =
(1440 - 20) / 1440 × 100
= 98,61%
```

---

## 23. Environment Variable

Contoh `.env.example`:

```env
NODE_ENV=development
PORT=3001
WEB_URL=http://localhost:5173

DATABASE_URL=file:./dev.db

JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=1d

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

DEFAULT_CHECK_INTERVAL_SECONDS=5
DEFAULT_TIMEOUT_MS=2000
MONITORING_CONCURRENCY=20
MONITORING_RESULT_RETENTION_DAYS=30
OFFLINE_REMINDER_MINUTES=60
```

---

## 24. Langkah Pengembangan

### Fase 1 — Inisialisasi Proyek

1. Buat monorepo.
2. Buat React frontend.
3. Buat Express backend.
4. Pasang Prisma dan SQLite.
5. Buat environment variable.
6. Buat endpoint health check.

Contoh:

```bash
mkdir netwatch
cd netwatch
pnpm init
```

Buat workspace:

```yaml
packages:
  - "apps/*"
```

### Fase 2 — Database

1. Buat Prisma schema.
2. Jalankan migration.
3. Buat admin seed.
4. Buat data perangkat contoh.

```bash
pnpm prisma migrate dev --name init
pnpm prisma generate
```

### Fase 3 — Authentication

1. Buat login.
2. Hash password.
3. Buat middleware authentication.
4. Buat halaman login frontend.
5. Buat route protection.

### Fase 4 — CRUD Perangkat

1. Buat API device.
2. Buat validasi input.
3. Buat halaman daftar perangkat.
4. Buat form tambah perangkat.
5. Buat form edit perangkat.
6. Buat fitur hapus dan toggle.

### Fase 5 — Monitoring Worker

1. Buat fungsi ICMP check.
2. Buat TCP check.
3. Buat HTTP check.
4. Buat scheduler.
5. Tambahkan concurrency limit.
6. Simpan monitoring result.
7. Update device status.

### Fase 6 — Incident

1. Buka incident ketika perangkat offline.
2. Tutup incident ketika perangkat pulih.
3. Hitung durasi downtime.
4. Simpan error.
5. Buat halaman riwayat incident.

### Fase 7 — Real-Time Dashboard

1. Pasang Socket.IO.
2. Emit perubahan perangkat.
3. Emit summary dashboard.
4. Update React state.
5. Tampilkan status koneksi WebSocket.

### Fase 8 — Telegram

1. Simpan Telegram config.
2. Buat test notification.
3. Kirim offline notification.
4. Kirim recovery notification.
5. Simpan notification log.
6. Tambahkan anti-spam.

### Fase 9 — Grafik dan Laporan

1. Buat grafik latency.
2. Hitung uptime.
3. Tampilkan downtime.
4. Tambahkan filter tanggal.
5. Buat export CSV atau Excel.

### Fase 10 — Deployment

1. Buat Dockerfile.
2. Buat docker-compose.
3. Tambahkan volume SQLite.
4. Jalankan di server lokal.
5. Konfigurasikan auto-restart.
6. Buat backup database.

---

## 25. Docker Compose

Contoh sederhana:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: netwatch-api
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=file:/data/netwatch.db
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
    volumes:
      - netwatch-data:/data
    cap_add:
      - NET_RAW
    ports:
      - "3001:3001"

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: netwatch-web
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      - api

volumes:
  netwatch-data:
```

---

## 26. Testing

### 26.1 Unit Test

Test yang perlu dibuat:

- Penentuan status online.
- Penentuan status warning.
- Penentuan status offline.
- Failure threshold.
- Recovery threshold.
- Perhitungan downtime.
- Perhitungan uptime.
- Format notifikasi.

### 26.2 Integration Test

- Tambah perangkat.
- Update perangkat.
- Hapus perangkat.
- Manual check.
- Incident dibuat saat offline.
- Incident ditutup saat pulih.
- Telegram dipanggil saat perubahan status.
- WebSocket mengirim event.

### 26.3 Manual Test

1. Tambahkan IP aktif.
2. Pastikan status online.
3. Matikan perangkat atau ubah IP.
4. Pastikan status warning sebelum offline.
5. Pastikan notifikasi hanya satu kali.
6. Aktifkan kembali perangkat.
7. Pastikan status kembali online.
8. Pastikan incident ditutup.
9. Pastikan durasi downtime benar.

---

## 27. Acceptance Criteria MVP

Aplikasi MVP dianggap selesai jika:

- Admin dapat login.
- Admin dapat menambah IP.
- Admin dapat mengubah dan menghapus IP.
- Sistem dapat melakukan ICMP ping.
- Sistem dapat melakukan TCP check.
- Sistem dapat melakukan HTTP check.
- Dashboard menampilkan semua perangkat dalam satu halaman.
- Status berubah tanpa reload.
- Perangkat tidak langsung dianggap offline setelah satu kali gagal.
- Incident dibuat saat offline.
- Incident ditutup saat kembali online.
- Notifikasi Telegram dikirim saat offline.
- Notifikasi Telegram dikirim saat recovery.
- Riwayat hasil monitoring tersimpan.
- Riwayat incident dapat dilihat.
- Aplikasi dapat dijalankan melalui Docker.
- Data SQLite tetap tersimpan setelah container restart.

---

## 28. Prioritas Pengerjaan

### Must Have

- Login.
- CRUD perangkat.
- ICMP ping.
- TCP port check.
- HTTP health check.
- Dashboard real-time.
- Failure threshold.
- Recovery threshold.
- Incident.
- Telegram notification.
- SQLite.
- Docker.

### Should Have

- Grafik latency.
- Uptime.
- Filter perangkat.
- Group perangkat.
- Maintenance mode.
- Export CSV.
- Manual check.

### Could Have

- Email notification.
- Browser notification.
- Discord webhook.
- Multi-user.
- Role admin dan viewer.
- Import perangkat dari CSV.
- Peta lokasi.
- Mobile application.
- Multi-location monitoring agent.

---

## 29. Rekomendasi Pengembangan Lanjutan

### Monitoring Agent

Jika aplikasi utama dijalankan di server pusat, tetapi perangkat yang dipantau berada di jaringan berbeda, buat monitoring agent.

Arsitektur:

```text
Central Server
      │
      ├── Agent Kantor A
      │      └── Memantau IP jaringan Kantor A
      │
      ├── Agent Kantor B
      │      └── Memantau IP jaringan Kantor B
      │
      └── Agent Cabang
             └── Memantau IP jaringan Cabang
```

Agent mengirim hasil ke server pusat melalui HTTPS.

### Multi-Channel Notification

Tambahkan:

- Telegram.
- Email.
- Discord.
- Slack.
- WhatsApp API resmi.
- Webhook kustom.

### Escalation

Contoh aturan:

```text
Offline 0 menit  : Telegram ke teknisi
Offline 15 menit : Telegram ke supervisor
Offline 30 menit : Email ke manajer
```

### Maintenance Schedule

Perangkat yang sedang maintenance tidak mengirim notifikasi offline.

Contoh:

```text
Maintenance:
13 Juli 2026, 22:00
sampai
14 Juli 2026, 01:00
```

---

## 30. Saran Implementasi Awal

Untuk tahap awal, gunakan konfigurasi berikut:

```text
Jumlah perangkat awal       : maksimal 20
Interval check              : 5 detik
Timeout                     : 2 detik
Failure threshold           : 3 kali
Recovery threshold          : 2 kali
Concurrency                 : 10
Offline reminder            : 60 menit
Raw data retention          : 30 hari
Notifikasi                  : Telegram
Database                    : SQLite
Deployment                  : Docker di jaringan lokal
```

Jangan memulai dengan terlalu banyak fitur. Pastikan alur dasar berikut stabil terlebih dahulu:

```text
Tambah perangkat
      ↓
Worker melakukan check
      ↓
Dashboard menerima hasil
      ↓
Status berubah
      ↓
Incident dibuat
      ↓
Telegram dikirim
      ↓
Perangkat pulih
      ↓
Incident ditutup
      ↓
Telegram recovery dikirim
```

---

## 31. Definisi Selesai

Proyek dianggap memiliki versi pertama yang layak digunakan ketika administrator dapat membuka dashboard, melihat kondisi semua perangkat secara real-time, menerima notifikasi saat perangkat offline, melihat kapan perangkat pulih, dan membuka riwayat gangguan tanpa perlu melakukan ping manual satu per satu.
