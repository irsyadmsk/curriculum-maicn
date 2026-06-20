# TEKS PERINTAH UNTUK GOOGLE ANTIGRAVITY
## Portal Kurikulum MA Insan Cendekia Nusantara Purwakarta — TP 2026/2027

> **Cara pakai:** Buat folder proyek baru, letakkan `master-data.json` di akar folder, lalu buka Google Antigravity di folder tersebut dan tempelkan seluruh teks di bawah garis ini sebagai instruksi awal. Antigravity akan merencanakan, menulis berkas, menjalankan, dan memverifikasinya di browser.

---

## 1. PERAN & TUJUAN

Anda adalah seorang **front-end engineer sekaligus desainer UI** senior. Bangun **Portal Kurikulum** statis (HTML/CSS/JavaScript murni, tanpa framework, tanpa backend) untuk MA Insan Cendekia Nusantara Purwakarta, Tahun Pelajaran 2026/2027.

Sasaran utama:
1. **Akurasi data mutlak** — seluruh angka, tanggal, nama, dan teks WAJIB berasal dari berkas `master-data.json` yang saya sertakan. Dilarang mengarang, membulatkan, atau mengubah data. Jika ada nilai yang tampak janggal, tampilkan apa adanya sesuai master data.
2. **Desain yang matang dan beranimasi halus**, konsisten antarhalaman, dengan navigasi yang saling terhubung mulus.
3. **Ramah disematkan (embed) di Google Sites** — setiap halaman harus berupa berkas HTML mandiri yang dapat dimuat dalam `<iframe>` tanpa bergantung pada server.

Bahasa seluruh antarmuka: **Bahasa Indonesia baku**.

---

## 2. SUMBER DATA (SATU-SATUNYA SUMBER KEBENARAN)

Gunakan `master-data.json`. **Langkah pertama:** baca berkas ini, lalu hasilkan `data.js` yang membungkus seluruh isinya menjadi satu objek global, misalnya:

```js
// data.js  (di-generate dari master-data.json — JANGAN diketik ulang manual)
window.MASTER_DATA = { /* salin verbatim seluruh isi master-data.json */ };
```

Setiap halaman HTML meng-`<script src="data.js">` dan membaca dari `window.MASTER_DATA`. **Jangan gunakan `fetch()`** terhadap JSON (akan gagal saat di-embed di Google Sites). Dengan cara ini setiap halaman tetap mandiri.

### Skema `master-data.json` (kunci yang akan Anda pakai)

- `meta` — identitas madrasah, `tahun_pelajaran`, `no_dokumen`, `status`, `waka_kurikulum`, `landasan_hukum_utama[]`, `catatan_minggu_efektif`.
- `headline` — kartu statistik utama: `hari_efektif` (155), `total_jp` (1465), `minggu_efektif` (36), `minggu_ganjil` (18), `minggu_genap` (18), `hari_sumatif` (21), `jp_ganjil` (770), `jp_genap` (695), `durasi_1jp_menit` (45), `jumlah_rombel` (4), `beban_per_minggu_kelas` (48).
- `kalender_harian` — objek bertanda tanggal `"YYYY-MM-DD"` → `{c, l, s, p}`:
  - `c` = kode kategori (lihat `warna_kategori`),
  - `l` = label/keterangan hari,
  - `s` = semester (`"GANJIL"`, `"GENAP"`, atau `""`),
  - `p` = penanda fase (mis. `"Program Pra Tahun Ajaran"`).
