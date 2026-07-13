# NetWatch Multi-Agent Development Workflow

## Panduan Step-by-Step Membangun Aplikasi Monitoring IP dengan 3 AI Agent

Dokumen ini menjelaskan alur pembangunan aplikasi **NetWatch** dari awal sampai rilis menggunakan tiga AI agent:

- **Agent_A**: Developer utama.
- **Agent_B**: Code reviewer dan quality gate.
- **Agent_C**: Bug fixer berdasarkan hasil review Agent_B.

Stack utama yang digunakan:

```text
Frontend   : React + Vite + Tailwind CSS
Backend    : Node.js + Express
Realtime   : Socket.IO
Database   : SQLite
ORM        : Prisma
Monitoring : ICMP, TCP, HTTP
Notifikasi : Telegram Bot
Deployment : Docker
```

---

# 1. Aturan Kerja Umum

## 1.1 Tanggung Jawab Agent

### Agent_A — Developer

Agent_A bertugas:

- Membaca requirement.
- Membuat atau mengembangkan fitur.
- Menulis test.
- Menjalankan lint, test, dan build.
- Membuat commit.
- Membuat laporan handoff kepada Agent_B.

Agent_A tidak boleh menyatakan fitur selesai sebelum diperiksa Agent_B.

### Agent_B — Reviewer

Agent_B bertugas:

- Membaca requirement dan acceptance criteria.
- Memeriksa hasil Agent_A atau Agent_C.
- Menjalankan lint, test, dan build.
- Mencari bug, masalah keamanan, masalah performa, dan ketidaksesuaian requirement.
- Memberikan status review.
- Tidak mengubah kode.

Status review yang boleh diberikan:

```text
APPROVED
APPROVED WITH MINOR NOTES
CHANGES REQUESTED
BLOCKED
```

### Agent_C — Bug Fixer

Agent_C bekerja hanya jika Agent_B memberikan status:

```text
CHANGES REQUESTED
```

Agent_C bertugas:

- Membaca laporan Agent_B.
- Memperbaiki masalah yang disebutkan.
- Menambahkan regression test.
- Menjalankan lint, test, dan build.
- Membuat commit.
- Mengirimkan hasil kembali kepada Agent_B.

Agent_C tidak boleh menambah fitur baru di luar review.

---

# 2. Alur Setiap Task

Semua task menggunakan alur berikut:

```text
Requirement dibuat
       ↓
Agent_A mengembangkan
       ↓
Agent_A menjalankan lint, test, build
       ↓
Agent_A membuat commit dan handoff
       ↓
Agent_B melakukan review
       ↓
Apakah ada Critical atau Major issue?
       ├── Tidak → APPROVED
       │           ↓
       │      Merge ke develop
       │
       └── Ya → CHANGES REQUESTED
                   ↓
              Agent_C memperbaiki
                   ↓
              Agent_C menjalankan lint, test, build
                   ↓
              Agent_C membuat commit dan handoff
                   ↓
              Agent_B melakukan re-review
```

Satu task tidak boleh dilanjutkan ke task berikutnya sebelum Agent_B memberikan persetujuan.

---

# 3. Struktur Branch Git

Gunakan branch berikut:

```text
main
develop
feature/NW-xxx-nama-fitur
fix/NW-xxx-review-fix
```

Contoh:

```text
feature/NW-001-project-setup
feature/NW-002-database
feature/NW-003-authentication
fix/NW-003-authentication-review
```

Aturan:

- Jangan bekerja langsung di `main`.
- Semua fitur masuk ke `develop`.
- `main` hanya untuk versi stabil.
- Agent_A menggunakan branch `feature/...`.
- Agent_C menggunakan branch `fix/...` atau melanjutkan branch feature yang sama jika sistem agent menggunakan satu workspace.
- Agent_B tidak membuat perubahan kode.

---

# 4. Struktur Dokumen Handoff

Buat folder:

```text
docs/
├── requirements/
├── reviews/
├── handoffs/
└── decisions/
```

Setiap task memiliki file:

```text
docs/requirements/NW-001.md
docs/handoffs/NW-001-agent-a.md
docs/reviews/NW-001-agent-b.md
docs/handoffs/NW-001-agent-c.md
```

---

# 5. Daftar Tahap Pengembangan

```text
NW-001  Project Setup
NW-002  Code Quality dan Testing Foundation
NW-003  Database dan Prisma
NW-004  Authentication
NW-005  Device Group Management
NW-006  Device CRUD
NW-007  ICMP Monitoring
NW-008  TCP Port Monitoring
NW-009  HTTP Health Monitoring
NW-010  Monitoring Scheduler
NW-011  Status Transition Engine
NW-012  Incident Management
NW-013  Realtime Dashboard
NW-014  Telegram Notification
NW-015  Monitoring History dan Uptime
NW-016  Maintenance Mode dan Manual Check
NW-017  Security Hardening
NW-018  Docker dan Deployment
NW-019  End-to-End Testing
NW-020  Release v1.0.0
```

---

# NW-001 — Project Setup

## Tujuan

Membuat fondasi proyek monorepo untuk frontend dan backend.

## Hasil Akhir yang Diharapkan

```text
netwatch/
├── apps/
│   ├── api/
│   └── web/
├── packages/
├── docs/
├── package.json
├── pnpm-workspace.yaml
├── .gitignore
├── .env.example
└── README.md
```

