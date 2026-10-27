# Laporan Perapian Portal Publik Curriculum (Tahap Lokal) — AG-CURR-03
**Tanggal**: 25 Oktober 2026  
**Pelaksana**: Antigravity (Advanced Agentic Pair-Programming)  
**Lingkup Kerja**: Repositori `C:\Users\T6N0CV02S35823C\Github\curriculum-maicn`  
**Status Produksi**: **Lokal Saja — Tidak Ada Deploy / Commit / Push / Perubahan Server**  
**Tujuan**: Mengintegrasikan identitas visual resmi Irsyads pada portal publik Curriculum, menyematkan pintu ekosistem yang jelas ke `irsyads.com`, `academy.irsyads.com`, dan `studio.irsyads.com` dengan pemeliharaan bahasa pengunjung, menyajikan kalender definitif lintas Januari (JP0 eksplisit), direktori interaktif 21 guru riil, serta kenyamanan mobile 390px dan aksesibilitas.

---

## 1. Daftar Berkas (Files Changed Before & After)

Sesuai instruksi batas kerja, **tidak ada perubahan pada repositori `irsyads`** (Studio, Site, DB, Supabase CRUD, auth/roles tetap di bawah kendali Codex/Hermes), tidak ada resetting terhadap *dirty work* sebelumnya, dan hanya mengedit tampilan di repo `curriculum-maicn`.

### A. Berkas yang Diperbarui / Ditambahkan pada Batch Ini (AG-CURR-03)

| Berkas | Status | Perubahan Utama |
| :--- | :--- | :--- |
| `index.html` | Dimodifikasi | Menambahkan tautan ramah aksesibilitas (*skip link* `#main-clay-content`), bilah pintu ekosistem Irsyads (`.irsyads-portal-doors`), navigasi pil antarbagian (`.portal-section-nav`), pengantar hero berkedalaman tenang dengan tipografi resmi (`Playfair Display`, `Libre Baskerville`, `Plus Jakarta Sans`), ringkasan kalender semester lintas Januari dengan penanda `0 JP · Non-KBM / Libur Semester` yang eksplisit, direktori interaktif 21 guru pengampu riil dari `master-data.json` dengan pencarian instan dan *empty state*, serta status draf perangkat ajar Google Drive sah (`1rro943WeUP0d3nYQBkYvCuNdFm7yGWKJ`). |
| `kalender.html` | Dimodifikasi | Menyematkan bilah pintu ekosistem Irsyads (`.irsyads-portal-doors`) pada header, memperbarui modal detail tanggal agar hari libur/non-KBM melabeli `0 JP (Non-KBM)` secara eksplisit dan tidak pernah kosong/ambigu. |
| `jadwal.html` | Dimodifikasi | Menyematkan bilah pintu ekosistem Irsyads (`.irsyads-portal-doors`) pada header di atas tabel jadwal KBM 21 guru. |
| `assets/dashboard-clay.css` | Dimodifikasi | Menyematkan arsitektur token 5 warna resmi (`#F3EDE2`, `#0B1D35`, `#376A9B`, `#D9CCB9`, `#586574`), perpaduan tipografi terpandu, kartu pintu ekosistem dengan target sentuh $\ge 44\text{px}$, pil navigasi scroll horizontal, lencana `jp-badge-zero`, penanganan keyboard `:focus-visible`, pengurangan gerak `@media (prefers-reduced-motion: reduce)`, scroll tabel terkendali (`overflow-x: auto; -webkit-overflow-scrolling: touch;`), serta dukungan `[dir="rtl"]`. |
| `assets/dashboard-clay.js` | Dimodifikasi | Menambahkan helper dinamis `updateEcosystemDoors(lang)` yang mendeteksi preferensi bahasa pengunjung (`id`, `en`, `ar`, `zh`) dari `IrsyadsPreferences`, *cookie*, atau *local storage* untuk memperbarui rute tautan secara adaptif, mendengarkan event `irsyads-language-change`, serta mengaktifkan scroll craft lembut pada bidang pengantar hero (*restrained ambient scroll plane*) yang otomatis nonaktif pada mode *reduced motion*. |
| `tests/public-portal-curriculum.test.mjs` | Berkas Baru | Suite pengujian otomatis (7 unit test) memverifikasi keberadaan pintu ekosistem, pemeliharaan bahasa dinamis, token warna, tipografi, penanganan 0 JP lintas Januari, pencarian 21 guru riil, status Drive, dan aksesibilitas/mobile 390px. |
| `docs/2026-10-25_ANTIGRAVITY_PUBLIC_CURRICULUM_LOCAL.md` | Berkas Baru | Dokumen laporan formal ini untuk diteruskan Pemilik kepada Codex. |

