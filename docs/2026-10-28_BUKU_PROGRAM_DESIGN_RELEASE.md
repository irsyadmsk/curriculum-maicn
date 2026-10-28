# Penyelarasan desain buku dan program — 28 Oktober 2026

Koreksi lanjutan dari rilis buku/program atas permintaan pemilik: samakan dengan Curriculum dan buat perpindahan bagian jelas serta nyaman di HP. Izin menayangkan pada tugas ini melanjutkan instruksi rilis fitur yang sama.

Keempat halaman (`buku-kurikulum.html`, `program.html`, `buku-admin.html`, `program-kurikulum.html`) sekarang memakai kerangka halaman utama: sidebar, header, merek, font Plus Jakarta Sans, token warna, pengaturan tampilan, drawer, pencarian dan navigasi bawah HP dari lapisan `curriculum-ui`. Gaya tambahan hanya berlaku pada area buku/program dan dialog penyuntingannya; tidak ada gaya global terpisah yang menimpa header atau navigasi.

Navigasi antarhalaman memakai tautan dengan urutan tetap dan `aria-current=page`. Halaman publik menyembunyikan tautan admin menurut sesi terverifikasi. Tab Program buku / Konfirmasi kegiatan hanya mengubah panel monitoring, memiliki ARIA/keyboard yang sesuai, URL `#program` / `#confirmation`, dan tombol Kembali memulihkan panel. Posisi tab tetap ketika panel berubah. Tampilan buku memiliki penghitung blok teks tersendiri. Sidebar mendapatkan ikon dan kelompok Buku & Program; label serta kontrol mobile mengikuti Curriculum.

## Bukti

- 22 tes lokal terarah lulus, termasuk akses/SSO dan perilaku data beranda.
- 16 pemeriksaan browser lokal: empat halaman pada lebar 320, 390, 768 dan 1366 px; tanpa overflow atau pageerror dan tepat satu penanda bagian aktif.
- Pemeriksaan interaksi lokal memakai akun contoh: posisi tab tidak bergeser, tombol Kembali memulihkan tab, tombol panah mengganti tab, drawer mengembalikan fokus setelah Escape, edit dan checklist terbaca setelah reload. Ini bukan sesi akun pemilik.
- Lima hash aset online cocok dengan kandidat, dua halaman admin tetap mengarah ke login anonim, enam pemeriksaan browser publik pada 320/390/1366 px tanpa overflow/pageerror.
- Tidak ada perubahan skema atau penulisan data produksi. Buku, catatan dan checklist di server dipertahankan. Semua perubahan interaksi uji hanya di lab lokal.

## Rilis

Cloudflare Worker: `da9039f2-deb9-43b3-a5c7-92d7a9a6fe5c`; sebelumnya `ee502f48-d109-4cd6-9335-f06ce346c93e`. Paket/receipt terkurasi berada di `.codex/releases/curriculum-20261028-content-design/` di luar repo publik. Pemulihan UI dapat memakai versi Worker sebelumnya tanpa menghapus tabel atau data.