## Tugas Agent_A

1. Membuat repository Git.
2. Membuat branch `develop`.
3. Membuat branch:

```text
feature/NW-001-project-setup
```

4. Membuat pnpm workspace.
5. Membuat aplikasi backend Node.js + Express.
6. Membuat aplikasi frontend React + Vite.
7. Membuat endpoint:

```text
GET /health
```

8. Response endpoint:

```json
{
  "status": "ok",
  "service": "netwatch-api"
}
```

9. Membuat halaman frontend awal.
10. Membuat file `.env.example`.
11. Membuat README berisi cara install dan menjalankan proyek.
12. Menambahkan script root:

```json
{
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test"
  }
}
```

13. Menjalankan:

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

14. Membuat commit.
15. Membuat handoff untuk Agent_B.

## Tugas Agent_B

Periksa:

- Struktur monorepo.
- Frontend dan backend dapat dijalankan.
- Endpoint `/health` mengembalikan HTTP 200.
- Tidak ada secret di repository.
- `.env.example` tersedia.
- Script root bekerja.
- README dapat diikuti dari awal.
- Tidak ada dependency yang tidak dibutuhkan.

Agent_B menjalankan:

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

## Tugas Agent_C

Jika terdapat masalah:

- Memperbaiki script.
- Memperbaiki struktur workspace.
- Memperbaiki dependency.
- Memperbaiki endpoint health.
- Memperbarui README.
- Menjalankan ulang semua pemeriksaan.

## Acceptance Criteria

```text
[ ] pnpm install berhasil
[ ] pnpm dev dapat menjalankan frontend dan backend
[ ] GET /health mengembalikan 200
[ ] pnpm lint berhasil
[ ] pnpm test berhasil
[ ] pnpm build berhasil
[ ] README tersedia
[ ] Agent_B memberikan APPROVED
```

---

# NW-002 — Code Quality dan Testing Foundation

## Tujuan

Membuat standar kualitas kode sebelum fitur utama dikembangkan.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-002-code-quality
```

2. Menambahkan ESLint.
3. Menambahkan Prettier.
4. Menambahkan konfigurasi editor.
5. Menambahkan test framework backend.
6. Menambahkan test framework frontend.
7. Menambahkan test endpoint `/health`.
8. Menambahkan test halaman frontend.
9. Menambahkan pre-commit hook jika diperlukan.
10. Menambahkan script:

```text
lint
lint:fix
format
format:check
test
test:watch
build
```

11. Membuat aturan penamaan file dan fungsi.
12. Menulis panduan coding di:

```text
docs/decisions/ADR-001-code-style.md
```

## Tugas Agent_B

Periksa:

- Lint benar-benar mendeteksi error.
- Format check bekerja.
- Test gagal jika kode sengaja dirusak.
- Test tidak hanya berupa placeholder.
- Tidak ada konfigurasi yang saling bertentangan.
- Script dapat dijalankan dari root.

## Tugas Agent_C

Memperbaiki:

- Konfigurasi lint yang konflik.
- Test yang tidak berjalan.
- Path alias.
- Script workspace.
- Masalah format.

## Acceptance Criteria

```text
[ ] ESLint aktif
[ ] Prettier aktif
[ ] Test backend aktif
[ ] Test frontend aktif
[ ] Test health endpoint tersedia
[ ] Test frontend dasar tersedia
[ ] Semua script berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-003 — Database dan Prisma

## Tujuan

Membuat database SQLite, Prisma schema, migration, dan seed awal.

## Model Awal

```text
User
DeviceGroup
Device
MonitoringResult
Incident
NotificationLog
ApplicationSetting
```

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-003-database
```

2. Memasang Prisma.
3. Mengatur:

```env
DATABASE_URL="file:./dev.db"
```

4. Membuat enum:

```text
DeviceStatus:
UNKNOWN
ONLINE
WARNING
OFFLINE
MAINTENANCE
DISABLED
```

5. Membuat enum:

```text
CheckType:
ICMP
TCP
HTTP
```

6. Membuat model database.
7. Menambahkan index pada:

```text
MonitoringResult(deviceId, checkedAt)
Incident(deviceId, startedAt)
Device(currentStatus)
```

8. Membuat migration.
9. Membuat seed admin.
10. Membuat seed beberapa perangkat contoh.
11. Membuat Prisma client service.
12. Membuat test koneksi database.
13. Membuat dokumentasi skema.

## Tugas Agent_B

Periksa:

- Relasi model.
- Foreign key.
- Cascade delete.
- Nullable field.
- Default value.
- Enum.
- Index.
- Migration dapat dijalankan dari database kosong.
- Seed dapat dijalankan lebih dari satu kali tanpa membuat data ganda.
- Password seed tidak disimpan plaintext.

## Tugas Agent_C

Memperbaiki:

- Relasi yang salah.
- Missing index.
- Migration error.
- Seed tidak idempotent.
- Default value tidak sesuai.
- Nama field tidak konsisten.

## Acceptance Criteria

```text
[ ] prisma generate berhasil
[ ] migration berhasil
[ ] seed berhasil
[ ] database dapat dibuat dari nol
[ ] semua model tersedia
[ ] test database berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-004 — Authentication

## Tujuan

