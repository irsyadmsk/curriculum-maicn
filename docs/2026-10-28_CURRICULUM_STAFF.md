# Ruang staf Curriculum dan pembatasan Studio

28 Oktober 2026, WIB. Pemilik meminta Adi Suprihadi dan Asep Jafar menjadi staf kurikulum untuk persetujuan klinik/switch melalui Curriculum. Klarifikasi terakhir: **Studio hanya admin dan asisten**, bukan admin saja. Setelah jawaban pemilik **“Ya, aktifkan semuanya”**, migrasi dan kedua penugasan sudah dipasang pada produksi; ruang staf Curriculum dan gerbang Studio sudah tayang.

## Pembagian akses

- `kurikulum.html`: hanya admin/staf kurikulum yang ditugaskan pada institusi. Persetujuan Klinik memakai komponen bersama Studio melalui proxy Worker origin yang sama: alokasi bentrok per nama, pengecualian kelas, konfirmasi, revisi dan receipt tetap dipertahankan. Persetujuan switch memakai aturan kelas/JP/minggu dan konfirmasi yang sama.
- Staf hanya mendapat review klinik dan switch. Keputusan proyek/kolaborasi/remedial/dispensasi, pengelolaan akun, serta perubahan blok Senin tetap admin. Pembacaan jurnal staf dibatasi oleh penugasan jurnal sebenarnya; penugasan staf tidak memberi akses arsip seluruh guru.
- Halaman admin lama Curriculum tetap admin. Data/nilai guru memerlukan tautan pengampu yang sah; staf tanpa tautan guru tidak mendapat akses itu otomatis.
- Studio: Worker memvalidasi token SSO asli dan `studio_workspace_access()` sebelum mengirim shell. Hanya admin atau akun berperan `assistant` yang aktif dan sudah menyelesaikan ganti sandi dapat masuk. Metadata browser/cookie peran bukan otorisasi. Komponen Studio juga membatasi ke admin/asisten. Aset JS/CSS publik berisi kode, bukan data akun; RLS/RPC layanan tetap melindungi data yang juga dipakai Academy/Curriculum.
- Tidak ada perubahan peran global dua staf menjadi admin/asisten. Akun Asep masih `must_change_password=true`, sehingga wajib menyelesaikan sandi awal sebelum dapat memakai hak staf. Sandi tidak diubah atau dibuka oleh pekerjaan ini.

## Komponen

`assets/curriculum-review.mjs`, `kurikulum.html`, modul UI bersama `assets/clinic-review-ui.{js,css}`, serta opsi `reviewOnly/allowedKinds` pada `school-admin.mjs`. Bundel Klinik dihasilkan dari `../irsyads/scripts/export-curriculum-review.mjs` dan entry/proxy paket bersama; jangan menyunting bundel secara manual. Tautan publik klinik menuju Curriculum, bukan Studio.

`server/curriculum-staff.sql` sudah diterapkan sebagai migrasi `20261028130152_curriculum_staff_workspace`. Fungsi lama dipertahankan sebagai implementasi internal tanpa hak panggil anon/authenticated/service_role; wrapper terotorisasi tetap menjaga kontrak/revisi. Data ajuan/jurnal tidak dihapus. Penugasan dua akun terverifikasi dijalankan dari `.codex/releases/curriculum-staff-20261028/staff-grant.sql` dengan pemeriksaan ID, nama serta status sebelum insert idempoten.

Worker Studio berada di `../irsyads/apps/studio/src/worker.mjs`, menggunakan cookie SSO induk yang sama, memeriksa Auth dan RPC pada server, tanpa kredensial service. Kunci publishable pada konfigurasi memang publik. Respons shell/gagal tanpa cache. Build mempertahankan sumber Khazanah/Academy yang sudah tayang dalam Studio `c526207d` walau belum di-commit oleh pekerjaan lain; perubahan lain ditahan pada HEAD.

## Bukti

- 38 tes terarah Curriculum lulus (gateway, Klinik, SSO, jadwal, kalender A4).
- 19 tes komponen Studio/Worker/UI switch lulus, ditambah skenario SQL PGlite untuk staf, penolakan akses lain, ganti sandi dan admin/asisten.
- TypeScript tujuh root terkait tanpa diagnostic; Studio dua halaman berhasil dibangun. Curriculum 109 aset terkurasi.
- Simulasi kandidat dan dua penugasan pada database asli dilakukan dalam transaksi yang di-rollback: konteks Adi curriculum/Studio ditolak; Asep tetap member karena sandi awal; akun admin pemilik tetap lolos; review non-switch/admin ditolak. Tidak ada keputusan operasional/email yang dibuat.
- UI diperiksa dengan komponen aktual dalam DOM sintetis, bukan sesi sekolah melalui browser. Bukti login UI online dan pengiriman email tetap terpisah.

## Verifikasi produksi dan pemulihan

- Native database: kedua penugasan ada, peran global tetap learner/teacher. Adi memperoleh konteks curriculum, Asep tetap member sampai sandi awal diganti. Pemilik admin tetap diizinkan Studio; staf tidak. Pemeriksaan hak dilakukan dengan aktor database dalam transaksi yang di-rollback, tanpa keputusan/email operasional.
- Hak panggil seluruh lima implementasi internal ditolak untuk anon/authenticated/service_role. Pemanggilan helper Studio anonim ditolak.
- Curriculum versi `4be2e0a2-3a1b-4e2a-a0e8-418c3608a2fd`, sebelumnya `da9039f2-deb9-43b3-a5c7-92d7a9a6fe5c`. Halaman staf/admin/buku penuh/monitoring mengalihkan tamu ke akun. Kalender A4 dan halaman buku/program tetap cocok dengan paket rilis.
- Pemeriksaan online: 13 hash cocok, delapan gerbang anonim sesuai, flag login/klinik/sekolah tetap aktif. Receipt privat `live-check.json`; versi Studio akhir dicatat dalam receipt monorepo.
- Paket pertama Curriculum ditolak validasi Cloudflare karena modul buku belum ikut paket; tidak sempat aktif. Pengemasan diperbaiki dan semua impor diperiksa sebelum unggah ulang. Paket Studio akhir mempertahankan fitur Khazanah/Academy yang sudah tayang sebelumnya.
- Advisor Supabase menandai fungsi definer yang sengaja tersedia melalui wrapper dengan pemeriksaan peran; implementasi internal tetap tertutup. Tidak ada tabel/policy baru pada migrasi ini. Temuan umum di luar lingkup tidak diubah.

Jika perlu pemulihan, cabut dua penugasan staf atau pulihkan Worker ke versi sebelum rilis, lalu pulihkan definisi fungsi dari `database-before.json` hanya bersama kontrak frontend yang sesuai. Jangan hapus ajuan/jurnal/receipt. Pembatasan Studio tidak menghapus role guru dari layanan lain. Login interaktif memakai akun sekolah dan pengiriman email nyata belum diuji pada rilis ini.