- `warna_kategori` — peta `kode → {bg, teks, label}`. **Wajib** dipakai untuk mewarnai sel kalender dan legenda. Jika kode tidak ditemukan, pakai `warna_kategori.default`.
- `legenda_kelompok[]` — `{judul, kategori[]}` untuk menata legenda secara berkelompok di bawah kalender.
- `rekap_hari_efektif_bulan[]` — `{bulan, semester, hari_efektif, sumatif, total_jp}` per 12 bulan.
- `rekap_minggu_efektif[]` — `{bulan, semester, minggu_kalender, minggu_efektif, minggu_tidak_efektif, keterangan}`.
- `distribusi_jp[]` — 22 mata pelajaran: `{no, mapel, guru, jp_minggu_kelas, total_jp_minggu_4kelas, kelompok}`.
- `program_tahunan[]` — `{bulan, kegiatan, penanggung_jawab, waktu, status}`.
- `program_semester` — `{ganjil[], genap[]}`, tiap baris `{minggu, periode, hari_efektif, program, asesmen}`.
- `jadwal_harian` — `{senin_kamis{total_jp, slot[[waktu,kegiatan]...]}, jumat{...}, catatan}`.
- `struktur_beban` — `{beban_per_minggu{...}, formula_rapor, kktp{...}, asesmen{...}}`.
- `profil` — `{visi, misi[], delapan_dimensi[], panca_cinta[[judul,deskripsi]...], landasan_hukum[[regulasi,perihal]...]}`.

---

## 3. SISTEM DESAIN (WAJIB DIPATUHI)

Pertahankan identitas visual portal yang sudah ada — **hijau madrasah + emas + krem**.

```css
:root{
  --g1:#1A4731;  /* hijau tua  */   --g2:#2D6A4F;  /* hijau sedang */
  --g3:#52B788;  /* hijau muda */   --g5:#D8F3DC;  /* hijau pucat  */
  --gold:#C9A227; --gold-l:#F5E6C0; /* emas & emas muda */
  --cream:#F7F4EE; --white:#fff;
  --d1:#1E2A22; --d2:#3D4F42; --d3:#718089; --d5:#E8EDE9;
  --radius:10px; --shadow:0 2px 12px rgba(26,71,49,.10);
}
```

- **Font:** judul & teks `Plus Jakarta Sans` (400–800); angka/kode/monospace `DM Mono`. Impor dari Google Fonts.
- **Header tiap halaman:** gradient `linear-gradient(135deg,var(--g1) 0%,var(--g2) 60%,#1F5C3A 100%)`, dengan *eyebrow* (label kecil emas, huruf kapital, `letter-spacing`), judul tebal, dan deskripsi singkat.
- **Lebar konten:** `max-width:980px`, terpusat, padding sisi 32px (18px pada layar kecil).
- **Kartu:** latar putih, `border-radius` 10px, `box-shadow` lembut, sering memakai garis atas aksen 3px (`border-top`) berwarna hijau/emas.
- Gaya harus **bersih, profesional, akademis** — bukan ramai. Konsisten dengan berkas lama (`profil.html`, `struktur.html`) sebagai acuan rasa visual.

---

## 4. STRUKTUR SITUS (7 HALAMAN MANDIRI)

Semua halaman berbagi **satu komponen navigasi** yang identik (lihat §5) dan `data.js` yang sama.

| Berkas | Halaman | Sumber data |
|---|---|---|
| `index.html` | **Beranda** — ringkasan portal, kartu statistik `headline`, pintasan ke semua halaman, identitas dokumen (`meta`) | `meta`, `headline` |
| `profil.html` | **Profil & Regulasi** | `profil` |
| `struktur.html` | **Struktur, Beban Belajar & Jadwal Harian** | `struktur_beban`, `distribusi_jp`, `jadwal_harian` |
| `kalender.html` | **Kalender Akademik (interaktif)** | `kalender_harian`, `warna_kategori`, `legenda_kelompok`, `rekap_*`, `headline` |
| `prota.html` | **Program Tahunan** | `program_tahunan` |
| `posem.html` | **Program Semester** | `program_semester` |
| `dokumen.html` | **Dokumen & Agenda** — pusat tautan/unduhan (boleh placeholder rapi untuk KOSP, ATP, perangkat ajar) | — |

### Rincian per halaman

