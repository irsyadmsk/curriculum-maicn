# Curriculum: beranda harian dan ruang kurikulum

**Pembaruan:** sudah dirilis atas izin pemilik “boleh”. Flag operasi dan email kini aktif. Lihat [catatan rilis dan bukti Inbox](2026-11-02_CURRICULUM_EXPERIENCE_RELEASE.md). Uraian di bawah merekam tahap kandidat lokal sebelum rilis.

2 November 2026, WIB. Kandidat lokal; belum dirilis, belum dipasang ke database produksi, dan belum mengirim email operasional. Persetujuan rilis tetap diperlukan. Data produksi hanya dibaca untuk ringkasan klinik 2–3 November; tidak dijadikan fixture atau dimasukkan ke repo.

## Perilaku

- Beranda langsung menampilkan jadwal hari ini, perubahan switch yang disetujui, klinik, Senin JP 1, pengumuman, piket, dan agenda kalender terdekat. Di HP, jadwal berlangsung/berikutnya tampil lebih dahulu; jadwal lengkap dapat dibuka. Direktori dan referensi tetap tersedia dalam bagian lipat.
- Data publik harian dibaca melalui satu proyeksi `curriculum_today`, tanpa menunggu pemeriksaan akun. Tidak memuat roster lengkap, foto, email, atau daftar nama peserta privat. Keadaan memuat/gagal/kosong dibedakan. Jadwal reguler tidak ditampilkan sebagai KBM pada hari dengan agenda nonreguler dari kalender sumber.
- Lima lokasi: Kelas X-1, Kelas X-2, Kelas X-3, Lantai 1, Kelas lantai 2 Gedung Maiyoma Chaidir. Admin dapat melengkapi lokasi klinik lama yang sudah disetujui tanpa menciptakan identitas pengaju baru.
- Slot tetap Senin 20.30–21.30 dan Selasa 16.15–17.00 WIB. Tidak menambah Senin sore.
- Pengaju murid memilih nama dan kelas dari roster resmi serta foto; tidak diminta email. Foto diperkecil menjadi JPEG di browser, hanya berada di memori browser dan tabel privat sementara, tidak masuk localStorage, event, email, atau agenda. Transaksi keputusan menghapus byte foto dari data aktif; catatan pemeriksaan tanpa foto tetap ada. Ini bukan janji menghapus data dari cadangan database atau log infrastruktur pihak lain.
- Guru memilih nama resmi, email, dan bukti Drive. Verifikasi identitas tetap pemeriksaan manusia; dropdown, foto, Turnstile, dan alamat email sendiri bukan pembuktian otomatis identitas.
- Persetujuan ditahan sampai identitas diperiksa dan lokasi klinik ditetapkan. Kurikulum saja memutuskan switch; tidak menambahkan persetujuan kedua guru. Penguncian dan alokasi peserta asli tetap digunakan.
- Tabel menampilkan nama, kelas, klinik/waktu/status, bentrok, beberapa ajuan tanpa bentrok, dan murid belum terjadwal. Peserta efektif serta pengecualian dipakai untuk pesan WhatsApp. Belum terjadwal tidak otomatis berarti libur atau pengayaan.
- Teks WhatsApp hanya memakai kegiatan disetujui. Ringkasan Senin mencakup Senin dan Selasa; ringkasan Selasa mencakup Selasa. Tombol salin memiliki fallback pemilihan teks. Aplikasi tidak mengirim WhatsApp.
- Admin/staf dapat membuat pengumuman dengan lampiran tautan HTTPS opsional, mengatur Senin JP 1, melihat notifikasi ajuan dan status antrean email, serta mengatur pengecualian kalender kerja sekolah. Wewenang buku/monitoring/layanan akademik selain switch tetap mengikuti pembatasan server yang sudah ada.
- Ajuan diurutkan berdasarkan waktu masuk. Sabtu/Minggu diarahkan ke Senin atau hari kerja pengganti menurut kalender sekolah. Tidak ada penerimaan otomatis. Pengingat hanya pada hari kerja, untuk antrean yang melewati hari pemeriksaan; keputusan guru dikirim lewat jalur email yang sudah ada.
- Tanda terima dan token pemulihan klinik disimpan tanpa foto. Pemeriksaan status memakai pasangan ID/token melalui Worker, bukan akses publik ke tabel ajuan. Pengiriman ulang memakai token sama dan tidak membuat ajuan ganda.

## Email pagi dan antrean

Penerima ringkasan dan ajuan baru: `irsyad.msk@gmail.com`. Pengirim mengikuti layanan yang sudah tersedia: `Curriculum Irsyads <noreply@irsyads.com>`.

Cron yang sudah berjalan setiap lima menit mencakup pukul 00.00 UTC, yaitu 07.00 WIB. Enqueue memakai `scheduledTime` dan kunci unik per tanggal. Senin/Selasa setelah pukul 07.00 dapat mengejar satu ringkasan yang belum dibuat pada hari itu; tidak membuat ringkasan tanggal sebelumnya. Lease, lima percobaan, batas 23 jam, dan kunci idempotensi provider mencegah pengiriman ulang tak terkendali. Ringkasan hari lama dan pengingat yang sudah kehilangan relevansi dibatalkan. `provider_accepted` berarti penyedia menerima permintaan, bukan bukti kotak masuk.

