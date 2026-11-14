# Audit alur dan tampilan Curriculum — 2 November 2026

Mode: Journey + System. Sasaran: guru mengajukan dan melacak ajuan tanpa bantuan admin; kurikulum mengambil keputusan dengan data yang jelas. Perangkat sasaran: HP dan laptop. Artefak: kode Curriculum terbaru, komponen review kanonis, serta catatan rilis. Audit ini tidak mengubah kode aplikasi atau melakukan deploy.

Bukti: pembacaan alur kode, pengukuran kontras pasangan token, inventaris stylesheet, dan rujukan resmi yang dibaca saat audit. Tidak menjalankan browser, suite, pengiriman ajuan, perubahan data produksi, ataupun email percobaan. Frekuensi kejadian pada perangkat guru, tampilan saat keyboard HP terbuka, dan kinerja nyata belum diketahui.

## Kesimpulan

Palet teal/putih/amber dapat dipertahankan. Prioritas berikutnya adalah konsistensi pengiriman, perlindungan isian, dan kejelasan hasil. Penyempurnaan visual sebaiknya mengikuti perbaikan alur tersebut.

## Peta alur

Beranda → buka Klinik/Layanan → pilih identitas → tentukan sesi dan peserta → periksa ringkasan → verifikasi → kirim → nomor penerimaan → keputusan kurikulum → jadwal resmi.

Tahap guru dan review admin tersedia dalam kode. Keberhasilan seluruh alur dari perangkat guru sampai penerimaan email belum dikonfirmasi pada audit ini.

## Temuan yang dapat ditelusuri di kode

