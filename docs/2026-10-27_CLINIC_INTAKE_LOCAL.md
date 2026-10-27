# Klinik dan pengayaan per klinik — 27 Oktober 2026

**Pembaruan:** Klinik baru dan layanan akademik sudah tayang atas instruksi pemilik. Lihat [catatan rilis online](2026-10-27_ACADEMIC_SERVICES_RELEASE.md). Uraian berikut merekam tahap lokal sebelum pemasangan.

Status: implementasi lokal, belum commit/push/deploy, belum dipasang ke database produksi, belum mengirim email nyata. Source Studio berada di sibling `../irsyads`; pertahankan seluruh pekerjaan lain yang sudah dirty di sana.

## Keputusan pemilik

- Daftar murid hanya dari workbook resmi. Guru dan murid boleh memilih satu kelas atau beberapa nama lintas kelas. Pada pilihan per nama, kelas tidak wajib dipilih; kelas asal hanya informasi.
- Murid memilih tepat satu mapel dari daftar; tidak diminta email atau bukti.
- Guru mengajukan tanpa login. Nama pengampu dari dropdown; mapel mengikuti katalog guru pada server. Email dan bukti file Google Drive wajib. Nama guru yang dipilih tidak membuktikan identitas pengusul: admin memeriksa bukti dan email.
- Satu murid boleh beberapa klinik, termasuk pada hari yang sama, selama waktunya tidak bertabrakan. Waktu dapat dibagi dalam jendela Senin 20.30–21.30 atau Selasa 16.15–17.00 WIB. Contoh dua klinik berurutan: 20.30–21.00 dan 21.00–21.30.
- Duplikat ajuan pending tidak langsung ditolak. Studio menampilkan nama murid, mapel dan jadwal ajuan lain. Ketika menerima, admin memilih tujuan setiap murid yang bertabrakan berdasarkan bukti. Server menyimpan perubahan seluruh klinik terdampak dalam satu transaksi dan memeriksa ulang semua versi. Guru juga tidak dapat mengampu dua klinik bersamaan. Kelas sama boleh dua kelompok paralel dengan peserta dan pengampu berbeda.
- Pengayaan dipetakan **per klinik/mapel** pada kelas terkait. Untuk klinik A, calon pengayaan diambil dari kelas terkait dan mengeluarkan murid yang sudah ditempatkan pada klinik lain pada waktu yang sama. Murid yang dikecualikan ke klinik B dicatat sebagai peserta klinik B, bukan pengayaan A. Calon pengayaan baru menjadi daftar ditetapkan setelah admin menyelesaikan seleksi dan mengonfirmasi penetapan.
- Penetapan mengunci peserta/jadwal/status klinik. Admin dapat membuka seleksi kembali untuk perubahan; riwayat keputusan klinik tetap terjaga.

## Data sumber

`scripts/import-student-roster.py` membaca workbook tanpa mengubahnya. Verifikasi ulang menghasilkan 19 murid per kelas (57 ditempatkan) dan satu murid belum memiliki kelas. Hash tetap `4aae60c0dd2e36161f7715ffbd57786656ab96a0d13a390adeaa765c917346da`.

Nilai, peringkat dan catatan penempatan tidak dipakai untuk keputusan klinik. Murid tanpa kelas dapat dipilih lewat mode per nama, karena tidak ada kewajiban memilih kelas. Roster lengkap, workbook dan SQL seed berada di lokasi diabaikan Git. Endpoint katalog baru hanya memaparkan ID teknis, nama dan kelas yang diperlukan pemilihan peserta, serta nama/kode/mapel pengampu. Roster lengkap lama tetap terlindungi akun guru. Bukti, email dan nama peserta ajuan tidak dimasukkan ke agenda publik.

## Berkas utama