Membuat login admin dan perlindungan endpoint.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-004-authentication
```

2. Membuat endpoint:

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

3. Menggunakan password hashing.
4. Menggunakan session atau JWT melalui HTTP-only cookie.
5. Membuat middleware authentication.
6. Membuat halaman login.
7. Membuat protected route frontend.
8. Membuat logout.
9. Menambahkan rate limit pada login.
10. Menambahkan validasi email dan password.
11. Menambahkan test:

```text
login berhasil
password salah
email tidak ditemukan
akses tanpa autentikasi
logout
session kadaluarsa
```

## Tugas Agent_B

Periksa:

- Password menggunakan bcrypt atau argon2.
- Tidak ada password di log.
- Error login tidak membocorkan apakah email terdaftar.
- Cookie menggunakan konfigurasi aman.
- Rate limit aktif.
- Endpoint privat benar-benar terlindungi.
- Token tidak disimpan di localStorage jika memakai cookie.
- Test mencakup skenario gagal.

## Tugas Agent_C

Memperbaiki:

- Masalah cookie.
- Masalah session.
- Missing rate limit.
- Error response.
- Test authentication.
- Protected route frontend.

## Acceptance Criteria

```text
[ ] Admin dapat login
[ ] Admin dapat logout
[ ] GET /api/auth/me bekerja
[ ] Endpoint privat menolak user tanpa login
[ ] Password di-hash
[ ] Rate limit tersedia
[ ] Test authentication berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-005 — Device Group Management

## Tujuan

Membuat pengelompokan perangkat seperti Router, Server, CCTV, dan Access Point.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-005-device-groups
```

2. Membuat endpoint:

```text
GET    /api/groups
POST   /api/groups
PUT    /api/groups/:id
DELETE /api/groups/:id
```

3. Membuat halaman daftar grup.
4. Membuat form tambah dan edit grup.
5. Menambahkan validasi nama grup.
6. Mencegah nama grup ganda.
7. Menolak penghapusan grup yang masih digunakan, atau memindahkan perangkat ke tanpa grup sesuai requirement.
8. Menambahkan test CRUD.

## Tugas Agent_B

Periksa:

- Duplicate name.
- Empty name.
- Authorization.
- Delete behavior.
- Error handling.
- Konsistensi frontend dan backend.
- Test seluruh operasi.

## Tugas Agent_C

Memperbaiki semua temuan.

## Acceptance Criteria

```text
[ ] Grup dapat dibuat
[ ] Grup dapat dilihat
[ ] Grup dapat diubah
[ ] Grup dapat dihapus sesuai aturan
[ ] Nama grup unik
[ ] Test berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-006 — Device CRUD

## Tujuan

Membuat pengelolaan perangkat yang akan dimonitor.

## Data Perangkat

```text
name
host
groupId
checkType
port
url
intervalSeconds
timeoutMs
warningLatencyMs
failureThreshold
recoveryThreshold
isActive
```

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-006-device-crud
```

2. Membuat endpoint:

```text
GET    /api/devices
GET    /api/devices/:id
POST   /api/devices
PUT    /api/devices/:id
DELETE /api/devices/:id
PATCH  /api/devices/:id/toggle
```

3. Membuat validasi:

```text
name tidak kosong
host berupa IP atau hostname valid
port 1–65535
URL hanya http atau https
interval minimal 1 detik
timeout lebih kecil dari interval
failureThreshold minimal 1
recoveryThreshold minimal 1
```

4. Membuat halaman perangkat.
5. Membuat form tambah dan edit.
6. Membuat search.
7. Membuat filter grup.
8. Membuat filter status.
9. Membuat pagination jika diperlukan.
10. Menambahkan test API dan frontend.

## Tugas Agent_B

Periksa:

- Validasi host.
- Validasi URL.
- Validasi port.
- Duplicate device.
- Authorization.
- Error database tidak dikirim mentah.
- Delete behavior.
- Empty state.
- Loading state.
- Test invalid input.

## Tugas Agent_C

Memperbaiki:

- Validation.
- Duplicate check.
- Error handler.
- Form frontend.
- Test regresi.

## Acceptance Criteria

```text
[ ] CRUD perangkat berjalan
[ ] Validasi berjalan
[ ] Filter berjalan
[ ] Search berjalan
[ ] Data tersimpan di SQLite
[ ] Endpoint dilindungi
[ ] Test berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-007 — ICMP Monitoring

## Tujuan

Membuat pemeriksaan koneksi perangkat menggunakan ICMP ping.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-007-icmp-monitoring
```

2. Membuat service ICMP.
3. Menggunakan library yang aman.
4. Tidak membentuk shell command dari input pengguna.
5. Menghasilkan output:

```json
{
  "success": true,
  "latencyMs": 4,
  "error": null
}
```

6. Menangani:

```text
host aktif
host timeout
host tidak valid
permission error
DNS error
```

7. Membuat endpoint manual sementara:

```text
POST /api/devices/:id/check
```

8. Menyimpan hasil ke `MonitoringResult`.
9. Menambahkan timeout.
10. Menambahkan unit test dengan mock.
11. Menambahkan integration test.

## Tugas Agent_B

Periksa:

- Command injection.
- Timeout.
- Error handling.
- Latency parsing.
- Database insert.
- Host invalid.
- Library tidak membocorkan proses.
- Test tidak bergantung penuh pada internet publik.

## Tugas Agent_C

Memperbaiki:

- Parsing latency.
- Timeout.
- Permission handling.
- Security.
- Test mock.

## Acceptance Criteria

```text
[ ] ICMP check berhasil untuk host aktif
[ ] Timeout ditangani
[ ] Hasil tersimpan
[ ] Tidak ada command injection
[ ] Manual check bekerja
[ ] Test berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-008 — TCP Port Monitoring

