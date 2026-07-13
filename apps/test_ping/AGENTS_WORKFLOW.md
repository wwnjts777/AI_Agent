# STEP-BY-STEP PENGEMBANGAN NETWATCH DENGAN 3 AI AGENT

## 1. Pembagian Tugas Agent

### Agent_A — Developer

Agent_A bertanggung jawab untuk:

* Membuat struktur proyek.
* Menulis kode frontend dan backend.
* Membuat database dan migration.
* Menambahkan fitur.
* Menjalankan build, lint, dan test.
* Membuat commit setelah tugas selesai.
* Menyerahkan hasil kepada Agent_B.

Agent_A tidak melakukan penilaian akhir terhadap kodenya sendiri.

### Agent_B — Code Reviewer

Agent_B bertanggung jawab untuk:

* Memeriksa kode yang dibuat Agent_A.
* Mencari bug, celah keamanan, dan kesalahan logika.
* Memeriksa kesesuaian dengan requirement.
* Memeriksa struktur kode dan kualitas implementasi.
* Menjalankan test ulang.
* Memberikan rekomendasi perbaikan yang jelas.
* Tidak mengubah kode secara langsung.

Agent_B hanya menghasilkan laporan review.

### Agent_C — Bug Fixer

Agent_C bertanggung jawab untuk:

* Membaca laporan Agent_B.
* Memperbaiki kode sesuai rekomendasi.
* Tidak menambahkan fitur yang tidak diminta.
* Menjalankan lint, test, dan build.
* Membuat commit perbaikan.
* Menyerahkan hasil kembali kepada Agent_B untuk verifikasi.

---

# 2. Struktur Workflow Utama

Alur dasar setiap fitur:

```text
Task dibuat
    ↓
Agent_A mengembangkan fitur
    ↓
Agent_A menjalankan test
    ↓
Agent_A membuat commit
    ↓
Agent_B melakukan review
    ↓
Apakah ada masalah?
    ├── Tidak → Task selesai
    └── Ya
         ↓
    Agent_C memperbaiki
         ↓
    Agent_C menjalankan test
         ↓
    Agent_C membuat commit
         ↓
    Agent_B melakukan review ulang
         ↓
    Task selesai atau kembali ke Agent_C
```

Agent_B menjadi quality gate sebelum kode dianggap selesai.

---

# 3. Aturan Kerja Bersama

## 3.1 Satu Task untuk Satu Fitur

Jangan memberikan satu tugas besar seperti:

```text
Buat seluruh aplikasi NetWatch.
```

Pecah menjadi task kecil seperti:

```text
NW-001 Inisialisasi monorepo
NW-002 Setup database
NW-003 Login admin
NW-004 CRUD perangkat
NW-005 ICMP monitoring
NW-006 TCP monitoring
NW-007 HTTP monitoring
NW-008 Status transition
NW-009 Incident management
NW-010 Dashboard real-time
NW-011 Telegram notification
NW-012 Docker deployment
```

## 3.2 Setiap Task Harus Memiliki Acceptance Criteria

Contoh:

```text
Task ID:
NW-004

Judul:
Membuat CRUD perangkat

Acceptance Criteria:
1. Admin dapat melihat daftar perangkat.
2. Admin dapat menambahkan perangkat.
3. Admin dapat mengubah perangkat.
4. Admin dapat menghapus perangkat.
5. Host harus berupa IP atau hostname yang valid.
6. Data tersimpan di SQLite.
7. Endpoint dilindungi autentikasi.
8. Unit test dan integration test lulus.
```

## 3.3 Agent Tidak Boleh Mengubah Scope Sendiri

Agent_A dan Agent_C tidak boleh:

* Menambahkan fitur di luar task.
* Mengubah struktur besar tanpa alasan.
* Menghapus fitur lama.
* Mengganti teknologi tanpa persetujuan.
* Mengabaikan acceptance criteria.

---

# 4. Struktur Git yang Disarankan

Gunakan branch utama:

```text
main
develop
```

Untuk setiap fitur:

```text
feature/NW-001-project-setup
feature/NW-002-database
feature/NW-003-authentication
feature/NW-004-device-crud
```