- Formulir: `assets/clinic-intake-form.mjs`, `assets/clinic-intake-core.mjs`, `assets/clinic-page.mjs`.
- Backend kandidat: `server/clinic-intake-v2.sql`, kemudian `server/clinic-allocation.sql`. Membutuhkan migrasi Klinik 26 Oktober yang sudah ada. Tidak boleh dijalankan otomatis. Kandidat menolak bila bentuk writer/constraint dasar telah berubah, agar operator meninjau ulang.
- Seed privat: `private-inputs/clinic-roster-v2.sql`, dihasilkan dengan argumen `--clinic-sql-output`. Belum dijalankan. Tidak ada data murid di kandidat SQL publik.
- Studio: `ClinicParticipants.tsx`, `ClinicReview.tsx`, `lib/clinic-workflow.ts` dan paket bersama di sibling Irsyads. Eksportir paket mencakup core intake baru.
- Pengiriman: `server/clinic-email.mjs`, scheduled handler pada Worker, antrean privat pada kandidat SQL.
- Template contoh dapat ditinjau pada `clinic-intake-20261027/email-terima.html` dan `email-tolak.html`; seluruh identitas contoh.

## Email keputusan

Pengirim template: `Curriculum Irsyads <noreply@irsyads.com>`. Hanya keputusan approved/rejected untuk ajuan guru yang membuat antrean, dalam transaksi yang sama dengan keputusan. Murid tidak membuat email. Penerima berasal dari data ajuan di server, bukan argumen penerima dari browser.

Worker memproses maksimal 10 pesan per panggilan terjadwal. Lease mencegah pemrosesan bersamaan, kunci idempotensi mengikat ajuan/revisi, maksimum lima percobaan dan batas 23 jam menjaga retry dalam jendela idempotensi provider. Kegagalan/hasil tidak pasti masuk pemeriksaan; perubahan keputusan menandai antrean lama superseded. Status `provider_accepted` berarti layanan menerima permintaan, bukan bukti email sampai ke kotak masuk. Tidak ada log email, bukti, nama murid, atau alamat jaringan mentah.

`CLINIC_V2_ENABLED` dan `CLINIC_EMAIL_ENABLED` pada konfigurasi lokal tetap `false`. Jadwal kandidat Worker setiap lima menit hanya memproses bila flag email aktif dan `RESEND_API_KEY` tersedia. Belum ada perubahan DNS/domain/secrets, pemasangan cron online, atau perubahan biaya.

## Verifikasi

- Run seluruh repo publik sebelum tambahan tes dispatcher: **73/74 lulus**. Satu kegagalan lama di `tests/max-ui-ux.test.mjs` mengharapkan klaim “Tahfidz 30 Juz” di `unggulan.html`; kedua berkas tersebut tidak diubah dalam pekerjaan ini. Tidak menambahkan klaim program agar tes lama lulus.
- Scope Klinik/Worker/notifikasi/roster: **33 tes** pada lima berkas terkait; kontrak formulir dipindahkan ke modul formulir dinamis.
- Sibling Irsyads: **9 tes lulus**: dua skenario SQL PGlite dengan assertion lintas peran/konflik/antrean/pengayaan, dan tujuh tes React Klinik/Senin. Tambahan kasus mencakup peserta sama pada dua klinik berurutan di hari yang sama, paralel pada kelas sama dengan murid berbeda, peringatan ajuan ganda bernama, dan otorisasi penetapan pengayaan.
- TypeScript terarah: tiga root Studio, nol diagnostic (termasuk dependency yang diimpor), memakai deklarasi Astro untuk aset CSS.
- Build aset terkurasi: 86 aset; file privat mentah tidak diunggah sebagai root situs.
- Browser Chrome headless terisolasi: 390 dan 1366 px, nama contoh, pilih kelas/per nama, pemilihan lintas kelas tanpa isian kelas, mapel guru otomatis, email/bukti wajib, embed Drive, pengiriman contoh murid/guru, tanpa galat JavaScript dan tanpa overflow dialog. Drive, Turnstile, database dan penerimaan pengiriman semuanya stub lokal. Berkas bukti di `scratch/intake-browser-results.json` dan `scratch/intake-teacher-{390,1366}.png`.
- Ini bukan bukti Auth/PostgREST/Postgres produksi, penguncian pada koneksi Postgres serentak asli, verifikasi identitas guru, file Drive sungguhan, penerimaan email, atau persetujuan pemilik.

## Tinjau dan lanjutkan

