# curriculum-maicn/assets

Semua skrip dan gaya halaman. `scripts/build-site.mjs` menyalin setiap berkas css/js/mjs/json/gambar/font/docx/pdf di sini ke `.site/assets/`; aksesnya ditentukan `routeAccess()` di `access-core.mjs`.

## Asal berkas

| Berkas | Asal | Boleh disunting di sini? |
|---|---|---|
| `access-core.mjs`, `clinic-core.mjs`, `clinic-client.mjs` | Salinan identik `../../irsyads/packages/curriculum-clinic/` | Tidak. Ubah sumbernya, salin, cek `cmp` |
| `irsyads-v1/*` | Ekspor `irsyads/packages/design-tokens/standalone/v1` dan `scripts/export-s3-navigation.mjs curriculum` | Tidak |
| `student-roster-data.js` | Dibuat `scripts/import-student-roster.py` dari workbook pemilik | Tidak; privat, di-gitignore |
| Lainnya | Asli repo ini | Ya |

## Kelompok berkas asli

- Halaman/fitur: `clinic-page.*`, `clinic-home.mjs`, `monday-block.mjs` (blok Senin), `grade-page.mjs`, `student-info.mjs`, `account-page.mjs`, `kokurikuler-records.js`, `report-roster.js`, `student-roster*.js`.
- Data & akses: `curriculum-data.js` (Supabase), `curriculum-access.mjs`, `curriculum-runtime.mjs`, `irsyads-session.js`, `terminology.mjs`.
- Login lama: `app.js` (Firebase Auth).
- UI: `curriculum-ui.*`, `dashboard-clay.*`, `audience.css`, `styles.css`, `ecosystem.*`.
- `templates/`: berkas unduhan guru (akses `teacher`).

Berkas yang termasuk `PRIVATE_ASSETS` (`student-roster-data.js`, `report-roster.js`, `kokurikuler-records.js`) dan `templates/` hanya dilayani untuk peran guru ke atas.
