# PANDUAN TAHAPAN — GOOGLE ANTIGRAVITY
## Meningkatkan repo `curriculum-maicn` yang sudah ada (TP 2026/2027)

**Konteks:** Repo sudah berisi `index.html`, `kalender.html`, `struktur.html`, `dokumen.html`, `profil.html`. Anda sudah berada di Antigravity pada folder
`C:\Users\T6N0CV02S35823C\Documents\GitHub\curriculum-maicn`.

**Aturan main:**
- Kerjakan **satu tahap = satu prompt**. Tinjau hasilnya, lalu `git commit`, baru lanjut tahap berikutnya.
- **`master-data.json` adalah satu-satunya sumber kebenaran.** Bila data lama di halaman berbeda dengan master data, **master data yang menang** (terutama data kalender: 155 hari · 1.465 JP · 36 minggu · 21 sumatif).
- Spesifikasi rinci tiap halaman, sistem desain, dan daftar verifikasi ada di lampiran `PROMPT_Google_Antigravity.md` — boleh Anda lampirkan ke Antigravity sebagai rujukan.

---

## TAHAP 0 — Persiapan (manual, tanpa Antigravity)
1. Salin berkas **`master-data.json`** ke akar repo `curriculum-maicn`.
2. (Disarankan) Salin juga **`PROMPT_Google_Antigravity.md`** ke akar repo sebagai dokumen spesifikasi.
3. Pastikan Antigravity membuka folder repo ini.

---

## TAHAP 1 — Fondasi data & token desain
**Tujuan:** lahirkan `data.js`, pusatkan CSS/JS bersama, perbaiki bug variabel.

> Prompt (tempel ke Antigravity):
```
Baca master-data.json di akar repo. Buat data.js yang membungkus seluruh isinya menjadi
window.MASTER_DATA = { ...isi master-data.json verbatim... }. Jangan ketik ulang manual—
turunkan langsung dari master-data.json. Jangan gunakan fetch() di mana pun (situs akan
di-embed di Google Sites, fetch akan gagal).

Lalu buat assets/styles.css berisi token desain bersama dan komponen umum yang sudah dipakai
halaman lama: variabel :root (--g1 #1A4731, --g2 #2D6A4F, --g3 #52B788, --g5 #D8F3DC,
--gold #C9A227, --gold-l #F5E6C0, --cream #F7F4EE, --white #fff, --d1 #1E2A22, --d2 #3D4F42,
--d3 #718089, --d5 #E8EDE9, --radius 10px, --shadow 0 2px 12px rgba(26,71,49,.10)),
font Plus Jakarta Sans + DM Mono, serta kelas .wrap .hdr .backbar .eyebrow .footer
persis seperti pada profil.html. Catatan: struktur.html lama memakai var(--shadow) dan
var(--d2) yang tidak terdefinisi—pastikan keduanya ada di styles.css.

Buat juga assets/app.js untuk util bersama (navigasi aktif, animasi reveal saat scroll
dengan IntersectionObserver, count-up angka), dan hormati prefers-reduced-motion.

Jangan ubah konten halaman dulu pada tahap ini.
```
**Checkpoint:** ada `data.js`, `assets/styles.css`, `assets/app.js`. `window.MASTER_DATA` terbaca di console. → commit `feat: data.js + token desain bersama`.

---

## TAHAP 2 — Navigasi bersama antarhalaman
**Tujuan:** bilah navigasi identik + penanda halaman aktif di semua halaman.

> Prompt:
```
Tambahkan bilah navigasi atas yang IDENTIK ke semua halaman (index, profil, struktur,
kalender, prota, posem, dokumen) dengan tautan ke ketujuh halaman dan penanda halaman aktif
(garis bawah emas). Pada layar sempit, runtuhkan jadi menu hamburger. Pertahankan back-bar
"← Beranda Portal Kurikulum" dan footer identik (MA Insan Cendekia Nusantara Purwakarta ·
Portal Kurikulum · Waka Kurikulum: Muhammad Irsyad Sirojul Khoeir, S.Sos., M.Sos.).
Tautkan styles.css, app.js, dan data.js di setiap halaman. Terapkan fade-in lembut saat
halaman dimuat. Belum perlu mengubah isi konten tiap halaman.
```
**Checkpoint:** navigasi muncul & konsisten, tautan dua arah berfungsi. → commit `feat: navigasi bersama`.

---

