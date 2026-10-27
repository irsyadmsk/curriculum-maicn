# Klinik dapat diklik dan daftar murid — 26 Oktober 2026

Permintaan pemilik: perbaiki Klinik yang tidak bisa diklik dan masukkan daftar murid dari `Rev_Sebaran_Kelas_X1-X3_v2.xlsx`. Pekerjaan ini lokal dan belum dirilis. Tidak ada commit/push, SQL, perubahan backend, pengiriman formulir atau penggantian data sekolah di server.

## Bug klik

Bug diperkenalkan pada adaptor dialog saat redesign sebelumnya. Dialog kalender tertutup tetap memakai `display:flex`, `opacity:0` dan `pointer-events:none`. Adaptor menganggap elemen tersebut terbuka dan memberi `inert` pada konten halaman. Hasilnya navigasi terlihat tetapi tidak dapat diklik.

`assets/curriculum-ui.js` kini mensyaratkan state aplikasi eksplisit (`active`, `open`, `show`) sebelum mengisolasi latar. CSS juga menyembunyikan visibilitas `.modal-overlay` yang tidak aktif. Browser diverifikasi dari Kalender → Klinik, kemudian membuka dan menutup formulir booking; tidak ada formulir dikirim. Tes regresi mencakup overlay transparan yang masih `display:flex`.

## Data murid

- Lembar X-1: **19** murid, X-2: **19**, X-3: **19**. Nama dan urutan 57 murid cocok persis dengan sel B5:B23 pada ketiga lembar.
- **Faza Nabihan** disimpan sebagai belum ditempatkan, sesuai jawaban eksplisit pemilik. Total daftar 58; Faza tidak dimasukkan ke salah satu kelas.
- Hanya nama, kelas, nomor urut sumber, ID teknis stabil dan referensi sel yang dimasukkan. NIS/NISN tidak ada pada sumber dan tetap null. Nilai ujian, peringkat, serta catatan pribadi penempatan tidak disalin dan tidak dipakai sebagai nilai semester atau untuk mengatur ulang kelas.
- Workbook sumber tidak diedit. SHA-256 sebelum/sesudah cocok: `4aae60c0dd2e36161f7715ffbd57786656ab96a0d13a390adeaa765c917346da`.

`scripts/import-student-roster.py` membaca workbook dengan openpyxl secara read-only melalui Python bundled. Hasilnya `assets/student-roster-data.js`; fungsi pemakai bersama berada di `assets/student-roster.js`. ID teknis berbasis nama dan tahun, bukan nomor induk rekaan; duplikat ditolak saat impor. Sumber bukan instruksi untuk melakukan perangkingan baru.

## Pemakaian

- `murid.html`: direktori dengan pencarian nama, filter kelas, hitungan tiap kelas dan kelompok belum ditempatkan. Menu Data Murid ditambahkan pada shell halaman; beranda menampilkan 57 murid dalam kelas.
- `jadwal.html`: roster presensi memakai sumber yang sama. Identitas input menggunakan ID teknis sehingga NISN kosong tidak membuat radio antar murid berbenturan. Status awal tidak otomatis Hadir; semua murid perlu dipilih sebelum simpan. Seeding riwayat contoh baru dihapus; riwayat yang sudah tersimpan tidak dihapus.
- `p5-ppra.html`: formulir observasi dan mutabaah memakai pilihan nama sesuai kelas. Nilai awal catatan contoh tidak lagi dibuat otomatis. Catatan yang sudah tersimpan tetap dipertahankan dan tidak dipindahkan ke murid lain. Kutip font pada skrip mutabaah lama yang membuat parser gagal juga diperbaiki; kedua formulir terbukti dapat membuka pilihan murid.
- `rapor.html` dan `assets/report-roster.js`: memakai nama asli tanpa membuat nilai default 80–90, NIS/NISN, atau penunjukan wali kelas rekaan. Nilai belum lengkap tampil kosong/—, tanpa rank, keputusan remedial atau narasi capaian rekaan. Nol tetap sah. Namespace nilai baru terikat tahun, semester, kelas dan mapel serta memakai ID murid stabil. Seluruh simpanan dengan key numerik lama tetap ada dan tidak otomatis diadopsi sebagai nilai murid baru. LHB menampilkan nilai mapel yang benar-benar tersedia pada namespace baru; bukan nilai contoh lintas mapel.

Tidak ada perubahan `data.js`, `master-data.json`, `assets/app.js`, `assets/curriculum-data.js`, Auth/roles atau ekspor navigasi bersama dalam batch ini. Salinan awal berkas yang dikerjakan ada di `%TEMP%/curriculum-students-20261026/`. Worktree sebelumnya sudah dirty; jangan menganggap seluruh diff merupakan batch ini.

## Pemeriksaan

- **39 tes lulus**, 0 gagal: seluruh `tests/*.test.mjs`. Tambahan pemeriksaan mencakup blocker dialog, 57+1 murid dan NISN kosong, identitas presensi unik, parse skrip P5, nilai kosong/nol, serta pemisahan simpanan lama dan semester.
- Syntax JS baru/diubah serta seluruh blok inline empat halaman integrasi lulus.
- Nama dan urutan di source JS dibandingkan kembali secara independen dengan workbook; 57/57 cocok, hash sumber tidak berubah.
- **24 pemeriksaan layout**: enam halaman terkait × 320/390/768/1366 CSS px, tanpa page overflow, elemen konten melebar atau konten utama berstatus inert saat tidak ada dialog terbuka. Hasil di `roster-20261026/layout-results.json`.
- Browser native: filter ketiga kelas menghasilkan 19 nama masing-masing, filter pending menghasilkan Faza; rapor awal 19 baris dan 114 input nilai kosong; P5 observasi X-2 berisi 19 pilihan dan mutabaah X-3 berisi 19 pilihan. Kalender → Klinik dan tombol booking berfungsi.
- Screenshot direktori desktop/HP dan booking berada di `roster-20261026/evidence/`. Ini verifikasi browser lokal, bukan penerimaan backend/native Auth, printer, perangkat HP fisik, atau rilis. Data tersimpan lama tidak dimigrasikan atau dihapus.

## Pratinjau

- Data murid: http://127.0.0.1:4570/murid.html
- Klinik: http://127.0.0.1:4570/klinik.html
- Rapor: http://127.0.0.1:4570/rapor.html

Server loopback yang sudah berjalan tetap dipakai. Tidak ada rilis atau izin produksi baru yang digunakan.
