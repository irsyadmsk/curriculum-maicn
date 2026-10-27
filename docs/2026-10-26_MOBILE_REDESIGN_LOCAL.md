# Redesign Curriculum — 26 Oktober 2026

Kandidat lokal atas permintaan pemilik untuk redesign total dengan prioritas HP. Tidak ada commit, push, deploy, perubahan database, pengiriman formulir, atau pembelian layanan. Pekerjaan lokal yang sudah ada dipertahankan; keseluruhan diff Git bukan hasil sesi ini.

## Hasil

- Beranda dibangun ulang: pengantar singkat, ringkasan kalender dan jadwal dari `MASTER_DATA`, pemilihan kelas/hari, agenda berikutnya, pencarian direktori 21 pengampu, perangkat ajar, dan pintu ekosistem. Grafik kehadiran dan notifikasi berangka statis dari beranda lama dihapus. Tidak menulis ulang presensi/jurnal tersimpan.
- Shell konsisten pada 12 halaman: index, jadwal, kalender, klinik, buku kerja, rapor, KOM, P5-PPRA, asesmen, unggulan, struktur, admin. Navigasi dikelompokkan, ikon SVG seragam, sidebar desktop bisa diciutkan, drawer dan lima tujuan navigasi bawah tersedia pada layar kecil. Dua halaman pengalihan (`modul.html` dan `profil.html`) tidak diubah.
- Jadwal HP menggunakan kartu per JP yang membaca tabel yang sudah dirender. Pergantian kelas/hari memperbarui kartu; tombol tindakan meneruskan ke handler asli. Pengguna dapat memilih Kartu/Tabel. Enam bagian jadwal menjadi pemilih ringkas di HP. Tabel lebar tetap memiliki wadah gulir tersendiri.
- Pencarian halaman membuka dialog native dengan hasil nyata, status kosong, pintasan Ctrl/Cmd K dan `/`. Drawer dan dialog lama mendukung isolasi latar, perangkap fokus, Escape, dan pengembalian fokus.
- Token, panel, formulir, tabel dan tombol diseragamkan; mode terang/gelap, safe area, focus-visible, dan reduced motion tersedia. Pintu ekosistem di jadwal/kalender dipindahkan setelah konten utama. Salinan status Drive yang mengaku sinkron otomatis diperbaiki menjadi belum tersambung.

## Berkas

Lapisan presentasi baru: `assets/curriculum-ui.css` dan `assets/curriculum-ui.js`. Semua halaman di atas memuat keduanya. `assets/dashboard-clay.js` hanya disesuaikan untuk breakpoint 1024 px dan label tombol collapse. Ekspor bersama di `assets/irsyads-v1/` tidak diedit.

Seluruh blok inline JavaScript akademik/auth pada halaman selain beranda dibandingkan dengan salinan awal sesi dan identik. `assets/app.js`, `assets/curriculum-data.js`, `data.js`, `master-data.json`, template DOCX, autentikasi dan handler simpan tidak diedit dalam sesi ini.

Salinan awal halaman dan berkas pendukung tersimpan di `%TEMP%/curriculum-redesign-20261026/`. Ini salinan dirty work saat awal sesi, bukan checkout HEAD; jangan mengganti seluruh worktree dengan HEAD untuk rollback.

## Pemeriksaan

- `node --test tests/*.test.mjs`: **33 lulus, 0 gagal**. Empat pengujian proyeksi baru memeriksa seluruh kombinasi hari/kelas, batas penggabungan JP dan identitas pengampu, agenda acara akhir pekan, serta tanggal Jakarta. Tes lama yang mensyaratkan kaktus/grafik statis diganti; pemeriksaan direktori diarahkan ke modul UI tempat fungsinya dipindahkan.
- Syntax kedua berkas JS yang dikerjakan lulus. Pemeriksaan whitespace untuk delta sesi terhadap salinan awal lulus. `git diff --check` terhadap HEAD masih melaporkan whitespace lama dalam skrip dirty work; bagian tersebut dipertahankan identik.
- **48 pemeriksaan layout browser lokal**: 12 halaman × viewport CSS 320, 390, 768, 1366 px, tanpa page overflow dan tanpa elemen konten melebar pada keadaan awal. Bukti: `redesign-20261026/layout-results.json`. Scrollbar desktop di iframe mengurangi lebar konten 15 px pada viewport kecil; ini pemeriksaan viewport browser, bukan emulasi perangkat fisik.
- Interaksi browser: drawer membuka dan mengisolasi konten, Escape mengembalikan fokus; pencarian “buku” membuka Buku Kerja; pencarian “sosiologi” menghasilkan 1 dari 21 guru dan kata yang tak cocok menghasilkan keadaan kosong; kartu jadwal X-2/Rabu memperbarui mapel; tindakan kartu membuka izin dengan guru/hari/kelas yang sesuai; Shift Tab berputar dalam dialog izin dan Escape kembali ke pemicu; tautan `jadwal.html#tab-presensi` mengaktifkan tab yang benar.
- Tema gelap diuji melalui kontrol tema asli. Kontras heading dan posisi panel ekosistem desktop diperbaiki dan diperiksa ulang. Screenshot terang, gelap, beranda HP dan kartu jadwal ada di `redesign-20261026/evidence/`.

Ini bukti presentasi dan interaksi lokal. Tidak menguji kirim/simpan ke backend, akun native, cetak fisik, akses Drive, seluruh kombinasi tab/filter/dialog, audit WCAG penuh, RTL native, maupun perangkat HP fisik. Data contoh/label status yang sudah ada pada halaman akademik lain bukan bukti keadaan sekolah saat ini.

## Pratinjau

Server sesi: `python -m http.server 4570 --bind 127.0.0.1`, dari root repo.

- Beranda: http://127.0.0.1:4570/index.html
- Jadwal: http://127.0.0.1:4570/jadwal.html
- Pembanding viewport HP: http://127.0.0.1:4570/scratch/redesign-20261026/preview.html?width=390
- Audit layout dapat diulang melalui `preview.html?sweep=1`; helper ini hanya untuk pengujian lokal.

Belum ada izin rilis baru yang digunakan. Tinjauan pemilik terhadap hasil visual dan perangkat nyata tetap terpisah dari hasil pemeriksaan lokal.