## TAHAP 3 — Kalender (paling penting; GANTI data lama)
**Tujuan:** kalender membaca dari `MASTER_DATA`, data terkoreksi, warna & legenda berkelompok.

> Prompt:
```
Tulis ulang kalender.html agar SEPENUHNYA membaca dari window.MASTER_DATA—jangan pertahankan
data kalender lama yang sudah usang. Susun tiga tab: (1) Kalender, (2) Hari Efektif,
(3) Minggu Efektif.

Kartu statistik dari MASTER_DATA.headline: Hari Pembelajaran Efektif 155, Minggu Efektif 36
(subteks "Ganjil 18 · Genap 18"), Estimasi Total JP 1.465 (subteks "Sen–Kam 10 JP · Jum 8 JP"),
Hari Sumatif 21 (subteks "STS 10 · SAS 11"). Pakai animasi count-up.

Tab Kalender: grid 13 bulan (Juni 2026 s.d. Juni 2027) dari MASTER_DATA.kalender_harian
(kunci "YYYY-MM-DD" → {c,l,s,p}). Warnai tiap sel pakai MASTER_DATA.warna_kategori[c].bg dan
teks .teks; bila kode tak ada pakai warna_kategori.default. Tooltip hover/tap menampilkan
tanggal lengkap + label l + nama kategori (warna_kategori[c].label); hari libur_mingguan
boleh tanpa tooltip. Sediakan filter semester Semua/Ganjil/Genap.

LEGENDA DI BAWAH KALENDER (penting): render dari MASTER_DATA.legenda_kelompok secara
BERKELOMPOK dengan judul tiap kelompok (Pra-Tahun Ajaran · Pembelajaran & Asesmen ·
Program & Kesiswaan · Libur). Tiap item = kotak warna + label. Pastikan Kedatangan (Timur &
Reguler), MATSAMA, Pra-Tes, Matrikulasi KBM, dan Pasca-Tes tampil dengan warna berbeda-beda
sesuai warna_kategori—jangan diganti—dan Pasca-Tes (#AD1457) tidak sewarna Libur Nasional (#C00000).

Tab Hari Efektif: dari MASTER_DATA.rekap_hari_efektif_bulan (pisah Ganjil/Genap), baris TOTAL
155 hari · 21 sumatif · 1.465 JP. Boleh tambah bar chart CSS/SVG murni.

Tab Minggu Efektif: dari MASTER_DATA.rekap_minggu_efektif; tonjolkan Ganjil 18 · Genap 18 ·
Total 36; tampilkan callout emas berisi MASTER_DATA.meta.catatan_minggu_efektif.

Verifikasi Juli 2026 menampilkan: Kedatangan Reguler 4–5 Jul, MATSAMA 6–10 Jul,
Pra-Tes 13 Jul, Matrikulasi 14–23 Jul, Pasca-Tes 24 Jul, Pembelajaran Efektif mulai 27 Jul.
```
**Checkpoint:** angka & warna sesuai master data; Juli benar; legenda berkelompok. → commit `feat: kalender data-driven + koreksi data`.

---

## TAHAP 4 — Struktur, JP, Jadwal Harian
**Tujuan:** tambahkan tabel JP 22 mapel (belum ada di halaman lama) & jadwalkan dari data.

> Prompt:
```
Perbarui struktur.html agar membaca dari window.MASTER_DATA. Tambahkan tabel Distribusi JP
dari MASTER_DATA.distribusi_jp (No, Mata Pelajaran, Guru Pengampu, JP/Minggu/Kelas,
Total JP/Minggu 4 Kelas, Kelompok), beri pewarnaan ringan per kelompok (PAI, Umum, MIPA, IPS,
TIK, Bahasa, PJOK, Seni, BK), baris TOTAL 48 JP/minggu/kelas dan 192 JP/minggu untuk 4 kelas,
tandai Ekonomi "Dalam Proses Rekrutmen". Bagian Beban Belajar & Asesmen dari
MASTER_DATA.struktur_beban (beban per minggu X=52/XI=53/XII=53, formula_rapor dalam blok
monospace, KKTP X=82/XI=85/XII=88, definisi asesmen). Jadwal Harian dari
MASTER_DATA.jadwal_harian: dua kolom Senin–Kamis (10 JP) dan Jumat (8 JP) dari slot;
baris ibadah/istirahat (Dhuha, Ishoma, Shalat Jumat, Ashar, Kultum) diberi warna emas;
sertakan jadwal_harian.catatan. Pertahankan rasa visual halaman lama.
```
**Checkpoint:** tabel 22 mapel tampil; jadwal dari data. → commit `feat: struktur + distribusi JP`.

