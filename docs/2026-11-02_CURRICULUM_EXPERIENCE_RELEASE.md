# Rilis ruang Curriculum dan ringkasan pagi

2 November 2026, WIB. Pemilik mengizinkan rilis dengan jawaban **“boleh”** atas paket Curriculum, migrasi database, dan aktivasi email Senin–Selasa pukul 07.00 WIB ke `irsyad.msk@gmail.com`.

## Aktif

- Beranda harian: <https://curriculum.irsyads.com/>.
- Ruang pengelolaan: <https://curriculum.irsyads.com/kurikulum.html>. Tab ringkasan/salin WA, tabel peserta, identitas/lokasi, persetujuan klinik, ajuan akademik, pengumuman, Senin JP 1, serta email/kalender kerja.
- Worker `curriculum-maicn` versi `2fa8afa2-d2a7-4db2-95c7-39097502c261`. Versi sebelum rilis: `1ee178e4-5e1f-4316-9537-f03e76d7d26d`.
- Migrasi produksi `20261102025214_curriculum_experience`; source SQL sama dengan `server/curriculum-operations.sql`.
- Edge Function `curriculum-notifications` versi 3, JWT tetap wajib. Versi sebelumnya 2. Secret Resend tetap di Supabase.
- `CURRICULUM_OPERATIONS_ENABLED=true` dan `CURRICULUM_OPERATIONS_EMAIL_ENABLED=true`. Flag SSO, Klinik v2, buku/program, dan email sebelumnya dipertahankan. Cron `*/5 * * * *` mencakup 07.00 WIB; enqueue memakai scheduledTime dan kunci unik per hari.
- Ringkasan Senin mencakup Senin–Selasa; ringkasan Selasa mencakup Selasa. Keputusan otomatis atau pengiriman WhatsApp tidak ditambahkan.

## Pengiriman awal dan bukti Inbox

Pada 2 November 2026 pukul 09.55 WIB, satu ringkasan pagi dan tiga pengingat ajuan lama masuk ke antrean untuk admin. Keempatnya `provider_accepted`, masing-masing satu percobaan. Pemanggilan dispatcher verifikasi setelahnya memproses nol pesan, sehingga tidak menggandakan pengiriman. Pengiriman awal dilakukan setelah waktu 07.00 karena fitur baru diaktifkan pagi ini; jadwal berikutnya Selasa, 3 November 2026 pukul 07.00 WIB.

Ringkasan **terverifikasi berada di Inbox Gmail**: `[Curriculum] Ringkasan pagi · 2026-11-02`, timestamp `2026-11-02T02:55:52Z`, message ID `1a19a2f4eef34452`. Pembacaan pesan mengonfirmasi Fisika, informasi Selasa, tabel HTML, status belum terjadwal, dan lokasi belum ditetapkan. Tidak menyalin isi email privat atau roster ke repo publik. Pesan tersebut dapat dibuka di [Gmail admin](https://mail.google.com/mail/u/?authuser=irsyad.msk%40gmail.com#all/1a19a2f4eef34452).

## Verifikasi dan batas bukti

- Simulasi migrasi pada database asli selesai dalam transaksi yang di-rollback sebelum pemasangan resmi. Snapshot fungsi/grant, Edge Function, versi Cloudflare, hash source, dan hasil cek tersimpan privat di `C:/Users/T6N0CV02S35823C/.codex/releases/curriculum-experience-20261102/`.
- Sesudah pemasangan, delapan ajuan klinik dan 12 event lama tetap ada, ajuan akademik tetap nol. Tidak membuat atau mengubah keputusan klinik, penempatan peserta, lokasi operasional, role global, password, atau akun.
- Seluruh lima tabel privat baru ber-RLS, tanpa SELECT langsung bagi anon/authenticated. Implementasi `before_experience` tertutup bagi anon/authenticated/service_role.
- Aktor database staf aktif dan admin dapat membaca ruang baru. Staf tetap ditolak Studio utama; aktor yang belum mengganti password tetap ditolak ruang staf. Pemeriksaan aktor dilakukan dalam transaksi rollback; bukan login UI sekolah asli.
- 19 hash aset utama cocok dengan paket produksi; tujuh batas akses tamu sesuai; API harian 200 dan hanya menampilkan satu klinik disetujui. Data privat peserta, foto, bukti, dan email tidak muncul dalam proyeksi klinik publik.
- 64 tes terarah sudah lulus pada kandidat; 21 tes terarah gateway/harian dijalankan ulang saat rilis. Build 116 aset terkurasi. Suite luas sebelumnya memiliki dua kegagalan di luar fitur: path Drive lokal dan klaim Tahfidz 30 Juz.
- Browser lokal untuk verifikasi produksi ditolak pengaturan Work dengan pesan `Local browser use is disabled in Work settings`. Tidak melewati pembatasan itu. Bukti visual HP/laptop berasal dari pratinjau sintetis sebelumnya; bukti produksi kali ini HTTP/hash, SQL asli, dan Inbox Gmail. Tidak mengklaim LCP/INP lapangan, sesi UI sekolah asli, atau foto murid sungguhan telah diuji.
- Unggahan Worker pertama ditolak Cloudflare: `No such module curriculum-digest.mjs`. Tidak aktif. Paket diperbaiki dengan entry Worker di root paket dan impor relatif lengkap; unggahan kedua berhasil.

Advisor memberikan INFO RLS tanpa policy pada tabel privat tertutup, serta WARN RPC SECURITY DEFINER yang memang merupakan jalur terbatas. Grant langsung tabel tidak dibuka; semua endpoint staf memeriksa penugasan di server. Panduan: [RLS tanpa policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [RPC authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Temuan lama di layanan lain tidak diubah.

## Pemulihan

Matikan flag email lebih dahulu bila perlu menghentikan pengiriman baru. Snapshot versi/config sebelum rilis dan source paket ada di lokasi privat di atas. Jangan hanya mengembalikan Worker lama sambil membiarkan kontrak baru setengah aktif: backend baru mewajibkan identitas. Gunakan paket frontend/backend yang kompatibel dan tutup pengajuan selama pemulihan bila diperlukan. Jangan menghapus tabel, ajuan, event, foto pending, atau receipt untuk rollback. Foto pada data aktif dihapus oleh transaksi keputusan; ini tidak menjanjikan penghapusan dari backup infrastruktur.

Kode rilis masih lokal dan belum di-commit/push; tidak menjalankan GitHub Actions atau menerbitkan Studio utama. Perubahan checkout lain yang muncul selama pekerjaan dipertahankan. Folder uji lama tetap ada karena pembersihan rekursif sebelumnya ditolak pemeriksaan otomatis; jangan menyalin snapshot usang itu kembali ke repo utama.
