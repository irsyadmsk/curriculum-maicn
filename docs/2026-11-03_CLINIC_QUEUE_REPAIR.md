# Antrean dan kejelasan lokasi

Perbaikan berdasarkan screenshot pemilik: kartu ajuan menyusut di flex column yang dibatasi tinggi. Sumber CSS kanonis kini melarang penyusutan tombol kartu; tinggi mengikuti isi. Ringkasan diubah menjadi tombol status ringkas, pencarian mapel/guru/kelas ditambahkan, filter menjadi disclosure di semua ukuran layar, penjelasan berulang dikurangi, dan panel detail/antrean ditata ulang. Perangkat kecil mempertahankan alur daftar lalu detail.

Laporan bentrok Bahasa Mandarin tanggal 3 November 2026 ditelusuri dengan query baca-saja Supabase. Ditemukan Bahasa Inggris berstatus approved, peserta X-1, lokasi Kelas X-3, 16.15–17.00. Ajuan Mandarin memilih lokasi X-3 pada jam sama. Tidak ada perubahan data, penempatan, atau keputusan yang dilakukan. Validasi lokasi dipertahankan; UI menampilkan nama klinik yang bertabrakan, kelas peserta, tanggal/jam, serta lokasi eksplisit dalam kartu dan konfirmasi. Pemeriksaan fresh snapshot sebelum keputusan tetap dilakukan, dengan server sebagai otoritas akhir.

Ekspor dari sumber React dan build terkurasi berhasil; versi aset e5e7e988986d. Tidak menjalankan browser atau pengujian keputusan produksi, sesuai pembagian tugas pemilik. Perubahan dirilis dalam kelanjutan izin deploy redesign sebelumnya.

## Pemulihan keputusan dan urutan waktu

Query baca-saja berikutnya memastikan pembatalan Bahasa Inggris sudah tersimpan (cancelled, revisi 3, catatan ditarik oleh guru), meski browser menampilkan Failed to fetch. Klien kini memberi batas waktu tulis 45 detik, mengulang sekali hanya kegagalan jaringan dengan intent/token yang identik agar server mengembalikan receipt yang sama, lalu memeriksa status server bila hasil belum pasti. Receipt sukses dipertahankan jika pembaruan daftar gagal. Tidak ada pembatalan atau keputusan yang dilakukan oleh agen.

Sesuai tambahan pemilik, kartu dan detail menampilkan created_at dalam tanggal/jam WIB. Daftar diurutkan berdasarkan pengajuan paling lama, dengan fallback waktu tidak tersedia dan ID sebagai penentu urutan seri. Keputusan prioritas tetap manual.

Build akhir: 132 aset, versi 0b42587b56d0. Hash bundle yang disalin cocok dengan hasil ekspor. Deploy akhir berhasil: ebe631bc-e85c-45ce-8515-a13cbd965242. Satu percobaan penyalinan terkena file mapping Windows; proses sebelum deploy dihentikan, kemudian bundle diganti atomik dari hasil ekspor dan dibangun ulang sebelum rilis berhasil.