Untuk perbaikan hasil review:

```text
fix/NW-004-device-crud-review
```

Alur branch:

```text
main
  └── develop
        └── feature/NW-004-device-crud
                ↓
          Agent_A coding
                ↓
          Agent_B review
                ↓
          Agent_C fixing
                ↓
          Agent_B approve
                ↓
          merge ke develop
```

Jangan langsung bekerja di branch `main`.

---

# 5. Format Handoff Antar-Agent

Gunakan file berikut di dalam repository:

```text
docs/
├── requirements/
│   └── NW-004.md
├── handoffs/
│   ├── NW-004-agent-a.md
│   ├── NW-004-agent-b-review.md
│   └── NW-004-agent-c-fix.md
└── decisions/
    └── ADR-001-technology-stack.md
```

## Handoff Agent_A

```markdown
# Agent A Handoff

Task ID: NW-004
Status: Ready for Review
Branch: feature/NW-004-device-crud
Commit: <commit-hash>

## Yang Dikerjakan

- Menambahkan endpoint daftar perangkat.
- Menambahkan endpoint tambah perangkat.
- Menambahkan endpoint edit perangkat.
- Menambahkan endpoint hapus perangkat.
- Menambahkan validasi IP dan hostname.

## File Utama yang Diubah

- apps/api/src/routes/device.routes.js
- apps/api/src/controllers/device.controller.js
- apps/api/src/services/device.service.js
- apps/api/src/validators/device.validator.js
- apps/api/tests/device.test.js

## Test

- pnpm lint: PASS
- pnpm test: PASS
- pnpm build: PASS

## Catatan

- Penghapusan perangkat menggunakan hard delete.
- Endpoint menggunakan authentication middleware.
```

## Laporan Agent_B

```markdown
# Agent B Review

Task ID: NW-004
Status: Changes Requested

## Ringkasan

Fitur CRUD berjalan, tetapi masih ditemukan masalah validasi dan keamanan.

## Temuan

### Critical

1. Endpoint delete belum memeriksa apakah perangkat memiliki incident aktif.

### Major

1. Host kosong masih dapat disimpan.
2. Port di atas 65535 belum ditolak.
3. Error database masih dikirim langsung ke frontend.

### Minor

1. Nama fungsi `getAll` terlalu umum.
2. Tidak ada test untuk hostname.

## Rekomendasi Perbaikan

1. Tolak penghapusan perangkat dengan incident aktif.
2. Tambahkan validasi host.
3. Batasi port dari 1 sampai 65535.
4. Gunakan error handler terpusat.
5. Tambahkan test hostname dan port invalid.

## Kesimpulan

Belum layak digabungkan ke branch develop.
```

## Handoff Agent_C

```markdown
# Agent C Fix Report

Task ID: NW-004
Status: Ready for Re-Review
Branch: fix/NW-004-device-crud-review
Commit: <commit-hash>

## Perbaikan

1. Menolak delete jika ada incident aktif.
2. Menambahkan validasi host.
3. Menambahkan validasi port.
4. Menambahkan error handler.
5. Menambahkan test tambahan.

## Test

- pnpm lint: PASS
- pnpm test: PASS
- pnpm build: PASS

## Catatan

Semua rekomendasi Agent_B telah ditangani.
```

---

# 6. Urutan Pembangunan Aplikasi

## Fase 1 — Persiapan Proyek

### Task NW-001 — Inisialisasi Project

#### Agent_A

Mengerjakan:

* Membuat monorepo.
* Membuat folder frontend dan backend.
* Mengatur pnpm workspace.
* Menambahkan ESLint.
* Menambahkan Prettier.
* Menambahkan environment example.
* Membuat endpoint `/health`.
* Membuat README awal.

Target struktur:

```text
netwatch/
├── apps/
│   ├── api/
│   └── web/
├── packages/
├── docs/
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

#### Agent_B

Memeriksa:

* Struktur folder.
* Script build.
* Script lint.
* Script test.
* Environment variable.
* Endpoint health.
* Dependency yang tidak diperlukan.

#### Agent_C

Memperbaiki:

* Kesalahan konfigurasi.
* Script yang gagal.
* Struktur yang tidak konsisten.
* Masalah dependency.

Definition of Done:

```text
pnpm install berhasil
pnpm lint berhasil
pnpm test berhasil
pnpm build berhasil
GET /health mengembalikan 200
```

---

## Fase 2 — Database

### Task NW-002 — Setup SQLite dan Prisma

#### Agent_A

Mengerjakan:

* Memasang Prisma.
* Menghubungkan SQLite.
* Membuat schema.
* Membuat migration.
* Membuat seed admin.
* Membuat seed perangkat contoh.

Model awal:

```text
User
DeviceGroup
Device
MonitoringResult
Incident
NotificationLog
ApplicationSetting
```

#### Agent_B

Memeriksa:

* Relasi tabel.
* Index database.
* Cascade delete.
* Default value.
* Enum status.
* Field nullable.
* Migration dapat dijalankan dari awal.

#### Agent_C

Memperbaiki:

* Relasi salah.
* Index yang kurang.
* Migration error.
* Seed tidak idempotent.
* Nama field yang tidak konsisten.

Definition of Done:

```text
Database dapat dibuat dari nol
Migration berhasil
Seed berhasil
Data admin tersedia
Prisma Client dapat digunakan
```

---

## Fase 3 — Authentication

### Task NW-003 — Login Admin

#### Agent_A

Mengerjakan:

* Login.
* Logout.
* Endpoint current user.
* Password hashing.
* Authentication middleware.
* Halaman login.
* Protected route.

#### Agent_B

Memeriksa:

* Password tidak disimpan sebagai plaintext.
* Token atau session aman.
* Error login tidak membocorkan informasi.
* Ada rate limiting.
* Protected endpoint tidak dapat diakses tanpa login.
* Cookie aman jika menggunakan session.

#### Agent_C

Memperbaiki semua temuan keamanan dan test.

Definition of Done:

```text
Admin dapat login
Admin dapat logout
Endpoint terlindungi
Password menggunakan bcrypt atau argon2
Test authentication lulus
```

---

## Fase 4 — Manajemen Perangkat

### Task NW-004 — CRUD Device

#### Agent_A

Mengerjakan:

* Daftar perangkat.
* Tambah perangkat.
* Edit perangkat.
* Hapus perangkat.
* Aktifkan atau nonaktifkan perangkat.
* Filter berdasarkan grup dan status.
* Validasi IP, hostname, port, dan URL.

#### Agent_B

Memeriksa:

* Validasi input.
* Duplicate host.
* Status default.
* Authorization.
* Error handling.
* Test CRUD.
* Data frontend sesuai response backend.

#### Agent_C

Memperbaiki semua temuan.

Definition of Done:

```text
CRUD perangkat berjalan
Validasi berjalan
Filter berjalan
Data tersimpan
Test lulus
```

---

## Fase 5 — Monitoring Engine

### Task NW-005 — ICMP Ping

#### Agent_A

Mengerjakan:

* Fungsi ICMP ping.
* Timeout.
* Penyimpanan latency.
* Penyimpanan error.
* Manual check.
* Worker scheduler.

#### Agent_B

Memeriksa:

* Input host aman.
* Tidak ada command injection.
* Timeout bekerja.
* Worker tidak overlap.
* Concurrency dibatasi.
* Error ditangani.
* Monitoring result tersimpan.

#### Agent_C

Memperbaiki error worker dan keamanan.

Definition of Done:

```text
IP aktif terdeteksi online
IP tidak aktif menghasilkan timeout
Latency tersimpan
Manual check berjalan
Scheduler tidak menjalankan task ganda
```

### Task NW-006 — TCP Port Check

#### Agent_A

Menambahkan:

* TCP socket check.
* Port validation.
* Timeout.
* Latency.
* Error connection refused.

#### Agent_B

Memeriksa:

* Socket selalu ditutup.
* Tidak ada memory leak.
* Timeout bekerja.
* Port invalid ditolak.
* Test port terbuka dan tertutup.

#### Agent_C

Memperbaiki berdasarkan review.

### Task NW-007 — HTTP Health Check

#### Agent_A

Menambahkan:

* HTTP dan HTTPS check.
* Timeout.
* Expected status code.
* Redirect limit.
* Latency.
* Error response.

#### Agent_B

Memeriksa:

* Risiko SSRF.
* Protocol restriction.
* Redirect.
* Timeout.
* Response body tidak dibaca berlebihan.
* URL validation.

#### Agent_C

Memperbaiki seluruh risiko yang ditemukan.

---

## Fase 6 — Status dan Incident

### Task NW-008 — Status Transition

#### Agent_A

Membuat aturan:

```text
UNKNOWN
ONLINE
WARNING
OFFLINE
MAINTENANCE
DISABLED
```

Logika awal:

```text
1 kali gagal = status tetap
2 kali gagal = WARNING
3 kali gagal = OFFLINE
2 kali berhasil setelah offline = ONLINE
```

#### Agent_B

Memeriksa:

* Failure threshold.
* Recovery threshold.
* Latency warning.
* Status maintenance.
* Status disabled.
* Race condition.
* Test seluruh transition.

#### Agent_C

Memperbaiki logika yang salah.

Definition of Done:

```text
Status tidak berubah karena satu kegagalan
Failure threshold bekerja
Recovery threshold bekerja
Semua transition memiliki test
```

### Task NW-009 — Incident Management

#### Agent_A

Mengerjakan:

* Membuka incident saat offline.
* Menutup incident saat recovery.
* Menghitung downtime.
* Menyimpan error awal.
* Mencegah duplicate incident.

#### Agent_B

Memeriksa:

* Satu perangkat hanya memiliki satu incident aktif.
* Downtime benar.
* Recovery menutup incident.
* Restart aplikasi tidak membuat duplicate.
* Transaction database digunakan jika perlu.

#### Agent_C

Memperbaiki incident logic.

---

## Fase 7 — Dashboard Real-Time

### Task NW-010 — WebSocket Dashboard

#### Agent_A

Mengerjakan:

* Socket.IO server.
* Socket.IO client.
* Event perubahan perangkat.
* Summary card.
* Tabel perangkat.
* Filter.
* Waktu last check.
* Durasi downtime.

#### Agent_B

Memeriksa:

* Socket reconnect.
* Listener tidak terdaftar berulang.
* Data tidak duplikat.
* Status frontend sesuai backend.
* Dashboard tidak perlu reload.
* Tampilan tetap berfungsi saat WebSocket putus.

#### Agent_C

Memperbaiki masalah realtime dan state.

Definition of Done:

```text
Status berubah tanpa reload
Summary card ikut berubah
Socket reconnect berjalan
Tidak ada duplicate event
```

---

## Fase 8 — Telegram Notification

### Task NW-011 — Telegram Bot

#### Agent_A

Mengerjakan:

* Konfigurasi bot token.
* Konfigurasi chat ID.
* Tombol test notification.
* Offline notification.
* Recovery notification.
* Notification log.
* Anti-spam.

#### Agent_B

Memeriksa:

* Token tidak dikirim ke frontend.
* Token tidak masuk Git.
* Notifikasi hanya pada perubahan status.
* Recovery dikirim sekali.
* Error Telegram tidak menghentikan worker.
* Pesan tidak berisi HTML yang tidak aman.

#### Agent_C

Memperbaiki seluruh temuan.

Definition of Done:

```text
Test message berhasil
Offline message berhasil
Recovery message berhasil
Tidak ada spam notifikasi
Kegagalan Telegram tidak menghentikan monitoring
```

---

## Fase 9 — Laporan dan Riwayat

### Task NW-012 — Monitoring History

#### Agent_A

Mengerjakan:

* Riwayat hasil check.
* Riwayat incident.
* Filter tanggal.
* Grafik latency.
* Perhitungan uptime.
* Data retention.

#### Agent_B

Memeriksa:

* Rumus uptime.
* Query database.
* Pagination.
* Performa.
* Timezone.
* Retention cleanup.
* Grafik tidak memuat terlalu banyak data.

#### Agent_C

Memperbaiki query dan perhitungan.

---

## Fase 10 — Deployment

### Task NW-013 — Docker

#### Agent_A

Mengerjakan:

* Dockerfile backend.
* Dockerfile frontend.
* Docker Compose.
* SQLite volume.
* Environment production.
* Restart policy.
* Health check.
* Capability ICMP.

#### Agent_B

Memeriksa:

* Database persisten.
* Secret tidak masuk image.
* Container berjalan sebagai user non-root jika memungkinkan.
* Port exposure.
* Restart.
* ICMP bekerja dalam container.
* Build production berhasil.

#### Agent_C

Memperbaiki konfigurasi deployment.

Definition of Done:

```text
docker compose up -d berhasil
Frontend dapat dibuka
Backend dapat diakses
Ping berjalan
Database tetap ada setelah restart
```

---

# 7. Prompt Agent_A

```text
Kamu adalah Agent_A, developer utama aplikasi NetWatch.