---

## TAHAP 5 — Profil (jadikan data-driven)
> Prompt:
```
Ubah profil.html agar visi, misi, 8 Dimensi Profil Lulusan, Panca Cinta, dan tabel Landasan
Hukum dirender dari MASTER_DATA.profil. Pertahankan tata letak & gaya kartu yang sudah ada,
tambahkan animasi reveal. Pastikan teksnya identik dengan master data.
```
**Checkpoint:** isi sama, kini bersumber data. → commit `refactor: profil data-driven`.

---

## TAHAP 6 — Halaman baru: Prota & Posem
> Prompt:
```
Buat prota.html: linimasa/tabel dari MASTER_DATA.program_tahunan (Bulan, Program/Kegiatan,
Penanggung Jawab, Waktu Pelaksanaan, Status) dengan badge warna pada Status
(Terlaksana/Berlangsung/Terjadwal/Tentatif) dan reveal saat scroll, dikelompokkan per bulan.

Buat posem.html: dua tabel terpisah dari MASTER_DATA.program_semester.ganjil dan .genap
(Minggu ke-, Periode, Hari Efektif, Program Bulanan, Asesmen); beri penanda visual pada baris
asesmen (STS/SAS) dan baris libur (hari efektif = 0).

Kedua halaman memakai header, navigasi, styles.css, app.js, data.js, dan footer yang sama.
```
**Checkpoint:** dua halaman baru hidup & masuk navigasi. → commit `feat: halaman prota & posem`.

---

## TAHAP 7 — Beranda
> Prompt:
```
Perbarui index.html: hero dengan nama madrasah, TP 2026/2027, badge MASTER_DATA.meta.status
("DEFINITIF"). Lima kartu statistik dari MASTER_DATA.headline (Hari Efektif 155, Total JP 1.465,
Minggu Efektif 36 dgn subteks "Ganjil 18 · Genap 18", Hari Sumatif 21, Rombel 4) dengan
count-up. Grid kartu-pintasan ke 6 halaman lain (judul + deskripsi singkat). Footer mencantumkan
MASTER_DATA.meta.no_dokumen dan meta.waka_kurikulum.
```
**Checkpoint:** beranda jadi pusat portal. → commit `feat: beranda statistik + pintasan`.

---

## TAHAP 8 — Dokumen (rapikan placeholder)
> Prompt:
```
Rapikan dokumen.html menjadi pusat unduhan/agenda dengan kartu placeholder rapi: KOSP,
ATP/Silabus per mapel, Perangkat Ajar & Kokurikuler, Agenda Akademik—sediakan slot tautan
yang mudah diisi kemudian. Samakan header, navigasi, dan footer.
```
**Checkpoint:** halaman konsisten. → commit `feat: dokumen`.

---

## TAHAP 9 — Verifikasi menyeluruh & rilis
> Prompt:
```
Jalankan situs di server lokal dan buka setiap halaman. Cocokkan dengan master data:
Hari Efektif 155, Total JP 1.465, Minggu Efektif 36 (18+18), Hari Sumatif 21, JP Ganjil 770,
JP Genap 695, 22 mata pelajaran, 48 JP/minggu/kelas. Periksa kalender Juli 2026 (Kedatangan
4–5, MATSAMA 6–10, Pra-Tes 13, Matrikulasi 14–23, Pasca-Tes 24, Pembelajaran mulai 27).
Periksa legenda: tujuh kategori Pra-Tahun Ajaran berbeda warna; Pasca-Tes ≠ Libur Nasional.
Uji responsif ponsel, prefers-reduced-motion, dan pastikan tidak ada error console serta
semua tautan navigasi berfungsi dua arah. Laporkan penyimpangan tanpa mengarang data.
```
**Checkpoint:** semua hijau. → commit `chore: verifikasi & rilis` lalu `git push`.

---

### Bila ingin lebih ringkas
Tahap 1–2 boleh digabung jadi satu prompt; Tahap 5 & 8 opsional bila Anda puas dengan kondisi sekarang. Namun **Tahap 3 sebaiknya berdiri sendiri** karena paling kompleks dan paling menentukan akurasi data.
