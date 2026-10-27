# curriculum-maicn — curriculum.irsyads.com

> **⚠️ ATURAN KERJA WAJIB untuk AI dan pengembang (pemilik, 27 Okt 2026)**
>
> 1. **Satu versi, satu branch `main`.** Perbaikan dan pembaruan langsung ke kode. Dilarang membuat branch, worktree, salinan folder, atau berkas versi (`-v2`, `-baru`, `-lama`, `-backup`, `copy`) di repo ini.
> 2. **Ragu atau fitur baru yang perlu uji coba →** kerjakan di `C:\Users\T6N0CV02S35823C\Github\Folder UJI\<repo>-<fitur>`, bukan di sini.
> 3. **Uji berhasil →** terapkan ke repo ini dengan mengganti kode lama, jalankan tes, commit ke `main`, lalu hapus folder ujinya. **Uji gagal →** hapus folder ujinya.
> 4. **Jangan membuat repo bengkak:** screenshot, log, hasil build, arsip, dan berkas sementara tidak disimpan di repo ini.
> 5. Rilis/deploy tetap butuh konfirmasi pemilik; commit yang belum boleh tayang memakai awalan `[skip ci] [CF-Pages-Skip]`.
>
> Rincian: `README.md` di folder `Github` dan `Folder UJI\README.md`.


Portal **Kurikulum MA Insan Cendekia Nusantara** ("Curriculum OS"): jadwal KBM & guru, kalender akademik, KOM, struktur kurikulum & profil lulusan, program unggulan, kokurikuler/Panca Cinta, klinik pembelajaran, info murid, serta halaman guru (data murid, presensi & jurnal, rapor/leger, buku kerja, asesmen/bank soal, karakter) dan admin. Isi berbahasa Indonesia.

Situs **HTML/JS statis tanpa framework dan tanpa `package.json`**, dilayani Cloudflare Worker `curriculum-maicn` yang menjadi gerbang akses. Branch kerja: `main`. Repo: `irsyadmsk/curriculum-maicn`.

## Peta berkas

| Lokasi | Isi |
|---|---|
| `*.html` (root) | Satu berkas per halaman. Tiap halaman memuat skripnya sendiri dari `assets/` |
| `data.js`, `master-data.json` | Data akademik utama (`window.MASTER_DATA`: jadwal KBM v2, kalender, klinik, dll.). Dua berkas berisi data yang sama; `build-site.mjs` membuat ulang keduanya untuk publik dan **menghapus** `klinik_pembelajaran.jadwal_booking` |
| `assets/access-core.mjs` | Peran (`guest` < `member` < `teacher` < `curriculum` < `admin`) dan klasifikasi halaman: `PUBLIC_PAGES`, `TEACHER_PAGES`, `REVIEW_PAGES` (admin), `PRIVATE_ASSETS`. **Tambah halaman baru di sini**, kalau tidak ia tidak ikut build |
| `assets/clinic-core.mjs`, `clinic-client.mjs`, `access-core.mjs` | Salinan identik dari `../irsyads/packages/curriculum-clinic/`. Ubah di sana, lalu salin |
| `assets/irsyads-v1/` | Hasil ekspor design-tokens irsyads (tema, palet, bahasa, navigasi layanan). Jangan sunting manual; ekspor ulang dari monorepo |
| `assets/ecosystem.css`, `ecosystem.js` | Adapter yang memetakan token lama ke token bersama dan memasang navigasi ekosistem |
| `assets/app.js` | Login modul dengan **Firebase Auth** (lama; masih dipakai halaman modul/buku kerja) |
| `assets/curriculum-data.js`, `irsyads-session.js`, `curriculum-access.mjs` | Akses data Supabase (proyek irsyads) dan sesi akun irsyads.com |
| `assets/student-roster-data.js` | Roster murid **privat**, dibuat lokal dengan `scripts/import-student-roster.py` dari workbook pemilik. Di-gitignore; wajib ada untuk build |
| `server/worker.mjs` | Worker: normalisasi jalur, cek peran untuk halaman guru/peninjau, permintaan tamu (hash IP dengan HMAC), Turnstile |
| `scripts/build-site.mjs` | Build terkurasi ke `.site/` (tidak pernah mengunggah root repo) |
| `scripts/preview-site.mjs` | Server lokal memakai router Worker sebenarnya: port 4570, atau `--fixtures` di port 4573 dengan akses aktif |
| `tests/*.test.mjs` | `node --test tests/` |
| `docs/` | Catatan kerja bertanggal (riwayat). `docs/archive/` di-gitignore |

## Menjalankan

```bash
node scripts/build-site.mjs           # butuh assets/student-roster-data.js lokal
node scripts/preview-site.mjs         # http://127.0.0.1:4570
node scripts/preview-site.mjs --fixtures
node --test tests/
```

Deploy (`wrangler deploy`, build otomatis menjalankan `build-site.mjs`) hanya dengan persetujuan pemilik.

## Konfigurasi Worker

`wrangler.jsonc`: aset dari `.site`, `run_worker_first: true`, `html_handling: none`. Variabel: `ACCESS_ENABLED` dan `CLINIC_ENABLED` (keduanya `"true"` sejak klinik terverifikasi diaktifkan), `SUPABASE_URL`, `TURNSTILE_SITE_KEY`, serta `SUPABASE_PUBLISHABLE_KEY` dan `PREVIEW_MODE` yang dibaca worker. Rahasia (`REQUEST_HASH_SECRET`, `CLINIC_SERVICE_KEY`, `TURNSTILE_SECRET`) hanya di Cloudflare/`.dev.vars`, tidak di repo. `_headers` mengatur CSP (`frame-ancestors` hanya irsyads.com) dan `noindex` untuk `*.workers.dev`.

## Keadaan backend (campuran)

- Halaman modul/buku kerja: Firebase Auth (sebagian halaman sudah memakai SSO irsyads, lihat `assets/account-sso.mjs`) + koleksi lama (`assets/app.js`). Pemeriksaan ulang 9 Okt 2026: profil yang hilang **tidak** otomatis diberi peran guru; pertahankan.
- Admin, jadwal, kalender: Supabase proyek irsyads.
- Jangan memigrasikan backend, skema, atau login sebagai efek samping perubahan tampilan.

## Jangan

- Meng-commit data murid, `*.xlsx`, `private-inputs/`, atau `assets/student-roster-data.js` (repo ini publik).
- Menganggap menu tersembunyi sebagai otorisasi. Gerbangnya adalah Worker + RLS.
- Menyunting `.site/` (hasil build) atau salinan `irsyads-v1`/`clinic-*` secara langsung.

Catatan tambahan: `IRSYADS_FOUNDATION.md`, `PERAPIAN-2026-10-09.md`, `2026-10-20_NAVIGATION_HANDOFF.md`, `PROMPT_Google_Antigravity.md`, `TAHAPAN_Antigravity_curriculum-maicn.md` adalah riwayat. Detail aset ada di `assets/README.md`.
