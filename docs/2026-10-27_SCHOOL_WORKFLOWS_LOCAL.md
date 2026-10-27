# Layanan akademik dan jurnal — 27 Oktober 2026

**Pembaruan:** sudah tayang atas instruksi pemilik. Lihat [catatan rilis online](2026-10-27_ACADEMIC_SERVICES_RELEASE.md). Uraian di bawah adalah riwayat tahap lokal sebelum rilis; flag dan batas bukti saat rilis dijelaskan pada catatan terbaru.

Status: implementasi lokal di Curriculum dan sibling `../irsyads` (Studio). Belum commit, push, deploy, memasang SQL produksi, membuat akun baru, atau mengirim email nyata. Pekerjaan Klinik sebelumnya dirinci di `2026-10-27_CLINIC_INTAKE_LOCAL.md`; pertahankan seluruh perubahan lain di kedua checkout.

## Aturan pemilik

- **Piket: dua guru setiap hari; tidak ada rotasi ganjil/genap.** Sepuluh nama dan hari asal dipertahankan. Label sumber yang salah di `data.js` dan `master-data.json` dikoreksi menjadi Piket harian. Kedua guru yang terjadwal hari itu, serta admin, boleh mengisi jurnal piket.
- Switch memilih dua blok jadwal resmi dengan kelas dan jumlah JP sama, guru berbeda, dalam minggu yang sama. Kurikulum menerima atau menolak. Setelah diterima, perubahan tampil pada beranda dan proyeksi jadwal hanya untuk minggu tersebut; jadwal dasar tidak diubah dan minggu berikutnya kembali biasa. Server memeriksa bentrok guru dan pemakaian blok.
- Proyek kokurikuler memuat mapel pengusul dan TP. Proyek terbit setelah diterima. Mapel lain mengajukan TP terkait sebagai kolaborasi; setiap kolaborasi membutuhkan keputusan tersendiri. Beranda menampilkan mapel utama dan semua kolaborator yang diterima, termasuk lebih dari dua mapel.
- Remedial wajib login dengan akun sekolah melalui SSO yang sudah ada. Murid hanya mengajukan identitasnya sendiri setelah akun ditautkan ke roster. Ajuan murid perlu penetapan guru pengampu yang sesuai saat diterima. Jadwal yang disetujui tampil di beranda tanpa nilai atau daftar peserta remedial.
- Dispensasi/izin KBM bisa sehari penuh atau pada jam tertentu, dengan peserta dari roster. Yang disetujui tampil pada tanggal terkait; alasan pribadi, email, dan bukti tidak diterbitkan di beranda.
- Jurnal kelas hanya untuk admin atau wali kelas/ketua kelas yang ditetapkan untuk kelas dan tanggal tersebut. Jurnal piket hanya untuk admin atau guru yang bertugas hari itu. Login dan pemeriksaan kewenangan server wajib; pilihan peran di browser tidak memberi hak.
- Admin menautkan akun Studio yang sudah ada ke murid serta menetapkan wali/ketua dengan rentang tanggal. Tidak ada pembuatan akun atau pencocokan identitas berdasarkan nama yang mirip.
- Arsip admin disaring berdasarkan tanggal/jenis/kelas dan diekspor menjadi DOCX/XLSX asli berformat cetak A4. Ekspor membaca snapshot server terbaru; batas 100 jurnal harus dipersempit secara eksplisit, tidak dipotong diam-diam.

## Komponen

- Publik: `layanan.html`, `jurnal.html`, `assets/school-{services,journals,home,workflows.css}` dan tautan di beranda/jadwal/kokurikuler/Klinik. Handler lama pengajuan switch/izin/jurnal piket mengarah ke alur baru dan tidak lagi menyetujui data browser.
- Bersama: `school-workflow-core.mjs`, `school-client.mjs`, `school-admin.mjs`, `school-journal-export.mjs`. Salinan paket Studio berada di `../irsyads/packages/curriculum-clinic/` dan masuk allowlist eksportir paket.
- Studio: `SchoolReview.tsx`, CSS pendamping dan ruang layanan akademik pada `CurriculumWorkspace.tsx`. Sesi pemilik diperiksa sebelum dan sesudah RPC; komponen membatalkan permintaan saat dilepas.
- Worker: `/api/school/request`, `/api/school/rpc`, `/api/school/receipt`; daftar RPC dibatasi sesuai kemampuan akun, lalu SQL memeriksa kembali. Tamu menggunakan Turnstile terikat hostname/action. Bukti pengiriman rahasia memungkinkan status ajuan tamu dilihat tanpa daftar ajuan publik.
- Kandidat SQL: `server/school-workflows.sql` dan `server/school-notifications.sql`. Tabel privat/RLS tanpa akses langsung publik. Keputusan dan jurnal memakai revisi serta token idempotensi. Jurnal memiliki riwayat perubahan; konflik versi tidak ditimpa diam-diam.
- Notifikasi guru: template terima/tolak di `server/clinic-email.mjs`, pengirim `Curriculum Irsyads <noreply@irsyads.com>`. Tidak ada email keputusan untuk ajuan murid. Antrean terpisah memiliki lease, idempotensi, batas percobaan dan status superseded. Provider menerima permintaan tidak membuktikan email masuk kotak penerima.