**index.html (Beranda).** Hero dengan nama madrasah, TP 2026/2027, dan badge `status` ("DEFINITIF"). Tampilkan **5 kartu statistik** dari `headline`: Hari Efektif (155), Total JP (1.465), Minggu Efektif (36 — subteks "Ganjil 18 · Genap 18"), Hari Sumatif (21), Rombel (4). Di bawahnya, grid kartu-pintasan ke 6 halaman lain (judul + deskripsi singkat + ikon sederhana berbasis CSS/emoji). Cantumkan `meta.no_dokumen` dan `meta.waka_kurikulum` di footer.

**profil.html.** Bagian Visi (kutip `profil.visi`), Misi (daftar `profil.misi`), **8 Dimensi Profil Lulusan** (grid 4 kolom dari `profil.delapan_dimensi`, bernomor 01–08), **Panca Cinta** (5 kartu dari `profil.panca_cinta`, judul + deskripsi), dan **Landasan Hukum** (tabel dari `profil.landasan_hukum`). Pertahankan tata letak menyerupai berkas `profil.html` lama, tingkatkan animasinya.

**struktur.html.** Tiga bagian:
- *Distribusi JP* — tabel `distribusi_jp` (No, Mata Pelajaran, Guru Pengampu, JP/Minggu/Kelas, Total JP/Minggu 4 Kelas, Kelompok). Beri pewarnaan ringan per `kelompok` (PAI, Umum, MIPA, IPS, TIK, Bahasa, PJOK, Seni, BK). Tampilkan baris TOTAL: 48 JP/minggu/kelas, 192 JP/minggu untuk 4 kelas. Catatan: 1 JP = 45 menit; Ekonomi "Dalam Proses Rekrutmen" tandai khusus.
- *Beban Belajar & Asesmen* — kartu dari `struktur_beban`: beban per minggu (X=52, XI=53, XII=53), `formula_rapor` (tampilkan dalam blok monospace), KKTP (X=82, XI=85, XII=88), definisi asesmen formatif & sumatif.
- *Jadwal Harian KBM* — dua kolom: **Senin–Kamis (10 JP)** dan **Jumat (8 JP)** dari `jadwal_harian.slot`. Baris istirahat/ibadah (Dhuha, Ishoma, Shalat Jumat, Ashar, Kultum) diberi warna emas pembeda. Sertakan `jadwal_harian.catatan`.

**kalender.html (halaman paling kompleks).** Lihat §6.

**prota.html.** Tabel/timeline `program_tahunan` (No, Bulan, Program/Kegiatan, Penanggung Jawab, Waktu Pelaksanaan, Status). Beri *badge* warna pada kolom Status (Terlaksana / Berlangsung / Terjadwal / Tentatif). Idealnya tampilkan sebagai **linimasa vertikal** ber-animasi reveal saat di-scroll, dikelompokkan per bulan.

**posem.html.** Dua tabel terpisah: **Semester Ganjil** (`program_semester.ganjil`) dan **Semester Genap** (`program_semester.genap`), kolom: Minggu ke-, Periode, Hari Efektif, Program Bulanan, Asesmen. Beri penanda visual pada baris asesmen (STS/SAS) dan baris libur (hari efektif = 0).

**dokumen.html.** Pusat unduhan/agenda. Boleh berupa kartu placeholder rapi: KOSP, ATP/Silabus per mapel, Perangkat Ajar & Kokurikuler, Agenda Akademik. Sediakan slot tautan yang mudah diisi kemudian.

---

## 5. NAVIGASI & KETERHUBUNGAN ANTARHALAMAN

- Sediakan **bilah navigasi atas yang identik** di semua halaman, berisi tautan ke ketujuh halaman, dengan penanda **halaman aktif** (mis. garis bawah emas). Pada layar sempit, runtuhkan menjadi menu hamburger.
- Sertakan **back-bar** tipis "← Beranda Portal Kurikulum" (gaya seperti berkas lama).
- Transisi pindah halaman terasa mulus: terapkan **fade-in lembut** pada konten saat halaman dimuat. Jika memungkinkan, gunakan View Transitions API dengan fallback aman.
- Footer identik di semua halaman: `meta.madrasah` · Portal Kurikulum · Waka Kurikulum: `meta.waka_kurikulum`.

