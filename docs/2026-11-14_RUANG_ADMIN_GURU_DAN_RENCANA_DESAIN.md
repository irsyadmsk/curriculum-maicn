# Ruang admin, ruang guru, dan rencana perbaikan desain — 14 November 2026

Status: **migrasi terpasang, menunggu deploy.** Atas persetujuan pemilik (14 November 2026), `server/curriculum-room.sql` dipasang ke produksi sebagai migrasi `curriculum_room_workspace` dan `ROOM_ENABLED` diubah menjadi `"true"` di `wrangler.jsonc`. Worker yang tayang baru memakai flag ini setelah PR digabung ke `main` dan di-deploy oleh pemilik.

Verifikasi pascamigrasi: empat tabel privat ber-RLS tanpa hak baca `anon`/`authenticated`; lima fungsi publik hanya dapat dijalankan `authenticated`; `private.curriculum_akg_items()` tertutup. Tidak ada tabel, fungsi, atau data lama yang diubah.

## Pembaruan 14 November 2026 (malam): satu ruang

Setelah digabung dengan pekerjaan lokal, ternyata Ruang kurikulum (`kurikulum.html`) sudah memuat persetujuan klinik, ajuan akademik, pengumuman, dan pengaturan. Halaman Ruang admin terpisah membuat dua tempat untuk hal yang sama, sehingga:

- `ruang-admin.html` dihapus; alamat lamanya dialihkan ke `kurikulum.html#analysis`.
- Analisis, Catatan guru, dan Supervisi AKG menjadi kelompok **Pembinaan guru** di Ruang kurikulum (khusus admin).
- Navigasi Ruang kurikulum menjadi dua tingkat: empat tombol kelompok (Harian, Persetujuan, Pembinaan guru, Pengaturan), lalu tab bergaris bawah untuk bagiannya. Sebelas tab sebaris tidak lagi berjejal.
- Menu sisi: tautan polos di dasar menu diganti kelompok **Ruang kerja** berikon di bagian atas (Layanan & pengajuan, Ruang guru, Ruang kurikulum).
- Gaya tombol global situs menimpa tombol ruang sehingga tombol utama dan berbahaya tampak sama putihnya; hierarki ditegaskan ulang (utama gelap terisi, sekunder bergaris, berbahaya merah, pilihan aktif gelap).
- "Menunggu keputusan" hanya menghitung ajuan yang tanggalnya belum lewat; yang terlewat tanpa keputusan disebut terpisah (migrasi `curriculum_room_summary_upcoming_pending`).

Bagian di bawah ini adalah riwayat rancangan awal; nama tab dan alamat Ruang admin di dalamnya sudah tidak berlaku.

## 1. Temuan sebelum perubahan

| Temuan | Bukti | Akibat |
|---|---|---|
| Persetujuan dan arsip diarahkan ke Studio | Tautan `studio.irsyads.com/?school=review` pada `school-services.mjs` dan `school-journals.mjs` | Komponen kurikulum tidak berada di satu tempat |
| Tab Supervisi, Jurnal, Izin & Switch, Kurasi Klinik pada `admin.html` hanya menyimpan ke `localStorage` dan diisi data contoh | `maicn_admin_supervisi` dan sejenisnya | Data tampak nyata padahal tidak tersimpan di server dan tidak terbaca perangkat lain |
| Catatan harian guru dan supervisi belum punya penyimpanan server | Tidak ada tabel maupun RPC | Tidak dapat dianalisis |
| Sakit tidak dibedakan dari izin dan dispensasi | Satu jenis `absence` | Rekap ketidakhadiran tidak dapat dipilah |
| Tombol tab aktif tidak berbeda dari yang tidak aktif | `.school-tabs button[aria-pressed=true]` tanpa gaya | Pengguna tidak tahu sedang berada di tab mana |
| Tidak ada ringkasan lintas layanan | — | Admin membuka tiap halaman untuk mengetahui keadaan |

## 2. Yang dibangun

**Ruang admin (`ruang-admin.html`, khusus admin).** Enam tab: Ringkasan (analisis), Klinik, Ajuan & jurnal (switch, remedial, sakit/izin/dispensasi, proyek, kolaborasi, arsip jurnal, penugasan akun), Catatan guru (baca, saring, unduh CSV), Supervisi AKG (jadwal, instrumen, hasil, cetak A4), Data & buku. Tab Klinik dan Ajuan memakai komponen persetujuan yang sudah tayang, tanpa mengubah aturannya.

**Ruang guru (`ruang-guru.html`, akun guru yang tertaut ke pengampu).** Catatan harian (satu per hari, dapat diperbarui sampai 14 hari ke belakang, draf otomatis di perangkat), Supervisi saya (jadwal, hasil per ranah, tanda terima), dan peluncur layanan.