---

## 2. Pintu Ekosistem Irsyads & Pemeliharaan Bahasa Pengunjung

Tiga pintu ekosistem terpadu telah disematkan secara konsisten pada header `index.html`, `kalender.html`, dan `jadwal.html`:

1. **Pintu Utama Irsyads (`https://irsyads.com/`)**:
   - Selector: `a[data-door="site"]`
   - Label: `irsyads.com` · *Utama*
   - Keterangan: "Riset, pemikiran sosiologi, karya & agenda"
   - Adaptasi Bahasa: Mengarah ke `https://irsyads.com/` (jika `en`) atau `https://irsyads.com/${lang}/` (jika `id`, `ar`, `zh`).

2. **Irsyads Academy (`https://academy.irsyads.com/`)**:
   - Selector: `a[data-door="academy"]`
   - Label: `Irsyads Academy` · *Belajar*
   - Keterangan: "Kelas interaktif, modul Kurikulum Merdeka & CBT"
   - Adaptasi Bahasa: Mempertahankan parameter bahasa `?lang=${lang}` bila pengunjung memilih selain default.

3. **Studio Kurikulum (`https://studio.irsyads.com/?lang=id#kurikulum`)**:
   - Selector: `a[data-door="studio"]`
   - Label: `Studio Kurikulum` · *Ruang Kerja*
   - Keterangan: "Pintu kelola kurikulum & klinik (perlu otorisasi)"
   - Adaptasi Bahasa: Menjaga parameter `?lang=${lang}#kurikulum` secara dinamis.
   - Kejujuran Akses: Dilabeli secara tegas sebagai pintu masuk ruang kerja tim pengelola yang memerlukan otorisasi/login resmi, **bukan izin akses otomatis bagi pengunjung publik**.

---

## 3. Data Riil & Konten Nyata (Bukan Data Contoh)

Tidak ada data contoh atau placeholder fiktif yang digunakan:
- **Rentang Kalender Semester Definitif**:
  * Semester Ganjil: 13 Juli 2026 s.d. 18 Desember 2026 (18 pekan KBM efektif, 36 JP/pekan).
  * Jeda Libur Semester Ganjil Lintas Januari: 21 Desember 2026 s.d. 03 Januari 2027 (14 hari kalender). Durasi KBM: **`0 JP · Non-KBM / Libur Semester`** secara eksplisit (tidak kosong).
  * Semester Genap: 04 Januari 2027 s.d. 18 Juni 2027 (18 pekan KBM efektif, 36 JP/pekan).
- **21 Guru Pengampu Riil**:
  * Menampilkan 21 guru asli dari `jadwal_kbm_v2.matriks_guru` pada `master-data.json` (antara lain Ust. Muhammad Syahrul Bakhtiar, Lc., Ust. Adi Supihadi, M.Pd., Ust. Muhammad Afsal, S.Ag., Ustzh. Ani Nuryani, S.Pd., Ust. Azka M. Naufal, B.A., Ust. Muhammad Irsyad Sirojul Khoeir, S.Sos., M.Sos., Ust. Ahmad Abrar, S.Kom., S.Psi., Ustzh. Leni Noviani, S.Sos., dll.).
  * Disertai fitur pencarian ter-filter instan berdasarkan nama, mapel, atau kode guru, lengkap dengan indikator hitungan kecocokan dan *empty state* yang informatif.
- **Perangkat Ajar & Repositori Drive Sah**:
  * Tautan langsung ke Folder ID Google Drive: `1rro943WeUP0d3nYQBkYvCuNdFm7yGWKJ`.
  * Status transparan: *"Draf Rujukan Internal · Belum Tersinkronisasi Otomatis"* tanpa tombol palsu publikasi cloud.

---

## 4. Hasil Uji Lingkup Lokal (Localhost Verification)

Pengujian dilakukan menggunakan Node.js test runner bawaan sistem:
```powershell
node --test tests/*.test.mjs scratch/ag-curr02/candidate.test.mjs
```