## Tujuan

Membuat pemeriksaan layanan berdasarkan port TCP.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-008-tcp-monitoring
```

2. Membuat TCP socket checker.
3. Mendukung port seperti:

```text
22
80
443
3306
5432
3389
```

4. Menangani:

```text
port open
connection refused
timeout
invalid port
DNS failure
```

5. Menghitung latency.
6. Memastikan socket selalu ditutup.
7. Menyimpan hasil.
8. Menambahkan test.

## Tugas Agent_B

Periksa:

- Socket leak.
- Timeout.
- Port validation.
- Multiple callback.
- Error race condition.
- Test port open dan closed.
- Service tidak menggantung.

## Tugas Agent_C

Memperbaiki masalah socket dan test.

## Acceptance Criteria

```text
[ ] Port terbuka terdeteksi
[ ] Port tertutup terdeteksi
[ ] Timeout bekerja
[ ] Socket selalu ditutup
[ ] Hasil tersimpan
[ ] Test berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-009 — HTTP Health Monitoring

## Tujuan

Membuat pemeriksaan website atau API melalui HTTP/HTTPS.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-009-http-monitoring
```

2. Membuat HTTP checker.
3. Mendukung:

```text
HTTP
HTTPS
expected status code
timeout
redirect limit
```

4. Membatasi protocol hanya:

```text
http:
https:
```

5. Tidak membaca response body berukuran besar.
6. Membatasi redirect.
7. Menyimpan status code dan latency.
8. Menangani:

```text
2xx
4xx
5xx
timeout
DNS error
TLS error
redirect loop
```

9. Menambahkan test.

## Tugas Agent_B

Periksa:

- SSRF.
- URL validation.
- Redirect validation.
- Timeout.
- Response size.
- Internal metadata endpoint.
- Error handling.
- Test status code.

## Tugas Agent_C

Memperbaiki risiko SSRF dan validasi.

## Acceptance Criteria

```text
[ ] HTTP check bekerja
[ ] HTTPS check bekerja
[ ] Timeout bekerja
[ ] Redirect dibatasi
[ ] Protocol dibatasi
[ ] Status code tersimpan
[ ] Test berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-010 — Monitoring Scheduler

## Tujuan

Menjalankan monitoring otomatis berdasarkan interval setiap perangkat.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-010-monitoring-scheduler
```

2. Membuat satu scheduler utama.
3. Scheduler berjalan setiap 1 detik.
4. Scheduler mencari perangkat yang sudah jatuh tempo.
5. Menambahkan concurrency limit.
6. Mencegah satu perangkat diperiksa dua kali bersamaan.
7. Mendukung ICMP, TCP, dan HTTP.
8. Menyimpan `lastCheckedAt`.
9. Menambahkan graceful shutdown.
10. Menambahkan logging.
11. Menambahkan test scheduler menggunakan fake timer.

Contoh aturan:

```text
Maksimal 10 check bersamaan untuk tahap awal.
```

## Tugas Agent_B

Periksa:

- Worker overlap.
- Race condition.
- Memory leak.
- Concurrency limit.
- Graceful shutdown.
- Device disabled tidak diperiksa.
- Device maintenance tidak diperiksa.
- Error satu perangkat tidak menghentikan worker.
- Test interval.

## Tugas Agent_C

Memperbaiki scheduler dan locking.

## Acceptance Criteria

```text
[ ] Scheduler berjalan otomatis
[ ] Interval perangkat dipatuhi
[ ] Concurrency dibatasi
[ ] Tidak ada duplicate check
[ ] Error satu perangkat tidak menghentikan worker
[ ] Shutdown aman
[ ] Test berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-011 — Status Transition Engine

## Tujuan

Menentukan status perangkat secara stabil dan mencegah false alarm.

## Aturan Awal

```text
UNKNOWN → ONLINE jika check berhasil
1 gagal → status sebelumnya
2 gagal → WARNING
3 gagal → OFFLINE
2 berhasil setelah OFFLINE → ONLINE
Latency tinggi → WARNING
```

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-011-status-engine
```

2. Membuat service penentuan status.
3. Mengelola:

```text
consecutiveFailures
consecutiveSuccesses
lastOnlineAt
lastOfflineAt
lastLatencyMs
currentStatus
```

4. Mendukung threshold per perangkat.
5. Mendukung latency warning.
6. Mendukung status:

```text
UNKNOWN
ONLINE
WARNING
OFFLINE
MAINTENANCE
DISABLED
```

7. Menggunakan transaction jika update lebih dari satu tabel.
8. Menulis unit test seluruh transition.

## Tugas Agent_B

Periksa semua transition:

```text
UNKNOWN → ONLINE
UNKNOWN → OFFLINE
ONLINE → WARNING
WARNING → OFFLINE
OFFLINE → ONLINE
ONLINE → MAINTENANCE
MAINTENANCE → UNKNOWN
DISABLED tidak dimonitor
```

Periksa:

- Failure threshold.
- Recovery threshold.
- Counter reset.
- Race condition.
- Latency warning.
- Test boundary.

## Tugas Agent_C

Memperbaiki logika transition dan menambah regression test.

## Acceptance Criteria

```text
[ ] Satu kegagalan tidak langsung offline
[ ] Failure threshold bekerja
[ ] Recovery threshold bekerja
[ ] Counter di-reset dengan benar
[ ] Semua status transition memiliki test
[ ] Agent_B memberikan APPROVED
```

---

# NW-012 — Incident Management

## Tujuan

Mencatat kapan perangkat offline dan kapan kembali online.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-012-incidents
```