Pratinjau contoh: `node scripts/build-site.mjs`, lalu `node scripts/preview-clinic-intake.mjs`, buka `http://127.0.0.1:4576/klinik.html`. Server mengikat loopback, menolak koneksi host lain, dan tidak meneruskan fetch ke layanan asli. Jangan merilis server contoh.

Sebelum aktivasi online, tinjau perubahan kedua repo, snapshot fungsi/constraint/grants aktual dan cadangan; periksa seed serta katalog guru; periksa domain pengirim dan batas paket email yang sudah ada. Pasang kedua kandidat SQL sesuai urutan dan seed privat hanya setelah otorisasi rilis. Rilis Worker dan Studio sebagai satu perubahan yang kompatibel, aktifkan alur v2 sesudah kontrak server terverifikasi, lalu uji satu ajuan dan satu keputusan yang disetujui pemilik. Email nyata membutuhkan aktivasi terpisah setelah provider/domain siap. Untuk pemulihan, tahan flag/email terlebih dahulu; jangan menjatuhkan tabel baru atau menghapus ajuan/antrean yang sudah tercatat. Klinik yang masih menjadi tujuan pengecualian klinik lain tidak dapat dibatalkan atau diubah jadwal/mapelnya sampai keputusan terkait ditinjau. Ajuan lama tanpa peserta tetap riwayat dan perlu dibuat ulang dengan daftar resmi untuk persetujuan baru.

## Koreksi lanjutan pemilik: lintas kelas dan pengecualian

Mode per nama sekarang menyimpan classroom=null dan ID murid lintas kelas dari roster resmi. scope_classrooms diturunkan server dari nama yang diajukan; bukan kelas rekaan. Mode satu kelas tetap mengembangkan seluruh anggota kelas.

participant_ids mempertahankan daftar pengajuan. approved_participant_ids adalah daftar efektif setelah keputusan. participant_exceptions menyimpan ID murid, klinik tujuan dan alasan. Pemilik keputusan tetap admin; tidak ada algoritma yang otomatis memenangkan mapel/per nama tertentu.

Studio mewajibkan pilihan klinik tujuan bagi setiap bentrok sebelum membuka konfirmasi. Konfirmasi memuat nama dan tujuan; peer_revisions mengikat seluruh versi klinik terkait. RPC alokasi mengunci institusi, memeriksa ulang calon/versi/izin, memperbarui peserta dan pengecualian, menyimpan riwayat allocate, serta mengantrekan email semua guru terdampak secara atomik. Jika penerimaan gagal (termasuk guru bentrok), seluruh perubahan klinik lain dan antrean dibatalkan. Pilihan yang mengosongkan salah satu klinik ditahan; admin perlu meninjau keputusan klinik itu tersendiri.

Bila murid kemudian dipindahkan lagi dari B ke C, catatan pengecualian terdahulu yang menunjuk B ikut diarahkan ke C, dengan revisi dan pemberitahuan baru. Tidak ada nama yang tertinggal sebagai tujuan yang sudah tidak sesuai. Pengayaan yang sudah ditetapkan perlu dibuka kembali sebelum perubahan terkait.

Email penerimaan menyebut nama dan kelas asal peserta efektif. Email kelas berbunyi diterima untuk kelas tersebut, kecuali nama yang masuk klinik lain beserta mapel/pengampu dan alasannya. Jika kelas telah diberi email penerimaan sebelumnya, perubahan mengantrekan email Penyesuaian peserta klinik; antrean lama yang belum dikirim ditandai superseded. Template contoh tambahan: clinic-intake-20261027/email-per-nama.html dan email-penyesuaian.html.

Verifikasi tambahan lokal: SQL membuktikan lintas X-1/X-2, penerimaan kelas lebih dahulu maupun per nama lebih dahulu, pengecualian bernama, retry idempoten, penolakan versi usang, rollback perubahan lintas klinik bila guru bentrok, pembaruan tujuan pengecualian berantai, email efektif, dan perlindungan data agenda publik. React membuktikan keputusan memerlukan pilihan tujuan dan menampilkan nama/tujuan pada konfirmasi. Browser 390/1366 px memilih dua nama dari kelas berbeda tanpa isian kelas; mode kelas tetap memiliki pilihan kelas. Ini tetap bukti sintetis lokal, bukan hasil server produksi atau pengiriman nyata.
