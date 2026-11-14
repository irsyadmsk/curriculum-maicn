# Redesign Curriculum — 3 November 2026

Pemilik meminta redesign keseluruhan, lalu langsung deploy. Izin ini mencakup penayangan perubahan lokal admin/SSO sebelumnya. Tidak ada migrasi database, commit/push, atau pengiriman email manual.

Palet baru: latar #f3f5f9, panel putih, teks #17243b, teks sekunder #526078, aksen #2456b8, navigasi #142238. Tema gelap memiliki pasangan token sendiri. UI/UX Pro Max dipakai untuk arah minimal, grid, kontras, dan hierarki; pola hero pemasaran dari hasil pencarian tidak dipakai untuk dashboard akademik. Font yang sudah ada dipertahankan agar tidak menambah unduhan.

Perubahan meliputi navigasi, topbar, kartu beranda, shortcut guru, klinik, formulir, tab pengelolaan, daftar ajuan, panel keputusan, tabel peserta, bantuan, dan navigasi HP. Status keputusan mempertahankan warna semantik. Token lama hijau sebagai warna utama diganti; aturan warna dan kontrol eksplisit dari perbaikan admin dipertahankan.

Build berhasil: 132 aset terkurasi, versi aset `984b2292c5ac`. Wrangler berhasil mengunggah dan mengaktifkan Worker `curriculum-maicn` pada `curriculum.irsyads.com`, versi `bfc4107d-40a9-4cb6-b8d2-0d7460ffd8f1`.

Validasi terbatas pada peninjauan kode, sintaks Worker, build CSS/JS/HTML, dan receipt deploy. Pengujian visual/interaksi serta keputusan admin asli diserahkan kepada pemilik sesuai arahannya. Keberhasilan deploy bukan bukti bahwa semua skenario bisnis telah diuji.
