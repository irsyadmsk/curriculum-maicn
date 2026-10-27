# Klinik berdasarkan tanggal, arsip laporan, dan blok Senin JP 1

26 Oktober 2026 · pratinjau lokal, belum dirilis. Melanjutkan CURR-01 dan redesign/roster sebelumnya tanpa mengganti ID pekerjaan lama.

## Perilaku yang sudah diterapkan

- Klinik membuka pekan aktual dalam WIB. Sesi tetap Senin 20.30–21.30 dan Selasa 16.15–17.00; navigasi tanggal tidak lagi terbatas enam pekan. Formulir menolak tanggal di luar tahun pelajaran 2026/2027.
- Setelah jam selesai, catatan otomatis tergolong arsip. Ini proyeksi waktu, bukan pemindahan/penghapusan. Arsip dapat difilter tanggal, kelas, status, ditinjau, lalu dicetak/disimpan PDF melalui dialog cetak browser.
- Usulan boleh berisi 1–3 mapel apa saja. Draf perangkat belum menjadi pengajuan server. Penyimpanan draf memakai kunci baru, pemeriksaan revisi mentah, dan Web Locks. Data tidak terbaca/berubah di tab lain menahan simpan; isian tetap terbuka.
- Kunci lama `maicn_klinik_bookings` tidak ditulis, dikosongkan, atau diisi ulang. Status Approved lama tetap terbaca sebagai catatan asal, dengan persetujuan server belum diverifikasi. Tautan bukti hanya dapat diklik jika http(s); teks bukti lama tetap dapat dicetak. Cadangan berisi byte string mentah kedua namespace.
- Persetujuan bukan tombol admin lokal lagi. Writer server menuntut akun sah, hak admin/pengelola kurikulum, revisi terbaru, alasan dan satu mapel dari usulan. Bentrok guru/kelas dan pengulangan mapel per kelas/pekan ditolak secara atomik. Mengedit jadwal yang disetujui mengembalikannya ke pending; catatan laporan arsip tetap dapat diperbarui dengan riwayat revisi.
- Beranda menempatkan Klinik sebagai agenda utama, lalu blok Senin JP 1, sebelum jadwal reguler. Hanya persetujuan server yang masuk agenda Klinik; penanda baru/diperbarui dan sudah dibaca merupakan notifikasi dalam situs. Tidak ada pengiriman email/WhatsApp/push.
- Senin JP 1 (07.00–07.40 WIB) menggunakan pilihan per tanggal: Upacara, KTI, Wali Kelas, berlaku untuk tiga kelas X. Jadwal reguler memiliki tombol pada baris JP 1 dan kartu HP; dialog membuka editor Studio dengan tanggal yang sama. Tidak mengubah data sumber jadwal mingguan. Kegiatan yang belum ditetapkan tidak diasumsikan Upacara.
- Footer bersama memberi kredit `Irsyads · irsyads.com`. Identitas madrasah, roster 57+1, nilai kosong/nol dan data akademik sumber dipertahankan.

## Studio dan database

Source Studio di repo saudara `../irsyads` memiliki `ClinicReview.tsx`, `MondayBlock.tsx`, dan adapter `clinic-workflow.ts`. Tautan `?clinic=review#kurikulum` membuka tab klinik; `block-date=YYYY-MM-DD` mengarahkan editor blok. Rencana perangkat yang sudah ada dipertahankan dalam bagian terlipat, terpisah dari antrean server.

Core/client kanonis berada di `../irsyads/packages/curriculum-clinic/`; ekspor dua berkas ke repo ini melalui `node scripts/export-curriculum-clinic.mjs` dari repo Irsyads. Dua salinan diperiksa sama persis oleh tes. Tidak mengedit ekspor navigasi/session Irsyads yang sudah ada.

Paket SQL dan recovery yang **belum diterapkan**: `../irsyads/ops/review/clinic-workflow-20261026/{prepare.sql,close-writes.sql,README.md}`. Sumber `CLINIC_REMOTE_ENABLED` tetap false untuk kedua situs. Antarmuka menyatakan pengiriman/konfirmasi lintas perangkat menunggu aktivasi; draf dan arsip perangkat sudah dapat digunakan.

