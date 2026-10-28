# Ruang staf Curriculum dan pembatasan Studio

28 Oktober 2026, WIB. Pemilik meminta Adi Suprihadi dan Asep Jafar menjadi staf kurikulum untuk persetujuan klinik/switch melalui Curriculum. Klarifikasi terakhir: **Studio hanya admin dan asisten**, bukan admin saja. Paket ini sudah disiapkan dan diuji; belum dirilis atau memberikan penugasan akun produksi.

## Pembagian akses

- `kurikulum.html`: hanya admin/staf kurikulum yang ditugaskan pada institusi. Persetujuan Klinik memakai komponen bersama Studio melalui proxy Worker origin yang sama: alokasi bentrok per nama, pengecualian kelas, konfirmasi, revisi dan receipt tetap dipertahankan. Persetujuan switch memakai aturan kelas/JP/minggu dan konfirmasi yang sama.
- Staf hanya mendapat review klinik dan switch. Keputusan proyek/kolaborasi/remedial/dispensasi, pengelolaan akun, serta perubahan blok Senin tetap admin. Pembacaan jurnal staf dibatasi oleh penugasan jurnal sebenarnya; penugasan staf tidak memberi akses arsip seluruh guru.
- Halaman admin lama Curriculum tetap admin. Data/nilai guru memerlukan tautan pengampu yang sah; staf tanpa tautan guru tidak mendapat akses itu otomatis.
- Studio: Worker memvalidasi token SSO asli dan `studio_workspace_access()` sebelum mengirim shell. Hanya admin atau akun berperan `assistant` yang aktif dan sudah menyelesaikan ganti sandi dapat masuk. Metadata browser/cookie peran bukan otorisasi. Komponen Studio juga membatasi ke admin/asisten. Aset JS/CSS publik berisi kode, bukan data akun; RLS/RPC layanan tetap melindungi data yang juga dipakai Academy/Curriculum.
- Tidak ada perubahan peran global dua staf menjadi admin/asisten. Akun Asep masih `must_change_password=true`, sehingga wajib menyelesaikan sandi awal sebelum dapat memakai hak staf. Sandi tidak diubah atau dibuka oleh pekerjaan ini.

## Komponen

`assets/curriculum-review.mjs`, `kurikulum.html`, modul UI bersama `assets/clinic-review-ui.{js,css}`, serta opsi `reviewOnly/allowedKinds` pada `school-admin.mjs`. Bundel Klinik dihasilkan dari `../irsyads/scripts/export-curriculum-review.mjs` dan entry/proxy paket bersama; jangan menyunting bundel secara manual. Tautan publik klinik menuju Curriculum, bukan Studio.

Kandidat `server/curriculum-staff.sql` dan migrasi bernama `curriculum_staff_workspace` membatasi pembacaan/keputusan pada SQL. Fungsi lama dipertahankan sebagai implementasi internal tanpa hak panggil anon/authenticated/service_role; wrapper terotorisasi tetap menjaga kontrak/revisi. Data ajuan/jurnal tidak dihapus. Kandidat penugasan dua akun terverifikasi tersimpan privat di `.codex/releases/curriculum-staff-20261028/staff-grant.sql` dan memeriksa ID, nama serta status sebelum insert idempoten.

Worker Studio berada di `../irsyads/apps/studio/src/worker.mjs`, menggunakan cookie SSO induk yang sama, memeriksa Auth dan RPC pada server, tanpa kredensial service. Kunci publishable pada konfigurasi memang publik. Respons shell/gagal tanpa cache. Pekerjaan lain yang dirty ditahan pada HEAD saat build Studio.

## Bukti

- 38 tes terarah Curriculum lulus (gateway, Klinik, SSO, jadwal, kalender A4).
- 19 tes komponen Studio/Worker/UI switch lulus, ditambah skenario SQL PGlite untuk staf, penolakan akses lain, ganti sandi dan admin/asisten.
- TypeScript tujuh root terkait tanpa diagnostic; Studio dua halaman berhasil dibangun. Curriculum 109 aset terkurasi.
- Simulasi kandidat dan dua penugasan pada database asli dilakukan dalam transaksi yang di-rollback: konteks Adi curriculum/Studio ditolak; Asep tetap member karena sandi awal; akun admin pemilik tetap lolos; review non-switch/admin ditolak. Tidak ada keputusan operasional/email yang dibuat.
- UI diperiksa dengan komponen aktual dalam DOM sintetis, bukan sesi sekolah melalui browser. Bukti login UI online dan pengiriman email tetap terpisah.

## Urutan aktivasi setelah izin rilis

Pasang migrasi scoped; pasang Worker/paket Studio dan Curriculum yang kompatibel; jalankan grant privat dua akun; baca kembali konteks dan hak; cocokkan hash berkas serta gerbang anonim. Simpan versi sebelum rilis dan receipt. Jika harus menahan, cabut penugasan staf atau pulihkan Worker sebelum rilis; jangan hapus ajuan/jurnal/receipt. Untuk membatalkan perubahan fungsi, pulihkan definisi dari snapshot privat dan kontrak frontend yang sesuai. Pembatasan Studio tidak menghapus role guru dari layanan lain.