Tugas kamu adalah mengembangkan Task [TASK_ID] berdasarkan dokumen requirement yang diberikan.

Aturan:
1. Baca requirement dan acceptance criteria sebelum coding.
2. Jangan mengubah scope.
3. Gunakan struktur proyek yang sudah ada.
4. Jangan menghapus fitur yang telah berjalan.
5. Tambahkan validasi dan error handling.
6. Tambahkan atau perbarui test.
7. Jalankan lint, test, dan build.
8. Jangan menyatakan selesai jika ada perintah yang gagal.
9. Buat handoff report untuk Agent_B.
10. Sebutkan file yang diubah, keputusan teknis, hasil test, dan risiko yang masih ada.

Output akhir:
- Ringkasan implementasi.
- Daftar file yang diubah.
- Hasil lint, test, dan build.
- Commit hash.
- Handoff report.
```

---

# 8. Prompt Agent_B

```text
Kamu adalah Agent_B, code reviewer aplikasi NetWatch.

Tugas kamu adalah melakukan review terhadap hasil Agent_A atau Agent_C.

Aturan:
1. Jangan mengubah kode.
2. Periksa requirement dan acceptance criteria.
3. Periksa keamanan, logika, performa, database, error handling, dan test.
4. Jalankan lint, test, build, serta test tambahan jika diperlukan.
5. Jangan hanya menilai style kode.
6. Cari bug yang dapat terjadi pada penggunaan nyata.
7. Kelompokkan temuan menjadi Critical, Major, Minor, dan Suggestion.
8. Setiap temuan harus menyebutkan file, masalah, dampak, dan rekomendasi.
9. Nyatakan hasil akhir sebagai Approved atau Changes Requested.
10. Jangan memberikan status Approved jika ada temuan Critical atau Major.