### Hasil Eksekusi:
- **Total Pengujian**: 38 test suites / assertions.
- **Status Kelulusan**: **38 LULUS (100% PASS)**, 0 gagal, durasi ~260 ms.
  * ✔ 7 pengujian baru `tests/public-portal-curriculum.test.mjs` (Ecosystem Doors, Dynamic Language, Palette Tokens, Calendar 0 JP, 21 Teachers Directory, Workbooks Status, Accessibility/Ergonomics).
  * ✔ 8 pengujian kandidat `scratch/ag-curr02/candidate.test.mjs`.
  * ✔ 23 pengujian regresi kurikulum (E-Rapor, KOM KMA 450/2024, SIMPATIKA, Mutaba'ah PPRA, Buku Kerja, Jadwal KBM, dll.).

### Hasil Verifikasi Aspek Kunci:
1. **Desktop**:
   - Layout bersih, terstruktur, dengan hirarki visual yang tenang (*calm academic presence*).
   - Sidebar collapse (tombol `[` atau klik) tetap berfungsi normal dengan lebar 76px.
   - Pintu ekosistem dan navigasi antarbagian tampil rapi dalam 3 kolom seimbang.
2. **Ponsel 390px (Mobile Ergonomics)**:
   - Pintu ekosistem menyusut menjadi susunan vertikal 1 kolom yang nyaman dijangkau ibu jari.
   - Grid 21 guru mengalir vertikal (*single column*) dengan target sentuh kartu dan tombol $\ge 44\text{px}$.
   - Tabel jadwal dan kalender memiliki kontainer `overflow-x: auto; -webkit-overflow-scrolling: touch;` sehingga tidak menyebabkan pergeseran horizontal (*horizontal overflow*) pada viewport ponsel.
3. **Keyboard & Focus**:
   - Elemen interaktif dilengkapi selektor `:focus-visible` dengan outline 2px solid `#376A9B` dan offset 2px.
   - Menyediakan tautan loncat langsung ke konten utama (`.skip-link` mengarah ke `#main-clay-content`).
4. **Reduced Motion**:
   - Aturan `@media (prefers-reduced-motion: reduce)` diterapkan pada seluruh transisi, animasi, dan skrip scroll-craft. Efek paralaks halus pada `.intro-scroll-plane` langsung dinonaktifkan secara otomatis bila preferensi pengguna aktif.
5. **Dukungan RTL**:
   - Tata letak `[dir="rtl"]` membalik arah flexbox pintu ekosistem, kutipan aksen garis kanan, dan arah panah navigasi.

---

## 5. URL Localhost untuk Pratinjau

Pemilik atau peninjau dapat membuka halaman lokal secara langsung:

1. **Jalankan Web Server Lokal**:
   ```powershell
   cd C:\Users\T6N0CV02S35823C\Github\curriculum-maicn
   python -m http.server 8080
   ```
2. **URL Halaman yang Siap Ditinjau**:
   - Portal Utama Dashboard: `http://localhost:8080/index.html`
   - Kalender Akademik: `http://localhost:8080/kalender.html`
   - Jadwal KBM 21 Guru: `http://localhost:8080/jadwal.html`
   - Modul P5-PPRA: `http://localhost:8080/p5-ppra.html`
   - Buku Kerja & Drive: `http://localhost:8080/buku-kerja.html`
   - Pratinjau Kandidat Terisolasi: `http://localhost:8080/scratch/ag-curr02/index.html`

---

## 6. Batasan yang Belum Diuji & Masalah Tersisa

1. **Uji Perangkat Fisik Nyata**:
   - Pengujian telah diverifikasi pada level DOM, CSS media queries, dan runtime Node.js. Uji sentuhan langsung pada perangkat fisik iPhone (layar 390px Retina) dan interaksi gesture safari mobile disarankan untuk tinjauan manual oleh Pemilik.
2. **Koneksi Jaringan Nyata Google Drive**:
   - Tautan folder Drive sah mengarah ke ID eksternal `1rro943WeUP0d3nYQBkYvCuNdFm7yGWKJ`. Verifikasi ketersediaan izin akses publik Google Drive bergantung pada pengaturan hak akses akun pemilik Google Workspace.
3. **Penyimpanan Status Lokal Saja**:
   - Pencarian guru dan navigasi tab beroperasi di memori peramban (*client-side*). Tidak ada API backend atau mutasi basis data server yang diubah dalam penugasan presentasi ini.
4. **Pernyataan Non-Produksi**:
   - **Lingkungan produksi belum diubah.** Seluruh pekerjaan ini bersifat lokal di repositori kerja dan siap diperiksa Pemilik sebelum diserahkan ke tim integrasi Codex.