2. Membuka incident saat:

```text
oldStatus bukan OFFLINE
newStatus OFFLINE
```

3. Menutup incident saat:

```text
oldStatus OFFLINE
newStatus ONLINE
```

4. Menghitung downtime.
5. Menyimpan error awal.
6. Mencegah duplicate incident.
7. Membuat endpoint:

```text
GET /api/incidents
GET /api/incidents/:id
GET /api/devices/:id/incidents
```

8. Membuat halaman incident.
9. Menambahkan filter status dan tanggal.
10. Menambahkan test.

## Tugas Agent_B

Periksa:

- Hanya satu incident aktif per perangkat.
- Restart aplikasi tidak membuat duplicate.
- Downtime benar.
- Incident tidak dibuat saat WARNING.
- Recovery menutup incident yang benar.
- Transaction.
- Timezone.
- Pagination.

## Tugas Agent_C

Memperbaiki incident logic dan query.

## Acceptance Criteria

```text
[ ] Incident dibuat saat offline
[ ] Tidak ada incident ganda
[ ] Incident ditutup saat recovery
[ ] Downtime dihitung
[ ] Riwayat dapat dilihat
[ ] Test berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-013 — Realtime Dashboard

## Tujuan

Menampilkan status semua perangkat tanpa reload halaman.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-013-realtime-dashboard
```

2. Memasang Socket.IO server.
3. Memasang Socket.IO client.
4. Membuat event:

```text
device:updated
device:online
device:warning
device:offline
incident:opened
incident:closed
dashboard:summary
```

5. Membuat summary card:

```text
Total
Online
Warning
Offline
Maintenance
```

6. Membuat tabel perangkat.
7. Menampilkan:

```text
nama
host
grup
metode
status
latency
last check
downtime
```

8. Membuat reconnect.
9. Membuat fallback fetch jika socket terputus.
10. Membersihkan listener saat komponen unmount.
11. Menambahkan filter dan search.
12. Menambahkan test frontend.

## Tugas Agent_B

Periksa:

- Duplicate listener.
- Duplicate data.
- Reconnect.
- Memory leak.
- Stale state.
- Data socket sesuai API.
- Dashboard tetap dapat digunakan saat socket putus.
- Loading state.
- Empty state.
- Responsive layout.

## Tugas Agent_C

Memperbaiki state management, reconnect, dan listener.

## Acceptance Criteria

```text
[ ] Dashboard berubah tanpa reload
[ ] Summary ikut berubah
[ ] Socket reconnect bekerja
[ ] Tidak ada duplicate event
[ ] Search dan filter bekerja
[ ] Fallback API tersedia
[ ] Test berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-014 — Telegram Notification

## Tujuan

Mengirim notifikasi saat perangkat offline dan kembali online.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-014-telegram
```

2. Menambahkan environment:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

3. Membuat Telegram service.
4. Membuat endpoint test:

```text
POST /api/settings/telegram/test
```

5. Mengirim notifikasi saat:

```text
ONLINE/WARNING → OFFLINE
OFFLINE → ONLINE
```

6. Menyimpan notification log.
7. Menambahkan anti-spam.
8. Menambahkan optional reminder offline.
9. Menangani kegagalan Telegram tanpa menghentikan worker.
10. Melakukan escaping pesan.
11. Menambahkan test mock Telegram API.

## Tugas Agent_B

Periksa:

- Token tidak masuk frontend.
- Token tidak masuk Git.
- Pesan hanya dikirim saat transition.
- Tidak spam.
- Recovery hanya sekali.
- Error Telegram tidak menghentikan monitoring.
- Message escaping.
- Timeout request Telegram.
- Notification log.

## Tugas Agent_C

Memperbaiki anti-spam, error handling, dan security.

## Acceptance Criteria

```text
[ ] Test message berhasil
[ ] Offline notification berhasil
[ ] Recovery notification berhasil
[ ] Tidak ada spam
[ ] Notification log tersimpan
[ ] Kegagalan Telegram tidak menghentikan worker
[ ] Test berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-015 — Monitoring History dan Uptime

## Tujuan

Menampilkan riwayat latency, downtime, dan persentase uptime.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-015-history-uptime
```

2. Membuat endpoint:

```text
GET /api/devices/:id/results
GET /api/devices/:id/uptime
GET /api/devices/:id/latency
```

3. Membuat filter tanggal.
4. Membuat pagination.
5. Menghitung uptime berdasarkan durasi incident.
6. Membuat grafik latency.
7. Membuat ringkasan:

```text
uptime 24 jam
uptime 7 hari
uptime 30 hari
total downtime
jumlah incident
average latency
```

