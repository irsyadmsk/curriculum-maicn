# Fondasi Irsyads v1 — kandidat lokal 2 Oktober 2026

Source ini dikonfirmasi pemilik untuk Curriculum. Index memuat Firebase; admin/jadwal serta `assets/curriculum-data.js` memakai Supabase. Penyesuaian desain tidak memigrasikan backend, skema, data, login atau dokumen akademik.

Tujuh halaman memakai `assets/irsyads-v1` hasil ekspor `irsyads/packages/design-tokens/standalone/v1`. Jalankan `npm run design:export` di repo pusat lalu salin ulang hasilnya ketika sumber berubah; jangan mengedit hasil ekspor secara terpisah. `assets/ecosystem.css` memetakan token lama ke token bersama. `assets/ecosystem.js` menambahkan Tampilan dan peluncur yang membaca registry; runtime preferensi berada di head sebelum halaman tampil.

Tema system/light/dark dan enam palet memakai preferensi nonrahasia lintas subdomain. Isi tetap Indonesia; tautan kembali mempertahankan bahasa pusat. Token login tidak dibagikan oleh adapter. Native TV/Wallet berada di repo lain.

Verifikasi lokal: syntax JS dan `git diff --check` lulus. Tujuh halaman pada 320/1280 px (14 pemeriksaan) lulus tema/palet, font, peluncur dan gulir halaman tanpa pageerror. Tab Jadwal memiliki gulir tersendiri; kartu Struktur muat pada mobile; tabel tetap digulir di wadahnya. Footer/menu mengikuti tema. Akun admin, simpan data, RLS, perangkat nyata dan produksi belum diuji. Belum commit/push/deploy.