| ID | Prioritas | Kondisi dan bukti | Dampak | Perubahan dan kriteria selesai |
|---|---|---|---|---|
| F1 | S1 Mayor | Switch/Kokurikuler masih melakukan POST tanpa batas waktu, mengharuskan localStorage sebelum mengirim, lalu menulis receipt ke localStorage sebelum menampilkan keberhasilan. `assets/school-services.mjs:63–79`. | Permintaan yang menggantung menahan tombol. Penyimpanan browser yang gagal dapat menghalangi kirim atau membuat penerimaan server terlihat seperti kegagalan. | Gunakan satu pola lifecycle pengiriman bersama: batas waktu, token yang tetap, pemeriksaan receipt, penyimpanan perangkat opsional. Penerimaan server tetap ditampilkan meski penyimpanan perangkat gagal. |
| F2 | S1 Mayor | Klinik membaca proposal sebelum menunggu verifikasi; selama menunggu hanya tombol yang dinonaktifkan, input tetap dapat berubah. `assets/clinic-page.mjs:129–155`. | Perubahan yang terlihat di formulir selama verifikasi dapat berbeda dari data yang dikirim. | Setelah verifikasi, baca dan validasi kembali isian terakhir sebelum membuat snapshot dan mengirim. Pada tahap kirim, kunci isian yang relevan dengan penjelasan status. Ringkasan dan payload harus identik. |
| F3 | S1 Mayor | Saat halaman kembali terlihat, akses diperiksa ulang. Kegagalan jaringan mengubah konteks menjadi guest; subscriber Klinik/Layanan memuat ulang jika identitas/peran berubah. `assets/curriculum-access.mjs:29–37,47`; `assets/clinic-page.mjs:194`; akhir `assets/school-services.mjs`. | Guru yang sedang mengisi dapat kehilangan isian yang belum disimpan ketika kembali dari aplikasi lain. Halaman privat juga dapat mengalihkan pengguna saat pengecekan sesi gagal. | Bedakan sesi tidak valid dari status verifikasi yang belum diketahui akibat jaringan. Pertahankan isian, gunakan status offline, dan tetap verifikasi hak akses di server pada setiap tindakan. Jangan menganggap koneksi gagal sebagai logout terkonfirmasi. |
| F4 | S2 Moderat | Tombol Simpan draf melewati validasi HTML, tetapi tetap menjalankan `intakeForm.read()` dan validasi proposal lengkap, termasuk identitas dan peserta. `assets/clinic-page.mjs:127–166`; `assets/clinic-intake-form.mjs:63`. Pembaca draf juga mewajibkan bentuk proposal lengkap. | Isian yang belum lengkap sulit disimpan sebagai draf. | Pisahkan model draf parsial dari model kirim, sesuaikan pembaca draf, dan pertahankan draf lama. Nama/topik saja boleh disimpan; validasi lengkap dilakukan saat kirim. Foto tetap tidak dipersistenkan. |
| F5 | S2 Moderat | Keberhasilan kirim menggunakan satu notice yang juga dipakai kegagalan refresh daftar. `assets/clinic-page.mjs:164,176`. | Pesan penerimaan dan nomor ajuan dapat tertimpa peringatan pembaruan daftar. Pengguna bisa meragukan hasil kirim. | Tampilkan kartu bukti penerimaan tersendiri: nomor, status, waktu, ringkasan, salin nomor, dan periksa status. Kegagalan refresh ditampilkan terpisah dan tidak menghapus bukti penerimaan. |
| F6 | S2 Moderat | Panduan menyebut tahap siap setelah identitas dan jumlah peserta terisi. Mapel, validitas tanggal/waktu, dan tahap verifikasi belum menjadi bagian model readiness. `assets/clinic-intake-form.mjs:51–58`. | Pengguna dapat melihat petunjuk untuk mengirim sementara syarat lain belum sesuai. | Dasarkan checklist pada validasi yang sama dengan pengiriman; bedakan data lengkap, verifikasi, sedang kirim, dan diterima server. Sertakan alasan yang spesifik untuk kondisi yang belum siap. |
| F7 | S2 Moderat | Formulir baru ditampilkan setelah katalog selesai diambil. Selama itu hanya notice halaman yang berubah. `assets/clinic-page.mjs:88–104`. | Pada koneksi lambat, klik dapat terasa tidak membuka apa pun, terutama jika notice berada di luar pandangan. | Buka wadah formulir segera, tampilkan status pemuatan, batal, dan coba lagi. Jangan tampilkan pilihan roster kosong seolah data resmi sudah siap. |
| F8 | S2 Moderat | Sebagian pesan validasi masih menyebut email/bukti guru “wajib” ketika pengguna mengisi format yang tidak sesuai, sedangkan field dan kebijakan menyatakan opsional. `assets/clinic-intake-core.mjs:42–44`. Error domain biasanya diarahkan ke pesan umum, tanpa kontrol sumber. | Guru tidak jelas harus memperbaiki format atau wajib menyediakan bukti. | Gunakan pesan: “Periksa format email, atau kosongkan jika tidak digunakan.” dan “Gunakan tautan file Drive yang valid, atau kosongkan.” Kaitkan pesan dengan isian dan sediakan tautan menuju isian yang salah. |

Prioritas berasal dari dampak jalur kode; bukan ukuran frekuensi pengguna. F2 dan F3 adalah skenario bersyarat yang belum direproduksi di perangkat guru. S1 berarti berpotensi mengganggu tugas utama dan harus ditangani sebelum perluasan fitur.

## Arah tampilan yang disarankan

1. Beranda mempertahankan tiga tindakan cepat, lalu klinik dan jadwal hari ini. Pada HP, pertimbangkan menempatkan ringkasan klinik sebelum daftar KBM panjang. Berita hanya naik prioritas saat penting. Ini rekomendasi hierarki, belum hasil pengamatan pengguna.
2. Formulir tetap satu alur yang dapat digulir. Pengaju dan peserta wajib terlihat, filter roster tetap mudah dijangkau, dan jumlah peserta selalu jelas. Foto, bukti, serta penjelasan panjang masuk bagian opsional yang dapat dibuka.
3. Panduan mengikuti konteks dan kesalahan saat ini. Pertahankan tombol Panduan di tempat konsisten. Untuk input sederhana, cukup petunjuk satu baris dan contoh; jangan memaksa tutorial panjang.
4. Status tampil sebagai teks dan warna: Draf, Sedang dikirim, Diterima server, Menunggu keputusan, Disetujui, Ditolak. “Hasil belum dipastikan” harus memiliki langkah pemulihan yang mempertahankan nomor ajuan.
5. Pada admin, pertahankan konfirmasi keputusan, pemeriksaan revisi, serta tabel peserta/bentrok yang sudah ada. Ringkasan teratas memuat guru, mapel, sesi, peserta efektif, pengecualian, dan lokasi; tindakan utama konsisten. Terima/Tolak tetap boleh tanpa alasan sesuai keputusan pemilik.