8. Menambahkan retention cleanup.
9. Menambahkan agregasi data jika diperlukan.
10. Menambahkan test perhitungan.

## Tugas Agent_B

Periksa:

- Rumus uptime.
- Timezone.
- Query performance.
- Pagination.
- Grafik tidak memuat terlalu banyak data.
- Retention tidak menghapus incident.
- Boundary tanggal.
- Device yang belum memiliki data.

## Tugas Agent_C

Memperbaiki perhitungan, query, dan empty state.

## Acceptance Criteria

```text
[ ] Riwayat hasil tampil
[ ] Grafik latency tampil
[ ] Uptime 24 jam benar
[ ] Uptime 7 hari benar
[ ] Uptime 30 hari benar
[ ] Pagination bekerja
[ ] Retention cleanup tersedia
[ ] Test berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-016 — Maintenance Mode dan Manual Check

## Tujuan

Memungkinkan admin menonaktifkan notifikasi saat maintenance dan menjalankan check manual.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-016-maintenance-manual-check
```

2. Membuat endpoint:

```text
POST  /api/devices/:id/check
PATCH /api/devices/:id/maintenance
```

3. Maintenance mode harus:

```text
menghentikan monitoring normal
tidak membuka incident
tidak mengirim offline notification
menampilkan status MAINTENANCE
```

4. Saat maintenance selesai:

```text
status kembali UNKNOWN
check berikutnya menentukan status baru
```

5. Manual check harus tetap mengikuti permission.
6. Menambahkan tombol frontend.
7. Menambahkan audit log.
8. Menambahkan test.

## Tugas Agent_B

Periksa:

- Maintenance tidak membuat incident.
- Maintenance tidak mengirim notifikasi.
- Manual check tidak membuat duplicate worker.
- Authorization.
- Audit log.
- Status kembali normal setelah maintenance.

## Tugas Agent_C

Memperbaiki logic dan race condition.

## Acceptance Criteria

```text
[ ] Maintenance dapat diaktifkan
[ ] Maintenance dapat dinonaktifkan
[ ] Tidak ada notifikasi selama maintenance
[ ] Tidak ada incident selama maintenance
[ ] Manual check bekerja
[ ] Audit log tersedia
[ ] Test berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-017 — Security Hardening

## Tujuan

Melakukan audit dan perbaikan keamanan sebelum deployment.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-017-security-hardening
```

2. Menambahkan security headers.
3. Menambahkan CORS allowlist.
4. Menambahkan rate limit.
5. Memastikan input validation di seluruh endpoint.
6. Menyembunyikan stack trace di production.
7. Memastikan secret tidak masuk log.
8. Menambahkan audit log.
9. Menambahkan size limit request.
10. Memeriksa dependency vulnerability.
11. Membatasi HTTP check untuk mencegah SSRF.
12. Menambahkan test authorization.
13. Menambahkan security checklist.

## Tugas Agent_B

Melakukan audit:

```text
authentication
authorization
command injection
SSRF
CORS
rate limiting
secret management
logging
error disclosure
input validation
dependency security
Docker permission
```

Agent_B harus membuat laporan terpisah untuk:

```text
Critical
Major
Minor
Suggestion
```

## Tugas Agent_C

Memperbaiki seluruh temuan Critical dan Major.

## Acceptance Criteria

```text
[ ] Tidak ada Critical issue
[ ] Tidak ada Major issue
[ ] Secret aman
[ ] CORS dibatasi
[ ] Rate limit aktif
[ ] Validation aktif
[ ] Error production aman
[ ] Agent_B memberikan APPROVED
```

---

# NW-018 — Docker dan Deployment

## Tujuan