---

## 6. SPESIFIKASI HALAMAN KALENDER (`kalender.html`)

Struktur **tiga tab**: **(1) Kalender**, **(2) Hari Efektif**, **(3) Minggu Efektif**.

### Kartu statistik (di atas tab)
Empat kartu dari `headline`: Hari Pembelajaran Efektif (155), Minggu Efektif (36 — subteks "Ganjil 18 · Genap 18"), Estimasi Total JP (1.465 — subteks "Sen–Kam 10 JP · Jum 8 JP"), Hari Sumatif (21 — subteks "STS 10 · SAS 11").

### Tab 1 — Kalender
- **Grid 13 bulan**: Juni 2026 s.d. Juni 2027. Tiap bulan adalah kalender mini (kolom Sen–Min; gunakan urutan Min–Sab atau Sen–Min secara konsisten — tampilkan nama hari `Min Sen Sel Rab Kam Jum Sab`).
- Tiap sel hari diwarnai sesuai `warna_kategori[ c ].bg` dengan teks `warna_kategori[ c ].teks`. Hari tanpa entri = kosong/netral.
- **Tooltip saat hover/tap**: tampilkan tanggal lengkap + `l` (label) + nama kategori (`warna_kategori[c].label`). Hari `libur_mingguan` boleh tidak diberi tooltip agar tidak ramai.
- **Filter semester**: tombol "Semua / Ganjil / Genap" yang menyaring/menonjolkan bulan sesuai semester.
- **Legenda di bawah kalender (PENTING — permintaan khusus):** render dari `legenda_kelompok`. Tampilkan **berkelompok** dengan judul tiap kelompok (Pra-Tahun Ajaran · Pembelajaran & Asesmen · Program & Kesiswaan · Libur). Setiap item legenda = kotak warna (`bg`) + label (`warna_kategori[kode].label`).
  - **Wajib dipastikan:** Kedatangan (Timur & Reguler), MATSAMA, Pra-Tes Matrikulasi, Matrikulasi KBM, dan Pasca-Tes Matrikulasi tampil dengan **warna yang berbeda-beda dan tidak menyerupai** warna Libur Nasional maupun Pembelajaran/Asesmen. Warna sudah ditetapkan di `warna_kategori` — gunakan persis nilainya, jangan ganti.

### Tab 2 — Hari Efektif
- Tabel/diagram dari `rekap_hari_efektif_bulan` (Bulan, Semester, Hari Efektif, Sumatif, Total JP), dipisah visual Ganjil vs Genap.
- Tampilkan baris TOTAL: 155 hari · 21 sumatif · 1.465 JP. Konsisten dengan `headline`.
- Boleh tambahkan bar chart sederhana (CSS/SVG murni) untuk hari efektif per bulan.

### Tab 3 — Minggu Efektif
- Dari `rekap_minggu_efektif`: per bulan tampilkan Minggu Kalender, Minggu Efektif, Minggu Tidak Efektif, dan `keterangan`.
- Tonjolkan total: **Ganjil 18 · Genap 18 · Total 36**.
- Tampilkan kotak peringatan (bergaya *callout* emas/oranye) berisi `meta.catatan_minggu_efektif` — bahwa 18 minggu Ganjil dan 36 minggu total berada **tepat di batas minimal** SK Dirjen PI No. 4860/2026 & PP No. 57/2021.

---

## 7. ANIMASI & INTERAKSI

