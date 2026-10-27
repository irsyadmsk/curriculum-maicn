# Layanan akademik online — 27 Oktober 2026

Pemilik meminta **“aktifkan online”**, lalu **“lanjutkan”**, dan mengonfirmasi Resend sudah tersedia. Paket ini telah diterbitkan pada 27 Oktober 2026 sekitar 21.36 WIB. Tidak ada perubahan paket berbayar, Docker, pembuatan akun, pengiriman pesan uji, atau penetapan murid/guru secara otomatis.

## Alamat

- Pengajuan: <https://curriculum.irsyads.com/layanan.html> — switch, proyek kokurikuler, kolaborasi, remedial dan dispensasi/izin KBM.
- Klinik dan pengayaan: <https://curriculum.irsyads.com/klinik.html>.
- Jurnal dengan SSO: <https://curriculum.irsyads.com/jurnal.html>.
- Beranda/jadwal yang disetujui dan dua guru piket setiap hari: <https://curriculum.irsyads.com/>.
- Keputusan, arsip dan penugasan: <https://studio.irsyads.com/?school=review#kurikulum> → Ajuan akademik, jurnal & penugasan.

## Langkah awal admin

Masuk menggunakan akun Irsyads yang sudah ada. Pada **Penugasan akun**, muat akun Studio, cocokkan akun guru dengan pengampu resmi, kemudian cocokkan akun murid dengan nama roster. Konfirmasi pencocokan guru wajib; satu pengampu aktif tidak boleh tertaut ke dua akun. Setelah itu tetapkan wali kelas dan ketua kelas beserta tanggal berlakunya. Penautan tidak membuat akun atau mengubah peran akun Studio.

Saat rilis belum ada penautan guru/murid atau penetapan wali/ketua yang disimpan. Sebagian nama akun dan workbook berbeda ejaan; sistem tidak menebak identitas. Murid yang belum ditautkan tetap dapat masuk SSO, tetapi pengajuan remedial untuk diri sendiri dan jurnal ketua kelas menunggu penetapan admin. Guru piket memerlukan tautan pengampu yang benar. Admin boleh mengisi jurnal piket; jurnal kelas ditulis wali/ketua yang ditugaskan, sedangkan admin dapat membaca dan mengekspor arsipnya.

## Pemasangan

- Curriculum Worker: `f2786d95-d4ac-4f4a-b403-b3d1e3403448`.
- Studio Worker: `746e7cbd-0fb4-430b-aa92-7381f8f42d98`.
- Migrasi Supabase proyek Irsyads: `20261027142426_curriculum_clinic_intake`, `20261027142716_curriculum_email_dispatch_identity`, `20261027142948_curriculum_account_links`.
- Seed privat: 58 nama resmi (57 sudah berkelas, satu belum), 81 blok pelajaran dan 10 penugasan piket; setiap Senin–Jumat tepat dua guru, tanpa ganjil/genap.
- Fungsi `curriculum-notifications`, verifikasi JWT aktif dan pemeriksaan identitas service pada server. Fungsi menggunakan secret Resend yang sudah ada di Supabase; API key tidak disalin ke Curriculum, browser, dokumen, atau repo.
- `CLINIC_V2_ENABLED`, `CLINIC_EMAIL_ENABLED`, `SCHOOL_ENABLED`, `SCHOOL_EMAIL_ENABLED`, `CURRICULUM_EMAIL_EDGE_ENABLED` aktif. Worker memanggil antrean setiap lima menit; penerima dan isi hanya berasal dari keputusan tersimpan di server. Ajuan murid tidak membuat email keputusan.

Template terima/tolak memakai `Curriculum Irsyads <noreply@irsyads.com>`. Perubahan peserta klinik memuat daftar efektif dan pengecualian bernama. Dispatcher memiliki lease/idempotensi; kegagalan ditahan untuk retry/pemeriksaan. Status layanan email sudah terkonfirmasi siap dan antrean awal kosong. Belum ada email uji yang dikirim atau bukti penerimaan kotak masuk.

## Verifikasi

- Migrasi terlebih dahulu disimulasikan pada database asli dalam transaksi yang di-rollback, lalu dipasang resmi.
- Pemeriksaan SQL asli: konteks admin/murid, penautan akun, remedial, jurnal, receipt idempoten, penolakan revisi usang, larangan murid mengelola atau mengisi jurnal piket, dan dua guru piket lulus. Semua tulisan uji di-rollback.
- Satu ajuan Klinik lama dan empat eventnya tetap persis utuh. Ajuan akademik/jurnal/antrean baru dimulai kosong; tidak memindahkan akun atau data contoh localhost.
- Dua belas hash HTML/JS/CSS penting cocok antara kandidat dan online. Konfigurasi online mengaktifkan SSO dan layanan baru; katalog native berisi 81 blok/58 nama; beranda mengembalikan dua guru piket. Jurnal/roster privat dilindungi, RPC admin anonim ditolak.
- Tabel privat baru ber-RLS tanpa SELECT langsung bagi anon/authenticated. Advisor menandai tabel tanpa policy dan RPC SECURITY DEFINER; ini jalur yang disengaja: tabel ditutup dan setiap RPC memeriksa akun, hak serta revisi. Peringatan lama di luar cakupan tidak diubah.
- Build Studio dua halaman dan build Curriculum lulus. TypeScript lima root Studio tanpa diagnostic. Tes fitur, SQL lokal dan dispatcher lulus; suite root luas masih memiliki satu kegagalan lama tentang klaim Tahfidz 30 Juz pada halaman yang tidak diubah.
- Bukti browser delapan alur dan tampilan 390/1366 px berasal dari tahap lokal sebelumnya. Saat rilis kontrol browser dinonaktifkan, sehingga sesi SSO sekolah melalui UI online belum diuji kembali. Pemeriksaan produksi kali ini berupa HTTP/hash/PostgREST dan SQL asli. Bukti Word A4 dua halaman dan XLSX ada pada catatan lokal; belum printer fisik.

Studio dibangun dengan perubahan Curriculum saja; perubahan lain yang belum di-commit menggunakan isi HEAD terkini. Paket dan receipt privat di `C:/Users/T6N0CV02S35823C/.codex/releases/curriculum-20261027/`. Unggah memakai mode tanpa bundling karena esbuild Windows menolak menulis; Worker dipaketkan sebagai tiga modul dengan impor relatif disesuaikan, hanya aset pada manifest terkurasi yang dimasukkan.

## Pemulihan

Versi sebelumnya: Curriculum `7431f4f7-09b6-42f8-a223-da27ad46c2b4`, Studio `55c2f4f9-433d-4ba0-bb7b-7b4e73d0ec83`. Bila perlu menahan layanan, matikan flag pengiriman/layanan dan terbitkan konfigurasi yang sesuai. Jangan menghapus tabel, roster, receipt, antrean, atau jurnal untuk rollback. Perubahan skema dipertahankan agar data baru tidak hilang. Snapshot fungsi, satu ajuan lama dan eventnya disimpan privat sebelum pemasangan.
