# Curriculum: persetujuan, HP, dan klinik paralel

Sudah online. Worker `d1362c6f-7035-490e-9803-390f505d8694`, migrasi `20261102051123_curriculum_mobile_parallel_clinics`. Pemilik meminta persetujuan tanpa alasan, perapian HP/admin, kotak ajuan per murid, klinik paralel tanpa batas angka tetap, lokasi tidak boleh bentrok, dan penambahan lokasi oleh admin.

- Terima tidak memerlukan alasan, pada klinik, alokasi peserta, maupun keputusan akademik. Tolak/Batalkan tetap meminta alasan. Aturan frontend dan fungsi database diselaraskan; tidak mengisi alasan buatan.
- Ruang klinik di HP memakai daftar lalu detail. Tersedia kembali ke daftar, filter yang dapat dibuka, keputusan di bagian awal, dan pelipatan isian lanjutan. Daftar peserta menampilkan jumlah efektif serta pengecualian. Input berukuran 16px dan target tombol minimal 44px.
- CSS HP bersama dipasang pada 24 halaman yang memakai shell Curriculum. Menu bagian admin menjadi pilihan ringkas; tabel admin ditampilkan sebagai kartu berlabel pada HP. Tampilan tabel desktop dan keluaran cetak tetap tersedia.
- Ajuan per murid diberi penanda tersendiri. Jadwal publik memisahkan klinik satu kelas dari kotak klinik per murid; hanya jumlah dan kelas asal yang dipublikasikan. Nama peserta dan pengecualian tetap melalui ruang pengelola dan ringkasan WA admin.
- Kurikulum memilih tujuan setiap murid yang bentrok. Tindakan massal menempatkan murid bentrok di ajuan terpilih hanya berjalan saat diklik. Konfirmasi tetap menunjukkan penempatan. Alokasi lama mencatat daftar efektif dan pengecualian; tidak ada penilaian otomatis atas kuat/lemahnya bukti.
- Tidak ada batas tetap lima klinik. Guru, peserta dan lokasi harus berbeda jika waktunya tumpang tindih. Registry lokasi berisi lima pilihan awal; admin dapat menambah lokasi melalui dialog identitas/lokasi. Server memeriksa lokasi saat persetujuan maupun perubahan lokasi, memakai penguncian transaksi yang sama dengan keputusan/alokasi.
- Pemeriksaan identitas/lokasi memperbarui snapshot terpilih tanpa menghapus catatan yang sedang diketik. Perubahan lain yang terjadi bersamaan tetap meminta pembacaan ulang.

Contoh yang didukung: Sosiologi menerima X-1 di Kelas X-1, kecuali Addar dan Afani; Kimia menerima kedua murid tersebut dan delapan murid lintas kelas di lantai dua pada waktu sama. Ini contoh kemampuan, bukan perubahan keputusan atau roster produksi yang dibuat agen.

UI UX Pro Max dipakai untuk pola minimal enterprise, label/error/fokus formulir, dan target sentuh. Warna navy/biru dan font shell yang sudah ada dipertahankan. Hasil pencarian awal berarah wellness tidak dipakai; penelusuran ulang memakai konteks administrasi sekolah. Tidak menambah framework, font eksternal baru, atau animasi berat.

Atas arahan pemilik, tidak menjalankan rangkaian tes atau uji browser tambahan. Sumber dikompilasi, aset dibangun (119 aset), dan deployment mengunggah 36 aset berubah. Satu pemasangan migrasi ditolak atomik karena delimiter SQL hasil penyusunan; diperbaiki lalu dipasang. Deployment frontend sempat berjalan sebelum pemasangan SQL ulang selesai; keduanya kini terpasang. Tidak membuat ajuan/keputusan simulasi, mengirim pesan manual, commit, push, Actions, atau merilis Studio utama.

Kontrol browser sebelumnya dinonaktifkan di Work; tidak mengklaim telah memeriksa tampilan HP nyata. Pemilik melakukan uji interaksi online. Berkas fungsi/migrasi terbaru tersimpan pada `server/curriculum-mobile-parallel.sql` dan migrasi canonical Irsyads dengan timestamp yang sama.