- **Reveal saat scroll** (IntersectionObserver) untuk kartu, baris tabel, dan item linimasa — fade + naik halus, ber-stagger.
- **Hitung-naik (count-up)** pada angka kartu statistik saat pertama tampil.
- **Transisi tab** dan **hover** yang halus (≤ 250ms, easing alami).
- **Hormati `prefers-reduced-motion`**: jika aktif, nonaktifkan animasi non-esensial.
- Animasi harus **ringan & 60fps** (utamakan `transform`/`opacity`, hindari animasi `layout`).

---

## 8. KUALITAS, AKSESIBILITAS & PERFORMA

- **Responsif** penuh: desktop, tablet, ponsel. Grid kalender 13 bulan harus tetap terbaca di ponsel (scroll/akordeon bila perlu).
- **Aksesibilitas**: kontras warna memadai, `:focus-visible` jelas (outline emas), atribut `aria-*` pada tab & tombol, navigasi keyboard berfungsi, `lang="id"`.
- **Mandiri & ringan**: tanpa dependensi eksternal selain Google Fonts. Tanpa `localStorage`/`sessionStorage`. Tanpa backend.
- **Ramah Google Sites**: tiap halaman valid dimuat dalam `<iframe>`.

---

## 9. STRUKTUR KELUARAN

```
/ (akar proyek)
├── master-data.json     (input — jangan diubah)
├── data.js              (di-generate dari master-data.json)
├── assets/
│   ├── styles.css       (sistem desain bersama §3)
│   └── app.js           (navigasi, animasi, util bersama)
├── index.html
├── profil.html
├── struktur.html
├── kalender.html
├── prota.html
├── posem.html
└── dokumen.html
```

CSS/JS bersama boleh dipisah ke `assets/`. Namun jika ada halaman yang akan disematkan tunggal di Google Sites, pastikan halaman tersebut tetap berfungsi (boleh meng-*inline* CSS/JS kritis bila perlu).

---

## 10. PROSEDUR VERIFIKASI (LAKUKAN SEBELUM SELESAI)

1. Jalankan situs di server lokal dan **buka tiap halaman di browser**.
2. **Cocokkan angka kunci** dengan master data: Hari Efektif **155**, Total JP **1.465**, Minggu Efektif **36 (18+18)**, Hari Sumatif **21**, JP Ganjil **770**, JP Genap **695**, 22 mata pelajaran, 48 JP/minggu/kelas.
3. **Periksa kalender**: Juli 2026 harus menampilkan Kedatangan Reguler (4–5 Jul), MATSAMA (6–10 Jul), Pra-Tes (13 Jul), Matrikulasi (14–23 Jul), Pasca-Tes (24 Jul), dan Pembelajaran Efektif mulai 27 Jul.
4. **Periksa legenda**: ketujuh kategori Pra-Tahun Ajaran tampil dengan warna berbeda; Pasca-Tes (`#AD1457`) tidak sewarna Libur Nasional (`#C00000`).
5. Uji **responsif** (ponsel) dan **`prefers-reduced-motion`**.
6. Pastikan **tidak ada error di console** dan semua tautan navigasi berfungsi dua arah.
7. Laporkan ringkas setiap penyimpangan; **jangan** memperbaiki data dengan mengarang — bila ragu, tampilkan sesuai master data dan beri catatan.

---

## 11. ATURAN MUTLAK

- **Jangan** mengubah, membulatkan, atau menambah data di luar `master-data.json`.
- **Jangan** memakai framework, bundler, atau dependensi runtime eksternal (selain Google Fonts).
- **Jangan** memakai penyimpanan browser (localStorage/sessionStorage).
- **Gunakan** warna kategori persis dari `warna_kategori`.
- Seluruh teks UI dalam **Bahasa Indonesia baku**.

> Mulailah dengan: (1) membaca `master-data.json`, (2) membuat `data.js`, (3) menyusun `assets/styles.css` + `assets/app.js`, lalu (4) membangun halaman satu per satu diawali `index.html` dan `kalender.html`, dan (5) menjalankan verifikasi §10.
