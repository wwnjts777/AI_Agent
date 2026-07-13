# PRD Kalkulator Web Sederhana

## 1. Ringkasan Produk
Aplikasi kalkulator web sederhana untuk melakukan operasi dasar: tambah, kurang, kali, bagi. Fokus utama: cepat, ringan, dan mudah dipakai.

## 2. Tujuan Produk
- User hitung angka dengan cepat di browser
- UI simpel dan jelas
- Jalan tanpa backend dan tanpa setup rumit

## 3. Target User
- Pelajar
- Karyawan
- User umum yang butuh kalkulator cepat

## 4. Masalah yang Diselesaikan
- User perlu hitung cepat tanpa buka aplikasi kalkulator bawaan OS
- User butuh tool web ringan untuk operasi dasar

## 5. Scope MVP

### Fitur Wajib
- Input angka via tombol
- Operasi dasar:
  - tambah (`+`)
  - kurang (`-`)
  - kali (`*`)
  - bagi (`/`)
- Tombol `=`
- Tombol `C` untuk clear
- Tampilan hasil di layar
- Layout grid responsif

### Fitur Non-Wajib
- Desimal
- Keyboard input
- Riwayat perhitungan
- Dark mode
- Persen
- Plus/minus
- Scientific calculator

## 6. User Flow
1. User buka halaman kalkulator
2. User tekan angka
3. User pilih operasi
4. User tekan angka lagi
5. User tekan `=`
6. Hasil tampil di layar
7. User tekan `C` untuk reset

## 7. Kebutuhan Fungsional
- User bisa input angka 0–9
- User bisa pilih operasi dasar
- User bisa ganti operasi sebelum hitung
- User bisa lanjut hitung dari hasil sebelumnya
- User bisa reset semua state
- Pembagian nol tidak bikin aplikasi crash

## 8. Kebutuhan Non-Fungsional
- Ringan
- Responsif di mobile dan desktop
- Cepat load
- Tanpa dependency berat
- Mudah dipelihara

## 9. Batasan
- Tidak ada login
- Tidak ada backend
- Tidak ada penyimpanan data
- Tidak ada fitur matematika lanjutan

## 10. Success Metric
- User bisa selesai hitung tanpa error
- UI rapi di layar kecil
- Load cepat di browser
- Operasi dasar berjalan benar

## 11. Tech Stack
- Next.js
- React
- TypeScript
- CSS Grid / inline style / Tailwind

## 12. Acceptance Criteria
- Kalkulator tampil di halaman web
- Operasi dasar berjalan benar
- Tombol `C` reset state
- Hasil muncul setelah `=`
- Layout tetap rapi di mobile