## Sumber dan aktivasi

`scripts/prepare-school-source.mjs` menghasilkan `private-inputs/school-source.sql` berisi 81 blok pelajaran yang dapat dipertukarkan dan 10 penugasan piket. Katalog bergabung hanya melalui nama lengkap yang cocok tepat; nama ambigu/tidak cocok menghentikan pembuatan. Sumber setelah koreksi piket memiliki SHA-256 `903a56ecb6579bc01d14d9f0a4d2ad064c11a7b3bb78766e8669813421279b32`. Sumber privat dan data murid tidak masuk aset situs. Workbook murid resmi tidak diubah.

Urutan kandidat setelah migrasi Klinik dasar yang sudah ada: `clinic-intake-v2.sql`, `clinic-allocation.sql`, `school-workflows.sql`, `school-notifications.sql`, lalu seed roster dan jadwal privat yang ditinjau. Ini catatan dependensi, bukan perintah menjalankan ke produksi. Periksa bentuk database aktual, katalog guru, akun aktif, binding murid, penugasan kelas, domain email dan cadangan sebelum rilis yang diotorisasi.

`CLINIC_V2_ENABLED`, `CLINIC_EMAIL_ENABLED`, `SCHOOL_ENABLED`, `SCHOOL_EMAIL_ENABLED` tetap **false** di `wrangler.jsonc`. Integrasi akun menggunakan bridge SSO `id.irsyads.com` yang sudah ada. Akun guru/murid asli, Auth/PostgREST asli, kebijakan database produksi dan pengiriman provider belum diuji. Rilis Studio, Worker dan migrasi perlu diselaraskan; jangan mengaktifkan flag lebih awal. Bila perlu menghentikan alur, tahan flag/pengiriman; jangan menghapus riwayat atau antrean.

## Bukti pemeriksaan

- Build terakhir: 96 aset terkurasi. TypeScript terarah: lima root Studio, nol diagnostic termasuk sumber yang diimpor.
- Tes fitur root: tujuh lulus; suite terkait akses/SSO/jadwal juga lulus. Suite root keseluruhan terakhir 82/83 lulus; satu kegagalan lama di `tests/max-ui-ux.test.mjs` mengharapkan klaim Tahfidz 30 Juz pada `unggulan.html` yang tidak diubah.
- Tes sibling `tests/school-workflows.test.mjs`: skenario PGlite lulus setelah perubahan terakhir. Meliputi switch/rollback/bentrok/kedaluwarsa minggu, proyek tiga mapel, remedial dan identitas murid, publikasi tanpa alasan pribadi, otorisasi jurnal bertanggal, revisi usang, pencabutan akses, penautan akun dan antrean/receipt rahasia. Bukti ini memakai SQL kandidat nyata dengan akun/data sintetis, bukan Postgres multi-koneksi atau Supabase produksi.
- Chrome headless: delapan alur melewati formulir, Worker, SQL kandidat, ruang keputusan dan beranda; enam pemeriksaan tampilan pada 390/1366 px, tanpa overflow atau galat JavaScript. Rincian lokal di `scratch/school-browser/results.json`. Auth dan Turnstile merupakan fixture lokal; fetch ke layanan asli diblokir.
- DOCX dibaca dengan python-docx dan dicetak melalui Microsoft Word lokal ke PDF dua halaman A4; kedua halaman diperiksa visual tanpa kliping. XLSX dibaca openpyxl dan dipratinjau dengan artifact-tool; A4 portrait/fit-width, teks bungkus dan pemisah halaman terpasang. Rumus yang tampak seperti teks tetap literal. Belum diuji melalui printer fisik atau aplikasi Excel asli.

## Pratinjau lokal

`node scripts/build-site.mjs`, kemudian `node scripts/preview-school-workflows.mjs`. Buka `http://127.0.0.1:4580/layanan.html`, `/jurnal.html`, `/index.html`, dan `/__fixture/review`. Pemilih akun contoh tersedia di `/__fixture/role/admin`, `/teacher`, `/leader`, `/student`, `/unlinked`, `/guest`. Semua identitas/data contoh dan database hanya dalam RAM. Server hanya loopback dan menolak host lain serta akses eksternal; jangan merilis server fixture. Preview Klinik lama port 4576 dipertahankan.