Menjalankan aplikasi secara konsisten di server lokal melalui Docker.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-018-docker-deployment
```

2. Membuat Dockerfile backend.
3. Membuat Dockerfile frontend.
4. Membuat `docker-compose.yml`.
5. Menambahkan volume SQLite.
6. Menambahkan `NET_RAW` untuk ICMP jika dibutuhkan.
7. Menambahkan restart policy.
8. Menambahkan health check.
9. Menambahkan environment production.
10. Menambahkan backup database.
11. Menambahkan dokumentasi deployment.
12. Menjalankan:

```bash
docker compose build
docker compose up -d
docker compose ps
```

13. Menguji restart container.
14. Menguji persistensi database.
15. Menguji ICMP dari container.

## Tugas Agent_B

Periksa:

- Image build.
- Health check.
- Database persisten.
- Secret tidak masuk image.
- Port exposure.
- Container restart.
- ICMP permission.
- Non-root user jika memungkinkan.
- Log tidak memenuhi disk.
- Backup dapat digunakan.

## Tugas Agent_C

Memperbaiki Dockerfile, volume, permission, dan health check.

## Acceptance Criteria

```text
[ ] docker compose build berhasil
[ ] docker compose up -d berhasil
[ ] Frontend dapat dibuka
[ ] Backend health check berhasil
[ ] ICMP bekerja
[ ] Database tetap ada setelah restart
[ ] Backup tersedia
[ ] Agent_B memberikan APPROVED
```

---

# NW-019 — End-to-End Testing

## Tujuan

Menguji seluruh aplikasi sebagai satu sistem lengkap.

## Tugas Agent_A

1. Membuat branch:

```text
feature/NW-019-e2e-testing
```

2. Membuat skenario test:

### Skenario 1 — Login

```text
Admin login
Dashboard terbuka
Logout
Protected route tidak dapat diakses
```

### Skenario 2 — Device CRUD

```text
Tambah device
Edit device
Filter device
Disable device
Delete device
```

### Skenario 3 — Online Device

```text
Tambah IP aktif
Scheduler melakukan check
Status menjadi ONLINE
Latency tampil
Result tersimpan
```

### Skenario 4 — Offline Device

```text
Tambah IP tidak aktif
Gagal 1 kali
Gagal 2 kali → WARNING
Gagal 3 kali → OFFLINE
Incident dibuat
Telegram dikirim
```

### Skenario 5 — Recovery

```text
Perangkat OFFLINE
Perangkat diaktifkan
Berhasil 1 kali → masih OFFLINE
Berhasil 2 kali → ONLINE
Incident ditutup
Recovery Telegram dikirim
```

### Skenario 6 — Maintenance

```text
Aktifkan maintenance
Monitoring berhenti
Tidak ada incident
Tidak ada Telegram
Nonaktifkan maintenance
Status kembali UNKNOWN
```

### Skenario 7 — Restart

```text
Restart container
Database tetap ada
Incident tetap ada
Monitoring kembali berjalan
```

3. Menambahkan automated E2E test jika memungkinkan.
4. Membuat test report.
5. Memperbaiki test data cleanup.
6. Menjalankan full test suite.

## Tugas Agent_B

Agent_B melakukan final functional audit:

- Semua acceptance criteria task NW-001 sampai NW-018.
- Tidak ada regression.
- Tidak ada skipped test penting.
- Tidak ada flaky test.
- Monitoring berjalan minimal beberapa siklus.
- Incident dan notification sesuai transition.
- Restart aman.
- UI dan API konsisten.

## Tugas Agent_C

Memperbaiki seluruh bug final yang ditemukan Agent_B.

## Acceptance Criteria

```text
[ ] Semua skenario E2E berhasil
[ ] Tidak ada Critical issue
[ ] Tidak ada Major issue
[ ] Semua test berhasil
[ ] Build berhasil
[ ] Docker berhasil
[ ] Agent_B memberikan APPROVED
```

---

# NW-020 — Release v1.0.0

## Tujuan

Menyelesaikan dokumentasi, membuat release, dan memindahkan kode stabil ke branch `main`.

## Tugas Agent_A

1. Membuat branch:

```text
release/v1.0.0
```

2. Memperbarui README.
3. Menambahkan:

```text
cara install
cara konfigurasi
cara menjalankan
cara backup
cara restore
cara menambah device
cara membuat Telegram bot
troubleshooting
```

4. Membuat changelog.
5. Membuat file:

```text
CHANGELOG.md
RELEASE_NOTES.md
```

6. Memastikan `.env.example` lengkap.
7. Memastikan migration terbaru tersedia.
8. Menjalankan:

```bash
pnpm lint
pnpm test
pnpm build
docker compose build
docker compose up -d
```

9. Menghapus data test.
10. Menyiapkan release candidate.

## Tugas Agent_B

Final release review:

- Dokumentasi lengkap.
- Tidak ada secret.
- Semua test lulus.
- Build production lulus.
- Docker lulus.
- Migration lulus.
- Seed production aman.
- Backup dan restore terdokumentasi.
- Tidak ada issue Critical atau Major.

Jika lulus, Agent_B memberi status:

```text
APPROVED FOR RELEASE
```

## Tugas Agent_C

Jika masih ada temuan:

- Memperbaiki release blocker.
- Tidak menambah fitur.
- Menjalankan seluruh pemeriksaan ulang.
- Mengirim kembali ke Agent_B.

## Langkah Release

Setelah Agent_B memberi persetujuan:

```bash
git checkout develop
git pull
git checkout main
git merge develop
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

## Acceptance Criteria

```text
[ ] README lengkap
[ ] CHANGELOG tersedia
[ ] RELEASE_NOTES tersedia
[ ] Semua test lulus
[ ] Build production lulus
[ ] Docker production lulus
[ ] Agent_B memberikan APPROVED FOR RELEASE
[ ] develop digabungkan ke main
[ ] Tag v1.0.0 dibuat
```

---

# 6. Prompt Tetap untuk Agent_A

Gunakan prompt berikut untuk setiap task:

```text
Kamu adalah Agent_A, developer utama aplikasi NetWatch.

Kerjakan task [TASK_ID] berdasarkan file requirement yang tersedia.

Aturan:
1. Baca requirement dan acceptance criteria sebelum mengubah kode.
2. Jangan mengubah scope.
3. Gunakan struktur proyek yang sudah ada.
4. Jangan menghapus fitur yang telah berjalan.
5. Tambahkan validasi dan error handling.
6. Tambahkan unit test atau integration test yang relevan.
7. Jalankan lint, test, dan build.
8. Jangan menyatakan selesai jika ada command gagal.
9. Buat commit yang jelas.
10. Buat handoff report untuk Agent_B.

Handoff harus berisi:
- Task ID.
- Branch.
- Commit hash.
- Ringkasan implementasi.
- File yang diubah.
- Test yang ditambahkan.
- Hasil lint.
- Hasil test.
- Hasil build.
- Risiko atau keterbatasan yang masih ada.
```