Output akhir:
- Ringkasan review.
- Hasil pengecekan acceptance criteria.
- Daftar temuan.
- Rekomendasi perbaikan.
- Status akhir.
```

---

# 9. Prompt Agent_C

```text
Kamu adalah Agent_C, bug fixer aplikasi NetWatch.

Tugas kamu adalah memperbaiki hasil review Agent_B.

Aturan:
1. Baca seluruh laporan Agent_B.
2. Perbaiki hanya masalah yang tercantum dalam review.
3. Jangan menambahkan fitur baru.
4. Jangan mengubah struktur besar jika tidak diperlukan.
5. Pertahankan backward compatibility.
6. Tambahkan regression test untuk setiap bug penting.
7. Jalankan lint, test, dan build.
8. Jangan menyatakan selesai jika masih ada test gagal.
9. Buat laporan yang menghubungkan setiap temuan dengan perbaikannya.
10. Serahkan hasil kembali kepada Agent_B untuk review ulang.

Output akhir:
- Daftar temuan yang diperbaiki.
- File yang diubah.
- Test yang ditambahkan.
- Hasil lint, test, dan build.
- Commit hash.
- Catatan yang belum dapat diperbaiki.
```

---

# 10. Format Review Checklist Agent_B

## Functionality

```text
[ ] Fitur sesuai requirement
[ ] Acceptance criteria terpenuhi
[ ] Tidak ada fitur lama yang rusak
[ ] Error state ditangani
[ ] Empty state ditangani
```

## Backend

```text
[ ] Input tervalidasi
[ ] Error handler digunakan
[ ] Authentication diterapkan
[ ] Query database aman
[ ] Transaction digunakan jika diperlukan
[ ] Tidak ada duplicate process
```

## Frontend

```text
[ ] Loading state tersedia
[ ] Error state tersedia
[ ] Data realtime tidak duplikat
[ ] Listener dibersihkan
[ ] Form tervalidasi
[ ] Tampilan responsif
```

## Security

```text
[ ] Tidak ada secret di repository
[ ] Tidak ada command injection
[ ] Tidak ada SSRF terbuka
[ ] Password di-hash
[ ] Endpoint sensitif dilindungi
[ ] Data sensitif tidak masuk log
```

## Monitoring

```text
[ ] Timeout bekerja
[ ] Failure threshold bekerja
[ ] Recovery threshold bekerja
[ ] Incident tidak duplikat
[ ] Notification tidak spam
[ ] Worker tidak overlap
```

## Quality

```text
[ ] Lint lulus
[ ] Test lulus
[ ] Build lulus
[ ] Test mencakup kasus utama
[ ] Dokumentasi diperbarui
```

---

# 11. Aturan Siklus Review

Maksimal siklus normal:

```text
Agent_A
  ↓