Rahasia Resend tetap di Supabase; tidak disalin ke Worker publik atau browser. Edge Function memproses sumber `operations` bersama `clinic` dan `school`. Tidak membuat akun/provider/paket baru.

## Sumber dan aktivasi

- UI baru: `assets/curriculum-today.mjs`, `curriculum-operations.mjs`, `curriculum-experience.css`, `requester-identity.mjs`, `curriculum-admin-notifications.mjs`.
- Logika pesan dan penempatan: `assets/curriculum-operations-core.mjs`.
- Router/email: `server/worker.mjs`, `server/curriculum-digest.mjs`.
- SQL kandidat: `server/curriculum-operations.sql`, identik dengan `../irsyads/supabase/migrations/20261102025214_curriculum_experience.sql`.
- Renderer Edge Function merupakan salinan identik dengan impor relatif disesuaikan; perubahan paket `clinic-client.mjs` berasal dari sumber kanonis Irsyads. Bundel review diekspor ulang menggunakan klien kandidat; tidak disunting manual.
- `CURRICULUM_OPERATIONS_ENABLED` dan `CURRICULUM_OPERATIONS_EMAIL_ENABLED` sengaja `false` pada konfigurasi kandidat. Unggah foto baru ditolak sebelum aktivasi, agar foto tidak diteruskan ke backend lama yang belum memiliki aturan retensi.

Setelah izin rilis: snapshot definisi/grant asli dan pemeriksaan drift; pasang migrasi satu kali; pasang Edge Function beserta modul lokalnya; bangun/terbitkan Worker terkurasi dengan flag operasi aktif; verifikasi akun admin/staf asli dan batas tamu; aktifkan flag email untuk penerima yang disetujui. Jangan menjalankan keputusan sekolah, mengirim WhatsApp, atau membuat akun sebagai pengujian. Tahan kedua flag untuk penghentian; jangan menghapus ajuan, event, atau antrean sebagai rollback. Wrapper dan implementasi internal harus dipulihkan sebagai paket kompatibel jika perlu mengembalikan kontrak sebelum migrasi.

## Bukti lokal

- Pengujian PGlite membuktikan identitas kanonis, penolakan foto kosong/MIME kosong, pemeriksaan sebelum persetujuan, penghapusan foto atomik, batas tamu/staf, switch murid tanpa email, keputusan kurikulum, kalender kerja, enqueue Senin/Selasa idempoten, serta lease/receipt pengiriman. Ini bukan pengujian koneksi Postgres produksi serentak.
- Unit dispatcher memakai provider palsu; tidak ada email uji nyata. Teks dan tabel email dihasilkan dari snapshot server, bukan penerima/isi dari browser.
- Browser IAB lokal: 19 halaman publik/guru/admin diperiksa pada ukuran HP dengan akun contoh; tidak ditemukan overflow halaman. Dialog klinik pada viewport 320 memiliki lebar isi sama dengan area tampil. Jadwal, tabel konflik/belum terjadwal, editor pengumuman tanpa lampiran, draf tanpa foto, pengiriman dengan foto sintetis, dan pemulihan status diperiksa. Clipboard cocok dengan teks WA yang ditampilkan.
- Pemeriksaan menemukan urutan dependensi skrip lama yang harus tetap sinkron pada halaman jadwal/presensi; penundaan skrip dibatasi pada beranda. CAS draf diperbaiki agar penulisan token/receipt sendiri tidak dianggap perubahan tab lain.
- Suite luas kandidat sebelumnya: 93/95; dua kegagalan lama mengenai direktori Drive lokal yang tidak tersedia dan klaim Tahfidz 30 Juz yang tidak dipublikasikan. Tidak membuat folder atau klaim palsu demi meluluskan tes tersebut. Hasil akhir terarah dicatat saat handoff.
- Belum ada pengukuran LCP/INP lapangan, uji semua alur dengan akun sekolah asli, persetujuan operasional baru, rilis, atau penerimaan email nyata dari fitur baru.

Pratinjau lokal sintetis: `node scripts/build-site.mjs`, lalu `node scripts/preview-experience.mjs`; buka `http://127.0.0.1:4581/` dan `http://127.0.0.1:4581/__fixture/admin`. Server mengikat loopback, menolak host lain, tidak meneruskan panggilan ke database/provider asli, dan mengganti roster privat dengan nama contoh. Jangan merilis server ini.

## Verifikasi di checkout utama

Sesudah penerapan: build 116 aset terkurasi; 35 tes terarah Curriculum dan 10 tes SQL/dispatcher di Irsyads lulus. Pemeriksaan diff tidak menemukan whitespace error. Tidak melakukan commit, push, deploy, migrasi produksi, atau pengiriman pesan. Perubahan Gate yang sempat ikut tersalin dari snapshot lama sudah dipulihkan; diff Irsyads hanya meliputi paket/fitur Curriculum. Pratinjau akhir dijalankan dari checkout utama di port 4581.

Tambahan akhir: 19 tes SSO/gateway/proyeksi jadwal juga lulus (total 64 tes terarah lintas dua checkout). Pembersihan rekursif Folder UJI/curriculum-experience ditolak pemeriksaan otomatis dengan pesan blocked by policy; folder tetap utuh dan tidak boleh dipakai untuk menimpa checkout utama karena memuat snapshot lama layanan lain. Pratinjau berjalan dari sumber utama, bukan folder uji.