---

# 7. Prompt Tetap untuk Agent_B

```text
Kamu adalah Agent_B, code reviewer dan quality gate aplikasi NetWatch.

Review hasil task [TASK_ID].

Aturan:
1. Baca requirement dan acceptance criteria.
2. Jangan mengubah kode.
3. Periksa fungsi, logika, keamanan, performa, database, frontend, backend, dan test.
4. Jalankan lint, test, dan build.
5. Cari bug penggunaan nyata, bukan hanya masalah style.
6. Setiap temuan harus mencantumkan file, masalah, dampak, dan rekomendasi.
7. Kelompokkan temuan menjadi Critical, Major, Minor, dan Suggestion.
8. Jangan memberi APPROVED jika masih ada Critical atau Major issue.
9. Periksa apakah Agent_A benar-benar memenuhi seluruh acceptance criteria.

Output:
- Ringkasan review.
- Checklist acceptance criteria.
- Hasil lint, test, dan build.
- Daftar temuan.
- Rekomendasi.
- Status akhir:
  APPROVED
  APPROVED WITH MINOR NOTES
  CHANGES REQUESTED
  BLOCKED
```

---

# 8. Prompt Tetap untuk Agent_C

```text
Kamu adalah Agent_C, bug fixer aplikasi NetWatch.

Perbaiki hasil review Agent_B untuk task [TASK_ID].

Aturan:
1. Baca seluruh laporan Agent_B.
2. Perbaiki semua Critical dan Major issue.
3. Perbaiki Minor issue jika aman dan masih dalam scope.
4. Jangan menambah fitur baru.
5. Jangan melakukan refactor besar tanpa kebutuhan.
6. Tambahkan regression test untuk bug penting.
7. Jalankan lint, test, dan build.
8. Jangan menyatakan selesai jika ada command gagal.
9. Buat commit.
10. Buat laporan perbaikan untuk Agent_B.

Output:
- Temuan Agent_B yang ditangani.
- Penjelasan perbaikan.
- File yang diubah.
- Test yang ditambahkan.
- Hasil lint.
- Hasil test.
- Hasil build.
- Commit hash.
- Temuan yang belum dapat diperbaiki beserta alasannya.
```

---

# 9. Format Handoff Agent_A

```markdown
# Agent_A Handoff

Task ID: NW-XXX
Status: Ready for Review
Branch: feature/NW-XXX-name
Commit: abc123

## Implementasi

- Fitur yang dibuat.
- Keputusan teknis.
- Perubahan database jika ada.

## File yang Diubah

- path/file-1
- path/file-2

## Test

- pnpm lint: PASS
- pnpm test: PASS
- pnpm build: PASS

## Risiko atau Catatan

- Catatan penting.
```

---

# 10. Format Review Agent_B

```markdown
# Agent_B Review

Task ID: NW-XXX
Status: CHANGES REQUESTED

## Ringkasan

Ringkasan hasil review.

## Acceptance Criteria

- [x] Kriteria 1
- [ ] Kriteria 2

## Critical

1. Temuan critical.

## Major

1. Temuan major.

## Minor

1. Temuan minor.

## Recommendation

1. Rekomendasi perbaikan.

## Verification

- pnpm lint: PASS
- pnpm test: FAIL
- pnpm build: PASS

## Final Status

CHANGES REQUESTED
```

---

# 11. Format Handoff Agent_C

```markdown
# Agent_C Fix Report

Task ID: NW-XXX
Status: Ready for Re-Review
Branch: fix/NW-XXX-review-fix
Commit: def456

## Perbaikan

1. Temuan Agent_B nomor 1:
   - Perbaikan yang dilakukan.

2. Temuan Agent_B nomor 2:
   - Perbaikan yang dilakukan.

## Regression Test

- Test baru yang ditambahkan.

## Verification

- pnpm lint: PASS
- pnpm test: PASS
- pnpm build: PASS

## Catatan

Semua Critical dan Major issue telah diperbaiki.
```

---

# 12. Definition of Done Global

Setiap task hanya boleh dianggap selesai jika:

```text
[ ] Requirement telah dipenuhi
[ ] Acceptance criteria terpenuhi
[ ] Lint lulus
[ ] Test lulus
[ ] Build lulus
[ ] Dokumentasi diperbarui
[ ] Agent_A membuat handoff
[ ] Agent_B melakukan review
[ ] Tidak ada Critical issue
[ ] Tidak ada Major issue
[ ] Agent_B memberikan APPROVED
[ ] Kode digabungkan ke develop
```

---

# 13. Hasil Akhir Proyek

Setelah NW-020 selesai, aplikasi harus memiliki:

```text
Login admin
Device group management
Device CRUD
ICMP monitoring
TCP port monitoring
HTTP health monitoring
Automatic scheduler
Failure threshold
Recovery threshold
Realtime dashboard
Incident history
Telegram offline notification
Telegram recovery notification
Latency history
Uptime calculation
Maintenance mode
Manual check
Security hardening
Docker deployment
Backup database
End-to-end test
Release v1.0.0
```

Prinsip utama alur kerja:

```text
Agent_A membangun.
Agent_B memeriksa.
Agent_C memperbaiki.
Agent_B menjadi pintu terakhir sebelum kode diterima.
```