Paket ini tidak otomatis memberikan peran pada akun mana pun. Sebelum aktivasi, periksa akun pemilik, hak admin/pengelola, katalog guru native, kuota gratis, baseline rilis, dan hasil pemeriksaan native. `matriks_guru` sumber memiliki beberapa kode MS yang sama: opsi draf memakai nama lengkap agar pilihan tidak tertukar, sedangkan pengiriman memakai katalog server dengan PK yang sah. Jangan mengarang kode atau menimpa katalog guru tanpa tinjauan.

## Pemeriksaan lokal

- 47 tes repo Curriculum lulus: termasuk regresi roster, rapor/angka nol, navigasi dan fitur lama, serta 8 tes alur Klinik/blok baru.
- 33 tes utama terkait curriculum model/review/workspace/SQL lulus di repo Irsyads; 3 tes baru komponen aktual untuk persetujuan, penolakan sumber/hak usang, dan blok Senin juga lulus. Setelah perubahan tampilan kecil, tes formulir klinik lama diulang terarah dan lulus. Total 83 tes unik pada cakupan yang disebutkan, bukan seluruh monorepo.
- Targeted TypeScript untuk workspace Curriculum/Brand dan impor komponennya lulus; modul JS baru lolos pemeriksaan sintaks. Bundel pratinjau komponen aktual berhasil. Ini bukan klaim full Astro/monorepo build atau paket produksi.
- `docs/clinic-20261026/layout-results.json`: 52 kombinasi 13 halaman × 320/390/768/1366 px; tidak ada overflow horizontal atau konten terkunci oleh modal lama.
- Browser aktual: draf mapel bebas tersimpan dan pulih sesudah reload pada origin uji `127.0.0.1:4571`; memilih pengampu dengan kode sumber berulang tidak tertukar. Filter arsip X-1 menghasilkan tiga catatan di pratinjau/HTML laporan. Formulir HP 390 px, navigasi kalender/klinik, dan klik JP 1 ke tanggal Studio diperiksa.
- Pratinjau Studio aktual + PGlite sintetis: persetujuan satu mapel menghasilkan revisi 2 dan hanya sesi tersebut masuk feed publik; penetapan KTI Senin menghasilkan revisi 1. Sumber fixture tidak berisi data murid/sekolah dan direset saat proses pratinjau dimulai ulang.

Screenshot dan log ada di `docs/clinic-20261026/`. Pemeriksaan UI/SQL sintetis, preview cetak, dan CSS viewport tidak membuktikan native Supabase Auth/PostgREST/RLS, hak pemilik produksi, pengiriman nyata, printer fisik, atau penerimaan pada HP pemilik.

## Membuka hasil dan melanjutkan

- Curriculum: `http://127.0.0.1:4570/index.html`, `klinik.html`, `jadwal.html`.
- Studio contoh lokal: dari repo Irsyads jalankan `node scripts/preview-clinic-workflow.mjs`, lalu buka `http://127.0.0.1:4572/`. Semua perubahan pada preview ini hanya fixture RAM.
- Hasil sebelumnya tetap berlaku: `2026-10-26_MOBILE_REDESIGN_LOCAL.md` dan `2026-10-26_CLINIC_CLICK_AND_STUDENT_ROSTER_LOCAL.md`.
- Backup sumber sebelum perubahan sesi ini: `%TEMP%/curriculum-clinic-20261026/`. Browser origin pemilik di 4570 tidak dipakai untuk menulis data contoh.

Belum commit/push/PR/Actions/deploy/SQL produksi/Docker atau perubahan flag layanan lain. AGENTS.md dan kebijakan release/free-only mewajibkan hasil diselesaikan, diperiksa dan persetujuan rilis baru sebelum aktivasi. Jangan merilis seluruh checkout Irsyads yang masih memiliki pekerjaan lain; siapkan kandidat terarah dari baseline rilis yang diketahui. Recovery mempertahankan tabel, riwayat, draf dan source lama; lihat README paket SQL.