**Peluncur layanan (`layanan.html`).** Semua pintu dalam satu kisi: Ajukan (switch, remedial, klinik, sakit/izin/dispensasi, proyek), Catat (catatan guru, jurnal kelas dan piket, supervisi saya), Kelola (ruang persetujuan, ruang admin). Kartu yang tampil mengikuti akun.

**Kategori ketidakhadiran.** Formulir dispensasi kini meminta jenis: sakit, izin, atau dispensasi kegiatan. Kategori disimpan pada `body.category` dan diawalkan pada judul sehingga terbaca di daftar tinjau. Beranda publik tetap hanya menampilkan "Dispensasi / izin KBM"; alasan dan jenis sakit tidak dipublikasikan.

**Halaman admin lama.** Empat tab semu diganti tautan ke Ruang admin; data master (kalender, jadwal, guru) tetap.

### Instrumen supervisi AKG versi 1

"AKG" ditafsirkan sebagai **Asesmen Kompetensi Guru**: 18 butir pada empat ranah kompetensi (pedagogik 6, kepribadian 4, sosial 3, profesional 5), skala 1–4. Nilai = jumlah skor ÷ (18 × 4) × 100, dihitung ulang oleh server. Sebutan: 91–100 amat baik, 76–90 baik, 61–75 cukup, 51–60 sedang, ≤50 kurang.

Dasar: UU No. 14 Tahun 2005 tentang Guru dan Dosen Pasal 10 ayat (1) (empat kompetensi guru); Permendiknas No. 16 Tahun 2007 tentang Standar Kualifikasi Akademik dan Kompetensi Guru; Permenneg PAN dan RB No. 16 Tahun 2009 tentang Jabatan Fungsional Guru dan Angka Kreditnya (konversi nilai kinerja); Permendiknas No. 13 Tahun 2007 dan PMA No. 58 Tahun 2017 (supervisi sebagai tugas kepala madrasah).

**Perlu konfirmasi pemilik:** bila madrasah memakai format AKG lain (butir atau skala berbeda), ubah `AKG_DOMAINS` di `assets/room-core.mjs` dan `private.curriculum_akg_items()` di `server/curriculum-room.sql`; tes menjaga keduanya tetap sama.

## 3. Arsitektur dan akses

| Lapisan | Berkas | Aturan |
|---|---|---|
| Halaman | `ruang-admin.html`, `ruang-guru.html` | Worker mengirim berkas hanya kepada admin / guru; selain itu dialihkan ke `akun.html`. Tanpa cache, `noindex` |
| Worker | `/api/room/rpc` di `server/worker.mjs`, aturan di `assets/room-core.mjs` | Daftar izin RPC per tindakan; asal permintaan harus sama; flag `ROOM_ENABLED` |
| SQL | `server/curriculum-room.sql` | Empat tabel privat ber-RLS tanpa akses langsung; lima fungsi `security definer` yang memeriksa ulang peran, kepemilikan, revisi, dan token idempotensi |
| Tampilan | `assets/room-{ui,admin,teacher,client}.mjs`, `room.css`, `service-hub.mjs` | Menu tersembunyi bukan otorisasi |

Pembagian hak: catatan harian ditulis hanya oleh guru tertaut untuk dirinya; dibaca guru itu dan admin. Supervisi direncanakan dan dinilai hanya oleh admin; guru membaca miliknya yang tidak batal dan memberi tanda terima satu kali. Ringkasan hanya untuk admin. Staf kurikulum tidak memperoleh akses supervisi maupun catatan guru; `kurikulum.html` tetap untuk klinik dan switch.

Migrasi hanya **menambah** objek; tidak mengubah tabel, fungsi, atau data yang ada. `access-core.mjs` (salinan paket bersama) tidak diubah; gerbang halaman baru memakai `ROOM_PAGES`, pola yang sama dengan halaman buku.

## 4. Rencana perbaikan desain

Prinsip: satu hierarki tombol, satu bahasa gerak, satu sumber warna (token `--ui-*`), dan setiap keadaan (memuat, kosong, galat, berhasil) punya wujud.

