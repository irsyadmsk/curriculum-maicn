# Ekspor kalender satu halaman A4

27 Oktober 2026. Pemilik meminta ekspor yang lebih hemat kertas dan lazim, dengan contoh workbook revisi dan dua PDF pada folder Kalender Akademik. Berkas sumber hanya dibaca; isi kalender situs tidak diganti dengan data/angka yang berbeda pada referensi.

## Hasil

Format bawaan tombol ekspor menjadi **Ringkasan setahun · 1 halaman A4 tegak**. Semua 13 bulan pada sumber—Juni 2026 sampai Juni 2027—disusun empat kolom; Juni 2027 tetap dimuat. Setiap tanggal mempertahankan kategori/warna sumber. Kalender mulai Senin seperti contoh cetak umum. Kegiatan utama memakai singkatan yang dijelaskan, rentang yang sama dikelompokkan, serta label perkiraan dipertahankan dengan tanda bintang. Nama hari peringatan Hari Santri tidak berubah menjadi Hari Murid.

Format **Rincian bulanan · A4 mendatar** tetap tersedia dan mempertahankan seluruh agenda, termasuk kegiatan rutin. Ringkasan hanya mengeluarkan uraian pembelajaran rutin/libur mingguan dari daftar teks; semua tanggal dan warna rutinnya tetap dicetak serta dijelaskan pada legenda. Angka ringkasan mengikuti snapshot situs, bukan angka referensi workbook yang berbeda.

Pratinjau menahan cetak ringkasan jika konten melampaui tinggi area A4; pengguna diarahkan ke rincian, tanpa memotong isi atau mengecilkan font otomatis. Rentang lebih dari 16 bulan juga diarahkan ke rincian. Saat mencetak, pilih A4 tegak, skala 100%, dan nonaktifkan header/footer browser.

## Pemeriksaan lokal

- Delapan tes kalender/sumber terkait lulus, mencakup 13 bulan, seluruh 395 posisi tanggal kalender (termasuk tanggal tanpa agenda di tepi periode), semua kategori tanggal sumber, rentang kegiatan, tahun kabisat, escaping dan penolakan rentang terlalu panjang. Model sumber tidak dimutasi.
- PDF statis dari HTML ekspor aktual dirender pada konteks dokumen terisolasi tanpa sesi/cookie pengguna atau permintaan eksternal: satu halaman A4, sekitar 210 × 297 mm. Tinggi isi sekitar 276,5 mm dari area cetak 281 mm. Halaman hasil diperiksa visual; tidak ada tanggal, legenda, atau catatan terpotong.
- Build situs: 97 aset terkurasi. Tidak ada backend, database, SSO, jadwal atau antrean email berubah.
- Contoh hasil dan receipt pemeriksaan disimpan di luar repo, `C:/Users/T6N0CV02S35823C/.codex/artifacts/2026-10-27/kalender-akademik-a4.pdf` dan folder review kalender pada `.codex/releases/`.

Perubahan ini lokal dan belum mengganti ekspor pada situs online. Rilis kalender ini memerlukan konfirmasi pemilik sesuai README; izin rilis layanan akademik sebelumnya bukan izin otomatis untuk pembaruan berikutnya. Setelah disetujui, bangun aset terkurasi, unggah hanya Curriculum dengan konfigurasi layanan aktif yang dipertahankan, lalu cocokkan hash modul kalender/HTML. Studio dan database tidak perlu dirilis ulang.