Agent_B Review 1
  ↓
Agent_C Fix 1
  ↓
Agent_B Review 2
```

Jika setelah Review 2 masih ditemukan masalah:

```text
Critical atau Major
    → kembali ke Agent_C

Minor
    → dapat dibuat sebagai technical debt

Suggestion
    → tidak menghalangi merge
```

Agent_B hanya boleh memberi status:

```text
APPROVED
APPROVED WITH MINOR NOTES
CHANGES REQUESTED
BLOCKED
```

---

# 12. Kondisi Task Dinyatakan Selesai

Task hanya dianggap selesai jika:

```text
Acceptance criteria terpenuhi
Lint lulus
Test lulus
Build lulus
Tidak ada temuan Critical
Tidak ada temuan Major
Agent_B memberikan Approved
Dokumentasi telah diperbarui
Commit telah dibuat
Kode telah digabungkan ke develop
```

---

# 13. Urutan Task yang Direkomendasikan

```text
NW-001 Project Setup
NW-002 Database Setup
NW-003 Authentication
NW-004 Device CRUD
NW-005 ICMP Monitoring
NW-006 TCP Monitoring
NW-007 HTTP Monitoring
NW-008 Status Transition
NW-009 Incident Management
NW-010 Real-Time Dashboard
NW-011 Telegram Notification
NW-012 History and Uptime
NW-013 Docker Deployment
NW-014 Security Hardening
NW-015 Final End-to-End Testing
```

---

# 14. End-to-End Testing Terakhir

Setelah semua fitur selesai, berikan tugas akhir berikut.

## Agent_A

Menyiapkan skenario end-to-end:

1. Login.
2. Tambah IP aktif.
3. Tambah IP tidak aktif.
4. Jalankan monitoring.
5. Pastikan status berubah.
6. Simulasikan perangkat offline.
7. Pastikan incident dibuat.
8. Pastikan Telegram dikirim.
9. Aktifkan kembali perangkat.
10. Pastikan recovery dikirim.
11. Restart container.
12. Pastikan data tetap tersedia.

## Agent_B

Melakukan final audit:

* Feature audit.
* Security audit.
* Database audit.
* Worker audit.
* Notification audit.
* Deployment audit.
* Acceptance criteria audit.

## Agent_C

Memperbaiki temuan final tanpa menambah fitur baru.

Setelah final review Agent_B memberikan status `APPROVED`, versi aplikasi dapat diberi tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

# 15. Prinsip Utama

```text
Agent_A membangun.
Agent_B menguji dan mengkritik.
Agent_C memperbaiki.
Agent_B menjadi pintu terakhir sebelum kode diterima.
```

Dengan pembagian ini, Agent_A dapat fokus pada implementasi, Agent_B tetap objektif dalam melakukan review, dan Agent_C fokus memperbaiki masalah tanpa mencampur proses pengembangan fitur.
