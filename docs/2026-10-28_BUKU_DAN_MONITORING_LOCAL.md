# Buku utama dan monitoring program — 28 Oktober 2026

Catatan ini merekam tahap lokal sebelum izin rilis. Tahap berikutnya sudah ditayangkan atas instruksi pemilik; lihat [catatan rilis buku dan program](2026-10-28_BUKU_DAN_PROGRAM_RELEASE.md) untuk keadaan aktif dan alamat bagian yang sudah dipisah.

Keputusan pemilik: ringkasan publik; buku lengkap, evaluasi, konfirmasi Wakakur dan checklist hanya admin. Semua pekerjaan lokal, belum commit/push/deploy atau menulis database produksi. Izin rilis tetap perlu konfirmasi pemilik.

## Hasil

- `buku-kurikulum.html`: ringkasan empat kelompok program Bab V dengan tautan bagian situs yang relevan. Tidak memuat teks lengkap atau status monitoring.
- `program-kurikulum.html`: ruang admin untuk membaca/mencari teks, menyunting tiap blok, mengubah rincian program, dan checklist. Program buku dan konfirmasi kegiatan terpisah; centang tidak diambil otomatis dari tanggal atau arsip.
- `server/worker.mjs`: sesi terverifikasi dan role admin untuk halaman serta API. Database memeriksa ulang akun aktif/siap dan admin, tanpa mempercayai peran dari browser.
- `server/curriculum-content.sql`: kandidat tabel privat, fungsi dengan guard, sumber asli, revisi, waktu, akun pengubah dan riwayat. Perubahan revisi lama ditolak. SQL ini BELUM diterapkan ke produksi.
- `scripts/import-curriculum-book.py`: pembacaan Word dan matriks program, keluaran hanya di `private-inputs/` yang diabaikan Git. Tidak mengubah file Drive.
- Data lokal: 3.904 blok teks Word, 40 program, 12 konfirmasi Wakakur. Termasuk isi tabel sebagai urutan teks sel, bukan replika tata letak Word. Penanda blok bukan nomor halaman/paragraf sumber matriks. Word/PDF belum dibandingkan dan pengesahan buku tidak diverifikasi.

## Meninjau lokal

1. Jalankan `python scripts/import-curriculum-book.py "C:\Users\T6N0CV02S35823C\Drive Saya\02 My Space\Teaching\Kurikulum"` bila input lokal belum ada.
2. `node scripts/curriculum-content-lab.mjs`, lalu buka `http://127.0.0.1:4584/__role/admin`. Ringkasan: `http://127.0.0.1:4584/buku-kurikulum.html`.
3. Ini memakai PGlite lokal dan akun contoh; tidak membuktikan akun pemilik di server aktif. Data edit lab berada di memori dan hilang saat proses dimulai ulang. Jangan menggunakan lab untuk pencatatan operasional.

## Aktivasi setelah izin pemilik

Tinjau kandidat SQL dan isi buku privat; terapkan kandidat SQL pada backend Irsyads yang memiliki `private.clinic_account_ready()` dan `private.is_admin()`. Buat seed privat dengan `node scripts/prepare-curriculum-content-seed.mjs`, lalu tinjau/terapkan seed dengan izin terpisah. Seed mengabaikan ID yang sudah ada agar tidak menimpa edit. Jangan commit seed atau dokumen lengkap ke repo publik. Aktifkan `CURRICULUM_CONTENT_ENABLED=true` di Worker hanya setelah tabel, fungsi dan seed siap. Rilis build terkurasi setelah izin rilis, lalu uji masuk dengan akun pemilik, simpan/muat ulang dan akses non-admin pada server aktif. Tidak ada peningkatan peran akun otomatis.

Ringkasan publik adalah kutipan editorial statis, tidak otomatis mengambil edit buku admin: perubahan buku privat tidak boleh tanpa sengaja terpublikasi. Situs tidak menjanjikan pencegahan penyalinan teks publik.

## Validasi

Tes PGlite menjalankan SQL kandidat dengan identitas contoh: pembacaan/penulisan tanpa admin, akses tabel langsung, tipe checklist, revisi basi, pelestarian sumber dan riwayat. Tes Worker memeriksa peran, asal permintaan, flag aktivasi dan halaman privat. Tes akses/SSO lama tetap dijalankan. Browser lokal memeriksa checklist sesudah reload dan layout mobile. Semua hasil adalah bukti lokal; belum ada migrasi/rilis atau penerimaan akun nyata.