## Warna dan bobot tampilan

Kontras token dihitung dari warna sumber, bukan dari screenshot: putih/teal utama 6,45:1; teks utama/latar 11,11:1; teks sekunder/putih 6,27:1; teks amber/latar amber 6,19:1; teks sidebar/latar sidebar 7,49:1; batas input/putih 3,14:1. Pasangan ini mendukung arah palet; pengukuran ini tidak menyatakan seluruh situs memenuhi WCAG.

Beranda memuat 12 stylesheet lokal dengan total sumber sekitar 224 KB sebelum kompresi. Beberapa lapisan berasal dari tema lama dan override baru. Ini menunjukkan peluang merapikan kepemilikan komponen/tokens, bukan bukti bahwa halaman lambat. Kecepatan nyata dan perubahan layout saat memuat belum diukur.

Target kinerja yang disarankan: LCP ≤2,5 detik, INP ≤200 ms, CLS ≤0,1 pada persentil ke-75 pengukuran pengguna. Belum ada klaim bahwa target tersebut tercapai. Hindari menghapus CSS lama sekaligus tanpa pemetaan halaman yang memakainya.

## Opsi pengerjaan

| Opsi | Cakupan | Konsekuensi |
|---|---|---|
| A — Stabilitas inti | F1–F5; samakan pengiriman, lindungi isian, draf parsial, bukti penerimaan. | Paling cepat mengurangi gangguan utama; perbaikan panduan/tampilan lebih terbatas. |
| B — Stabilitas + kenyamanan, direkomendasikan | A, kemudian F6–F8, bantuan kontekstual, hierarki beranda dan admin, serta konsistensi kontrol. | Menangani sumber pertanyaan guru dan kualitas pemakaian dalam perubahan bertahap. |
| C — Konsolidasi menyeluruh | B, kemudian konsolidasi CSS/komponen dan pemuatan aset per halaman. | Cakupan dan risiko regresi terbesar; perlu dipisahkan menjadi beberapa rilis terarah. |

Urutan B: (1) lifecycle pengiriman dan sesi, (2) draf dan kartu receipt, (3) validasi/panduan, (4) tata letak guru/admin, (5) konsolidasi aset yang aman. Kriteria penerimaan di tabel menjadi skenario yang dapat dicoba pemilik; audit ini tidak menjalankannya.

## Rujukan resmi

- [W3C: identifikasi kesalahan](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html): pengguna harus tahu isian mana yang salah dan sifat kesalahannya.
- [W3C: pesan status](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): perubahan status penting perlu dapat disampaikan tanpa memindahkan fokus.
- [W3C: bantuan konsisten](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html): mekanisme bantuan yang berulang mengikuti urutan relatif yang konsisten.
- [GOV.UK: check answers](https://design-system.service.gov.uk/patterns/check-answers/) dan [confirmation pages](https://design-system.service.gov.uk/patterns/confirmation-pages/): contoh pola ringkasan sebelum kirim serta bukti sesudah berhasil. Ini preseden desain, bukan kewajiban khusus Curriculum.
- [GOV.UK: pemulihan validasi](https://design-system.service.gov.uk/patterns/validation/): jelaskan masalah, cara memperbaikinya, dan bedakan kesalahan input dari masalah layanan.
- [web.dev: Core Web Vitals](https://web.dev/articles/defining-core-web-vitals-thresholds): dasar target kinerja, yang harus dinilai melalui pengukuran.