| Aspek | Sudah diterapkan pada ruang dan peluncur | Tahap berikut (halaman lama) |
|---|---|---|
| **Kenyamanan** | Kerangka muat, keadaan kosong berikon, pesan galat berbahasa Indonesia, toast, draf otomatis, tab mengikuti alamat (`#supervisi`), panah kiri/kanan pada tab, cincin fokus, target sentuh ≥ 44 px | Terapkan keadaan kosong dan toast pada `layanan`, `jurnal`, `klinik`; ganti `alert/confirm` bawaan dengan dialog |
| **Estetika** | Kartu radius 18 px, bayangan dua lapis, angka tabular, judul Playfair hanya untuk sambutan, tema gelap lewat token, warna status dan seri tervalidasi untuk buta warna | Buang gaya sebaris dan emoji tab di `admin.html`; satukan tiga lembar gaya lama (`styles`, `dashboard-clay`, `curriculum-ui`) ke token yang sama |
| **Animasi** | Masuk panel 0,42 s berjenjang, batang grafik tumbuh, tekan tombol mengecil 3%, panah kartu bergeser; semuanya mati pada `prefers-reduced-motion` | Transisi halaman (View Transitions) dan penanda tab yang bergeser |
| **Tata letak tombol** | Aksi utama di kanan bawah formulir, sekunder di kirinya, aksi berbahaya dipisah ke kiri; di ponsel tombol selebar layar dengan aksi utama paling atas; batang simpan instrumen lekat di bawah; tab aktif kini jelas | Pindahkan "Kirim ajuan" dan "Simpan jurnal" ke pola yang sama; batang aksi lekat pada formulir panjang |
| **Navigasi** | Peluncur layanan satu pintu; jam dan pintasan melayang disembunyikan pada ruang kerja karena menutupi tombol | Sidebar dikelompokkan ulang: Ajukan · Catat · Kelola; navigasi bawah ponsel memuat "Layanan" |

Urutan kerja yang disarankan: (1) aktivasi dan uji akun nyata; (2) pola tombol dan keadaan pada `layanan`, `jurnal`, `klinik`; (3) perapian `admin.html`; (4) penyatuan lembar gaya; (5) transisi halaman.

Rujukan: W3C, *Web Content Accessibility Guidelines 2.2* (2023), kriteria 2.5.8 Target Size, 2.4.7 Focus Visible, 2.3.3 Animation from Interactions; Fitts, P. M. (1954), "The information capacity of the human motor system in controlling the amplitude of movement", *Journal of Experimental Psychology*, 47(6); Nielsen, J. (1994), *Usability Engineering*, sepuluh heuristik kegunaan.

## 5. Bukti pemeriksaan

- `tests/room.test.mjs`: 8 tes lulus. Meliputi instrumen dan kesesuaian butir JS–SQL, aturan catatan, periode, ringkasan, CSV aman rumus, aturan RPC, gerbang halaman Worker, flag mati tanpa panggilan keluar, serta skenario SQL kandidat di PGlite (kepemilikan, peran, revisi usang, token ganda, penilaian, tanda terima, ringkasan, tabel tidak terbaca langsung). Skenario SQL memakai tiruan minimal fungsi peran produksi; bukan Supabase produksi.
- Suite keseluruhan: 98 tes, 10 gagal. Sepuluh kegagalan itu sama persis dengan sebelum perubahan (membutuhkan repo `../irsyads`, workbook murid, atau folder Drive lokal).
- Chromium headless pada lab: alur guru menyimpan catatan, admin menjadwalkan dan menilai, guru memberi tanda terima, unduh CSV, staf dan tamu dialihkan; tanpa galat JavaScript. Sebelas tampilan pada 1366 px dan 390 px tanpa luapan horizontal.
- Belum diuji: akun sekolah nyata, basis data produksi, tema gelap secara visual, pencetakan fisik, pembaca layar.

## 6. Aktivasi (butuh persetujuan pemilik)

1. ~~Pasang `server/curriculum-room.sql` sebagai migrasi.~~ Selesai 14 November 2026.
2. Pastikan guru sudah ditautkan ke pengampu (Ruang admin → Ajuan & jurnal → Penugasan akun). Saat ini `curriculum_teacher_access` di produksi berisi 0 tautan aktif, sehingga belum ada guru yang dapat membuka Ruang guru.
3. `ROOM_ENABLED` sudah `"true"` di `wrangler.jsonc`; gabungkan PR ke `main`, bangun, dan deploy.
4. Uji dengan satu akun admin dan satu akun guru sebelum diumumkan.

Pemulihan: kembalikan `ROOM_ENABLED` ke `"false"`. Halaman tetap terbuka tetapi tidak membaca atau menulis data; tab Klinik dan Ajuan tetap berfungsi. Jangan menghapus tabel yang sudah berisi catatan.

## 7. Lab lokal

```bash
node scripts/build-site.mjs
PGLITE_MODULE=/jalur/ke/@electric-sql/pglite/dist/index.js node scripts/preview-room.mjs
# http://127.0.0.1:4584/__fixture/role/admin  ·  /teacher  ·  /chemistry  ·  /staff  ·  /guest
```

Semua identitas dan data fiktif, hanya di RAM, hanya loopback. Tab Klinik dan Ajuan pada lab ini menampilkan pesan "menunggu aktivasi" karena lab hanya memuat SQL ruang; keduanya diuji oleh lab `preview-school-workflows.mjs`.
