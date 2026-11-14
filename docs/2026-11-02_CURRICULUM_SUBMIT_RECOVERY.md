# Pemulihan Kirim ajuan — 2 November 2026

Laporan pemilik: beberapa guru berhenti pada **Kirim ajuan** setelah mengisi formulir. Kasus perangkat belum direproduksi; log kesalahan Postgres pada 08.00–08.57 UTC tidak menampilkan kesalahan baru.

Temuan kode dan perbaikan:

- `SubmitEvent.submitter` sebelumnya menjadi satu-satunya penentu kirim; bila browser tidak menyediakannya, klik Kirim dianggap Simpan draf. Catat intent klik, gunakan kirim sebagai default, dan letakkan Kirim lebih dahulu untuk Enter.
- Pengiriman tidak lagi wajib berhasil menulis localStorage atau menunggu Web Locks. Bila penyimpanan perangkat bermasalah, nomor dan token tetap berada di memori selama halaman terbuka. Data perangkat asal tidak ditimpa saat konflik. Pengguna diberi nomor penerimaan server untuk disimpan.
- Token verifikasi yang belum ada diperbarui saat mengirim, dengan status serta batas tunggu. Pemuatan script dibatasi dan widget lama dilepas saat formulir dibuka kembali.
- POST dibatasi 45 detik; hasil yang belum pasti mempertahankan nomor/token yang sama untuk pemeriksaan. Tombol dipulihkan setelah proses berakhir. Konfirmasi server tidak menunggu pembaruan seluruh daftar.
- Foto tetap tidak ditulis ke draf. Tidak mengubah persetujuan, otorisasi, database, atau pengiriman email.

Pemeriksaan: sintaks kedua modul dan build 119 aset selesai. Tidak menjalankan suite/browser/submisi percobaan sesuai instruksi pemilik. Penerimaan dari perangkat guru masih perlu konfirmasi pemilik.

Deploy berhasil ke `curriculum.irsyads.com`; Wrangler mengonfirmasi versi `7c47d697-5db4-42c4-9a19-b020abbfdf1b` beserta pemicu terpasang.
