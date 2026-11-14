# Perbaikan pengajuan dan keputusan Curriculum

Pembaruan atas instruksi pemilik untuk menerima ajuan terlebih dahulu meski bukti belum tersedia: versi online terbaru `29c99f71-530e-47ba-8098-571ae74dd4d6`, migrasi `20261102044347_curriculum_intake_tolerant`. Bukti/foto/email boleh kosong pada intake; status tetap pending dan admin menentukan keputusan. Identitas lama guru dapat dikenali dari kode pengampu. Penerimaan membuka dialog identitas/lokasi langsung, tanpa meninggalkan ajuan. Status draf, percobaan kirim belum dipastikan, dan ajuan yang sudah diterima server dibedakan. Atas permintaan pemilik, rangkaian tes tambahan tidak dijalankan untuk pembaruan ini; hanya kompilasi sumber, build aset, dan deployment. Angka tes di bawah berlaku untuk versi sebelumnya.

Status: **sudah online**, 2 November 2026 pukul 11.21 WIB, setelah pemilik meminta “oke tayangkan ke online dulu untuk langsung tes dan cek”. Worker aktif `dbbd14d7-bab7-45c4-96f2-d2fdd30c58ff`, menggantikan `2fa8afa2-d2a7-4db2-95c7-39097502c261`. Perbaikan mencakup pengajuan, Terima/Tolak, kokurikuler bebas, pemindahan kelas klinik, dan penjelasan syarat tombol. Laporan harian gabungan belum termasuk rilis ini.

## Perubahan yang dapat ditinjau

- Formulir klinik tidak lagi mewajibkan Web Locks. Browser yang mendukungnya tetap memakai penguncian; browser lain memakai pemeriksaan draf terakhir sebelum menulis. Kegagalan penyimpanan tetap dijelaskan dan tidak menghapus data lama.
- Tombol Ajukan menampilkan proses membuka dan kegagalan katalog dengan batas waktu. Isian wajib diberi pesan, difokuskan, dan bagian tanggal yang tertutup dibuka. Bukti pengiriman baru disiapkan setelah verifikasi permintaan selesai, agar percobaan yang belum terkirim tidak mengunci perubahan isian.
- Murid yang memilih nama sendiri otomatis masuk pilihan peserta per nama. Foto tetap diperlukan untuk pengiriman. Foto tidak disimpan dalam draf atau receipt.
- Ruang klinik memuat ajuan otomatis. Terima menjelaskan kebutuhan identitas, lokasi, pengampu, alasan, dan penempatan. Tolak tetap tersedia dengan alasan, termasuk ketika ada edit formulir yang belum disimpan. Dialog keputusan tetap meminta konfirmasi dan membaca ulang revisi/hak akses.
- Ajuan klinik lama tanpa detail identitas memiliki tindakan **Lengkapi identitas & lokasi**. Guru dicocokkan dengan pengampu serta email/bukti lama; murid harus dipilih dari roster dan menyertakan foto. Tidak ada persetujuan otomatis atau pengecualian foto untuk murid.
- Kurikulum dapat mengubah tujuan menjadi satu kelas atau pilihan nama. Dialog menampilkan daftar tujuan dan alasan. Setelah pemindahan disimpan, status menjadi **menunggu**, termasuk jika sebelumnya disetujui. Pemeriksaan bentrok dan persetujuan ulang tetap diperlukan. Pemindahan peserta dan lokasi adalah pilihan yang berbeda; lokasi tetap diperiksa sebelum penerimaan.
- Nama kegiatan kokurikuler dapat ditulis bebas. Jika daftar kolaborasi kosong, tersedia penjelasan dan tombol **Ajukan kegiatan sendiri**. Kolaborasi masih harus mengacu pada proyek yang sudah disetujui.
- Pesan kegagalan tampil dekat tindakan; tombol yang belum memenuhi syarat menjelaskan isian yang kurang. Selama permintaan berjalan, tombol memakai status proses. Ruang kurikulum dimuat kembali saat pulih melalui Back/Forward cache browser.

## Temuan dan batas diagnosis

Kode lama memang menolak penyimpanan ketika Web Locks tidak tersedia, mengunci kelas/peserta, mensyaratkan identitas tanpa jalur pelengkapan bagi ajuan lama, dan memblokir Tolak saat ada edit belum tersimpan. Validasi bawaan browser juga dapat menghentikan submit sebelum handler berjalan, termasuk pada bagian tertutup. Tombol Ajukan sendiri berhasil dibuka dalam reproduksi DOM tamu; ini tidak membuktikan penyebab tunggal pada perangkat pelapor.

Halaman produksi dan katalog dibaca tanpa mengubah keputusan. Log Postgres terpilih tidak menunjukkan kegagalan permintaan pada jendela pemeriksaan. Semua percobaan menulis untuk regresi menggunakan PostgreSQL lokal sintetis dan transport formulir sintetis.

## Database dan akses

Migrasi produksi `20261102042132_curriculum_action_repair.sql` sama dengan `server/curriculum-action-repair.sql`. Nama file lokal diselaraskan dengan timestamp migrasi yang benar-benar dipasang melalui Supabase. Migrasi menambah dua RPC, tanpa mengubah data operasional saat pemasangan:

1. `curriculum_clinic_retarget`: hanya reviewer aktif; scope sekolah/tahun, revisi, token idempoten, alasan, roster, status, arsip, pengayaan, serta dependensi alokasi diperiksa. Perubahan dicatat dalam event dan kembali menunggu.
2. `curriculum_clinic_verify_legacy`: hanya reviewer aktif untuk ajuan pending tanpa detail identitas. Identitas dan bukti melalui validator yang sama; receipt audit menyimpan fingerprint foto, bukan foto. Pelengkapan ini memakai antrean notifikasi pengaju/admin yang sudah ada. Foto aktif dihapus oleh transaksi keputusan sebagaimana rilis sebelumnya.

RPC tidak dapat dijalankan tamu atau langsung oleh service role. Tabel privat dan batas peran tetap seperti rilis sebelumnya. Pemasangan SQL dan Worker dilakukan setelah konfirmasi pemilik; tidak membuat keputusan produksi, mengirim pesan manual, commit, push, Actions, atau deployment Studio.

## Verifikasi

Hasil akhir: 54 tes terarah lulus (42 pada Curriculum, 12 pada komponen/SQL bersama). Regresi PostgreSQL baru mencakup 27 pemeriksaan; semuanya sintetis. Ekspor komponen dan build 118 aset selesai. Paket tujuh modul Worker lolos `wrangler deploy --dry-run` tanpa deploy.

- Regresi DOM menjalankan modul halaman asli melalui JSDOM: formulir tamu terbuka, pesan isian wajib muncul, pengiriman guru tanpa Web Locks menghasilkan receipt, dan proyek bernama bebas dapat dikirim tanpa proyek induk.
- Regresi React memeriksa Terima/Tolak, syarat identitas, penolakan dengan edit belum tersimpan, konfirmasi perpindahan X-1 ke daftar X-2, perubahan hak akses/revisi, alokasi bentrok, dan pengayaan.
- PostgreSQL lokal memakai migrasi dasar serta validator/trigger asli: identitas lama, foto wajib, penghapusan foto, receipt tanpa foto, pemindahan peserta, token/revisi, bentrok guru, pengayaan terkunci, role, dan pengajuan kokurikuler bebas.
- Tes Worker memeriksa batas tamu dan routing RPC baru. Build aset terkurasi tetap melewati gateway untuk data privat.

Tes di atas adalah bukti lokal/sintetis. Verifikasi produksi setelah rilis: 17 hash aset publik sesuai paket, sepuluh batas akses sesuai, API harian 200 dengan satu klinik disetujui, serta penolakan RPC baru bagi tamu. Metadata build `/asset-manifest.json` sengaja 404 oleh allowlist Worker; pemeriksaan awal menganggapnya aset publik lalu diperbaiki menjadi pemeriksaan penutupan metadata, tanpa mengubah aplikasi.

Pemeriksaan peran pada database asli dalam transaksi rollback membuktikan staf aktif dapat mengakses jalur reviewer, scope yang salah ditolak, dan konfirmasi identitas yang belum lengkap ditolak. Kedua RPC hanya memiliki grant authenticated, tanpa grant anon/service_role. Jumlah sebelum dan setelah rilis tetap delapan ajuan klinik, 13 event, nol ajuan akademik, dan nol detail/foto identitas. Tidak membuat ajuan contoh atau keputusan untuk menguji produksi.

Ini belum bukti login dan interaksi HP/laptop dengan akun sekolah asli. Kontrol browser lokal sebelumnya dinonaktifkan oleh pengaturan Work; pembatasan tidak dilewati. Advisor mencatat WARN SECURITY DEFINER callable by authenticated untuk jalur RPC terbatas ini; fungsi tetap memeriksa reviewer aktif di server dan grant tabel privat tidak dibuka. Rujukan: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable.

Bundling biasa pada percobaan dry-run pertama ditolak Windows ketika executable esbuild menulis output (`Access is denied`). Paket divalidasi dengan metode modul tanpa bundling yang juga digunakan pada rilis sebelumnya. Paket, config, dan hash sumber tersimpan privat di `C:/Users/T6N0CV02S35823C/.codex/releases/curriculum-action-repair-20261102/`.

## Rilis online

Kedua RPC dipasang melalui migrasi, lalu Worker dan 18 aset yang berubah diunggah dari paket yang telah diuji. Cloudflare melaporkan versi baru aktif 100%. Edge Function email, jadwal cron, dan flag email dipertahankan. Bukti privat: `C:/Users/T6N0CV02S35823C/.codex/releases/curriculum-action-repair-20261102/` berisi baseline, pemeriksaan database, daftar migrasi, hash sumber, cek HTTP, dan versi Cloudflare sebelum/sesudah. Pengecekan login/klik akun sekolah diserahkan untuk uji online pemilik.

Jika paket harus dipulihkan, Worker/aset dapat dikembalikan ke versi sebelum perbaikan. RPC tambahan tidak dipanggil oleh frontend lama; jangan menghapus ajuan, identitas, receipt, atau event yang sudah tercatat. Pemindahan atau keputusan yang kemudian dilakukan pemilik tidak diurungkan diam-diam.
