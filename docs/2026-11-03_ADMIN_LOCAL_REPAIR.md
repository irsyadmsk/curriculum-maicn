# Perbaikan admin — lokal, 3 November 2026

Status: belum deploy. Pemilik meminta peninjauan kode, lalu pemeriksaan visual/interaksi sendiri di localhost. Tidak menjalankan browser, suite tes, keputusan produksi, atau email.

## Perubahan

- ClinicReview membandingkan data keputusan secara eksplisit, bukan urutan properti seluruh objek JSON. Pembaruan lokasi tidak dianggap perubahan isi ajuan. Revisi/status, peserta, jadwal, pengampu, dan lokasi tetap diperiksa sebelum keputusan; server tetap memegang otorisasi dan pemeriksaan bentrok.
- Setelah pemeriksaan identitas/lokasi disimpan dari tombol Terima, lanjutkan ke konfirmasi keputusan. Alasan Terima/Tolak tetap opsional. Pembaruan ajuan yang benar-benar berbeda menampilkan data terbaru untuk ditinjau.
- Worker mengembalikan kegagalan RPC klinik dalam bentuk `{data:null,error:{message}}`; sebelumnya respons generik menghilangkan rincian kesalahan bagi klien. Daftar kode mencakup penempatan dan peserta kosong.
- Sesi awal browser yang kosong tidak lagi menghapus cookie gateway yang sudah terverifikasi. Hanya peristiwa keluar eksplisit yang menghapusnya. Runtime sesi dibatasi waktu, dapat dicoba ulang, dan melewati dependensi yang sudah dimuat.
- Tombol Admin/Kurikulum menuju persetujuan langsung. Halaman akun dapat kembali ke tujuan setelah sesi yang ada tersambung, tanpa wajib melalui SSO lagi. Halaman privat yang tidak dapat memverifikasi cookie menuju pemulihan akun; hak akses tidak dilonggarkan.
- Token warna foreground/background dipasangkan untuk tombol bermerek, teks sekunder, input, dan dialog. Kontrol admin memiliki gaya eksplisit, ukuran sentuh, warna status, dan susunan responsif. Tombol Perbarui yang sebelumnya disembunyikan CSS ditampilkan.

## Pemeriksaan kode dan pratinjau

Ekspor bundle dari sumber React kanonis berhasil; SHA-256 hasil ekspor sama dengan aset tujuan. Pemeriksaan sintaks modul yang diubah dan build terkurasi berhasil (132 aset, hash `e27a83e256c5`). Kompiler memberi peringatan lama tentang duplikasi ekspor `./service-icons` pada paket design-tokens; tidak menghalangi build dan tidak diubah dalam lingkup ini.

Pratinjau aktif di `http://127.0.0.1:4584/`; akun contoh admin di `/__fixture/admin`. GET beranda mengembalikan 200. Port 4581 sudah dipakai proses sebelumnya, sehingga tidak dihentikan atau ditimpa. Proses pratinjau baru: PID 52520 saat dibuat.

Pratinjau memakai Worker router asli dan backend contoh dalam memori. Operasi dasar Terima/Tolak, identitas/lokasi, dan konflik lokasi/pengampu tersedia; penempatan kompleks antar-klinik, email, dan SSO asli tidak dibuktikan oleh pratinjau ini. Ajuan Kimia contoh memakai kelas X-2 pada Senin mendatang agar dapat diputuskan tanpa berbenturan dengan Fisika X-1. Data contoh hilang jika server lokal dimulai ulang.

Teks kesalahan spesifik dari laporan pemilik belum tersedia; balasannya mengidentifikasi tombol “Terima ajuan”. Perubahan ini memperbaiki masalah yang ditemukan lewat penelusuran kode, bukan klaim bahwa kegagalan produksi telah direproduksi. Setelah pemilik memeriksa localhost, perbaiki temuan tambahan atau deploy sesuai persetujuannya.
