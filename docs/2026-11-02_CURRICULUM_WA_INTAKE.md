# Teks WA, penolakan, dan pilihan peserta

Penyempurnaan mengikuti contoh pemilik sudah dirilis pada Worker `51409e10-3a7e-4e30-bbc8-e30fe56083c7` dan dispatcher email versi 5. Judul sekolah menjadi satu blok tebal, jam sesi ditulis sekali, nomor dimulai dari 1 setiap hari, dan klinik satu kelas diurutkan X-1/X-2/X-3 sebelum pilihan per murid. Waktu per klinik hanya diulang jika berbeda dari rentang sesi. Kelas belum terjadwal dikelompokkan tersendiri. Penutup memakai format WhatsApp tebal/miring yang berpasangan. Tidak mengubah jadwal atau peserta berdasarkan contoh teks, dan tidak mengirim ulang pesan. Kompilasi/build selesai; rangkaian tes tambahan tidak dijalankan sesuai arahan sebelumnya.

Sudah online: Worker `1b1c3af9-ef5b-4c45-a09a-c04bc3d25eef`, migrasi `20261102083552_curriculum_wa_intake_rejection`, dispatcher email `curriculum-notifications` versi 4 dengan JWT tetap wajib.

- Teks siap salin WA menggunakan nomor klinik berurutan, judul mapel tebal, serta baris waktu, pengampu, lokasi, dan peserta. Ajuan per murid menampilkan nama per baris; pengecualian kelas menyebut tujuan klinik jika tersedia. Informasi akademik dan pengumuman juga bernomor. Tidak memakai tabel dalam teks WA.
- Format yang sama disalin ke dispatcher untuk ringkasan email berikutnya. Tidak mengirim ulang email yang sudah terkirim atau mengirim pesan WhatsApp.
- Penolakan tanpa alasan diperbolehkan di formulir klinik/akademik dan fungsi database. Catatan masih boleh ditambahkan. Pembatalan sesi tetap memerlukan alasan.
- Pilihan kelas dipindahkan keluar dari bagian tanggal/waktu yang dapat ditutup. Pilihan murid langsung menampilkan roster, dilengkapi filter kelas, pencarian, dan tombol hapus pada daftar terpilih. Daftar tidak lagi kosong hanya karena pencarian belum diketik.

Kompilasi sumber dan build 119 aset selesai; enam aset berubah diunggah. Tidak menjalankan rangkaian tes atau uji browser tambahan sesuai arahan pemilik. Tidak membuat ajuan/keputusan contoh, commit, push, Actions, atau merilis Studio utama.
