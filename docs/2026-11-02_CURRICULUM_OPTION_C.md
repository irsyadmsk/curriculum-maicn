# Opsi C — stabilitas, kenyamanan, dan konsolidasi

Pemilik memilih opsi C dari audit 2 November 2026. Perubahan terbatas pada aplikasi Curriculum dan proses build/deploy; tidak mengubah skema, data produksi, keputusan kurikulum, atau mengirim email/ajuan percobaan.

## Perubahan alur

- `submission-flow.mjs` menjadi mekanisme bersama untuk POST berwaktu 45 detik, pemeriksaan bukti penerimaan, penguncian input setelah snapshot, verifikasi Turnstile, penyimpanan perangkat yang boleh gagal, dan kartu receipt. Kegagalan jaringan mempertahankan nomor/token; hanya penolakan definitif yang dapat membuka perbaikan payload.
- Klinik dan layanan akademik membaca ulang isian setelah verifikasi, lalu mengunci snapshot selama pengiriman. Event/form disimpan sebelum await agar tidak bergantung pada `event.currentTarget` setelah event selesai.
- Akses yang gagal diperiksa akibat jaringan mempertahankan konteks terakhir. Redirect/reload karena perubahan akun dilakukan setelah respons terverifikasi; hak akses setiap tindakan tetap ditegakkan Worker/server.
- Draf Klinik menerima isian parsial dan dapat dipulihkan. Draf layanan akademik disimpan per jenis layanan dan identitas pengaju ikut dipulihkan. Draf tidak memuat foto.
- Kartu receipt menampilkan nomor, status, salin nomor, dan pemeriksaan status. Pembaruan daftar yang gagal tidak menghapus bukti penerimaan. Data browser yang rusak dipertahankan dan penerimaan baru dapat ditampilkan dari memori.
- Formulir Klinik membuka wadah pemuatan segera, menyediakan Coba lagi/Tutup, dan menghentikan pemuatan bila wadah sudah ditutup.
- Pesan domain diarahkan ke kontrol terkait bila dapat dikenali; error inline terhubung melalui aria-describedby. Readiness Klinik mengikuti validasi intake dan proposal, termasuk mapel serta sesi. Bukti/email tetap opsional dan pesannya diperjelas.

## Kenyamanan

- Beranda mengutamakan klinik pada urutan baca dan tata letak HP, disusul jadwal, Senin JP 1, serta berita. Tabel dan keputusan admin yang sudah ada dipertahankan dengan komponen gaya bersama.
- Catatan/bukti Klinik menjadi bagian opsional yang dapat dibuka. Pilihan identitas dan peserta tetap terlihat.
- Layanan akademik memiliki ringkasan sebelum kirim, Simpan draf, dan pemulihan isian. Setelah penerimaan, formulir lama ditutup dan pengguna dapat memilih Buat ajuan baru.
- Cetak arsip yang belum memiliki data memberi keterangan ketika diklik, tidak berhenti tanpa penjelasan.

## Konsolidasi

- `bundle-styles.mjs` menggabungkan dan meminifikasi run stylesheet lokal, dengan batas pada script, inline style, dan stylesheet eksternal; jalur url relatif disesuaikan. Urutan cascade tetap mengikuti sumber.
- Font lama yang memuat banyak keluarga melalui CSS dihapus; shell tetap memuat Plus Jakarta Sans.
- Build memberi hash otomatis pada stylesheet gabungan, script HTML, dan import modul lokal. Tidak mengubah import sumber kanonis bersama; transformasi berada di `.site/`.
- Inventaris hasil build: beranda turun dari 12 menjadi 6 permintaan stylesheet lokal. Total CSS beranda turun dari sekitar 224 KB sumber sebelum perubahan menjadi sekitar 198 KB hasil kompilasi setelah fitur baru. Angka sebelum kompresi; bukan bukti kecepatan perangkat atau Core Web Vitals.

## Bukti dan batas

Pemeriksaan sintaks modul yang diubah serta kompilasi CSS/build selesai. Import pada hasil build memakai versi konsisten. Sesuai instruksi pemilik, tidak menjalankan suite, browser, submit, atau email percobaan. Keberhasilan interaksi di HP/laptop pengguna dan alur native ujung ke ujung belum dikonfirmasi; tidak menyatakan bebas bug atau memenuhi seluruh WCAG.

Deploy akhir dikonfirmasi Wrangler: domain `curriculum.irsyads.com`, versi Worker `be1b559b-2cb3-4310-951f-fa29d3ce0bf0`, versi aset `d569957964b7`, 132 aset terkurasi. Penjagaan pengiriman ulang juga mengenali ajuan layanan yang sudah memperoleh receipt saat pemulihan.
