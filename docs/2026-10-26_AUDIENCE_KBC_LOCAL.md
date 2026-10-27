# Istilah kurikulum dan pembagian akses — 26 Oktober 2026

Status: implementasi dan pengujian lokal. Melanjutkan CURR-01, redesign, roster, Klinik bertanggal dan blok Senin JP 1. Tidak ada commit, push, deploy, SQL produksi, penambahan kewenangan akun asli atau pengiriman notifikasi eksternal.

## Perilaku

- Antarmuka menggunakan **murid**, **kokurikuler**, **dimensi profil lulusan** dan **Panca Cinta**. Halaman P5 lama menjadi pengalihan ke Kokurikuler; salinan sumber lama disimpan di docs/archive, tidak ikut build publik. Dokumen sumber dan kunci penyimpanan historis tidak diganti secara massal.
- Kokurikuler menjelaskan delapan dimensi dan lima nilai Panca Cinta; rencana kegiatan madrasah diberi konteks, bukan tema nasional wajib. Klaim wajib 144 JP/tiga tema dan klaim pengesahan KOM tanpa bukti dihapus dari antarmuka aktif. KBC diintegrasikan dalam pembelajaran dan budaya madrasah.
- Bobot nilai 40:30:30 serta angka 75 tetap sebagai pengaturan kalkulator lama, tetapi tidak lagi disebut aturan nasional atau penentu kelulusan. Nilai kosong tetap berbeda dari nol.
- **Tamu/murid:** Beranda, Info murid, jadwal, kalender, agenda Klinik yang disetujui, kokurikuler, KOM dan informasi program. Murid tidak membutuhkan akun. Permintaan Klinik dapat diajukan tanpa akun; tidak otomatis disetujui.
- **Akun umum:** tetap hak informasi publik dan permintaan; login saja tidak membuat pemilik akun menjadi guru.
- **Guru madrasah terverifikasi:** data murid, presensi/jurnal, buku kerja, asesmen, rapor, catatan perkembangan, usulan dan laporan Klinik milik/penugasannya. Catatan perangkat dipisahkan menurut akun. Catatan lama tanpa pemilik tidak otomatis diatribusikan ke akun baru.
- **Admin/kurikulum:** keputusan Klinik dan penetapan blok Senin JP 1 melalui ruang Studio yang telah disiapkan; data lama hanya dapat ditelusuri pengelola, dengan status asal yang belum menjadi persetujuan server.
- Catatan perkembangan berisi bukti pengamatan dan pendampingan, dimensi serta nilai Panca Cinta. Pembiasaan opsional yang kosong berarti tidak dicatat. Edit menyimpan riwayat revisi; konflik tab/perangkat atau simpanan rusak menahan penulisan.

## Batas akses yang diterapkan

`server/worker.mjs` memeriksa halaman dan aset privat sebelum binding statis. Cookie situs HttpOnly dipertukarkan hanya setelah `auth/v1/user` dan RPC peran institusi cocok. Metadata browser/user bukan sumber kewenangan. Setiap permintaan privat memeriksa kewenangan lagi, dengan `no-store` dan `Vary`.

`scripts/build-site.mjs` menghasilkan 76 aset terkurasi di `.site`. Tidak menerbitkan docs, server, tests, workbook atau isi repo secara bebas. Bundel akademik publik menghilangkan catatan booking Klinik lama; salinan lama terpisah pada aset khusus pengelola. Roster nama murid memerlukan guru, sedangkan halaman publik hanya memakai jumlah agregat. **Jangan menjalankan repo root sebagai situs statis untuk rilis.** Gateway Worker dan `run_worker_first` wajib dipertahankan.

Kandidat SQL ada di repo utama `ops/review/clinic-workflow-20261026/prepare.sql`, belum diterapkan. Menambahkan pemetaan guru aktif, konteks akses dan penulis permintaan tamu yang hanya dapat dipanggil server. Permintaan tamu selalu pending; guru pengampu wajib ditetapkan sebelum persetujuan. Gateway memvalidasi Turnstile, lalu SQL membatasi lima permintaan per fingerprint/hari secara transaksional. Tidak ada jalur tamu untuk laporan, keputusan, pembacaan privat atau perubahan kewenangan.

`CLINIC_REMOTE_ENABLED=false`; `ACCESS_ENABLED` dan `CLINIC_ENABLED` pada konfigurasi Worker tetap false. Draf perangkat dapat diuji; login asli, pengiriman, persetujuan dan pembaruan agenda dari server belum diaktifkan. Kunci server tidak dimasukkan ke JavaScript publik. Pemetaan akun guru/katalog dan kuota gratis harus ditinjau sebelum rilis terpisah.

## Bukti lokal

- Seluruh 58 pemeriksaan repo lulus, termasuk permintaan tanpa guru dan pemisahan nilai per akun. Log dicatat pada `scratch/audience-final-tests.log`. Setelah penyesuaian akhir label agenda dan pilihan menu ponsel, pemeriksaan gateway/tampilan terkait dijalankan pada `scratch/audience-focused-final.log`.
- SQL: tiga pengujian PGlite lulus, termasuk batas guru/tamu/member/pengelola, persetujuan, pencabutan hak, idempotensi, lima permintaan/hari, laporan penugasan, revisi, konflik dan Senin JP 1.
- Studio: tiga pengujian komponen React Klinik/Senin lulus; pemeriksaan TypeScript terkait lulus. Ini bukan pembangunan ulang seluruh monorepo.
- Browser asli: menu tamu dan guru berbeda, Info murid terbuka, rapor memuat 19 murid contoh dengan seluruh nilai kosong, presensi tidak mengasumsikan kehadiran. Catatan perkembangan contoh disimpan, diedit menjadi revisi 2 dan tetap terbaca setelah muat ulang. Semua isian uji memakai port 4573 dan nama fiktif.
- Empat halaman (Beranda, Info murid, Klinik, Kokurikuler) diukur pada bingkai 320/390/1366 px dengan peran guru contoh: 12 kombinasi tidak meluber horizontal. Karakter juga diamati pada bingkai 320 px tanpa meluber. Pengujian otomatis bingkai privat berikutnya terganggu respons browser; tidak diklaim selesai. Ini belum pengujian perangkat HP fisik.
- Screenshot Info murid publik: `audience-20261026/info-murid-desktop.png`. Percobaan override viewport tidak diterapkan oleh browser (tetap 1270 px); screenshot tersebut tidak dianggap bukti HP.

Manifest 59 berkas sumber ada pada `audience-20261026/source-manifest.json`; ini bukti kandidat sumber lokal, bukan paket rilis atau bukti aktivasi online. Tiga ekspor inti sama persis dengan sumber kanonis di repo utama.

Server lokal: 4570 = gateway aktual mode tamu; 4573 = gateway aktual dengan penyedia identitas sintetis, banner akun/data contoh dan roster fiktif. Fitur fixture dan alat ukur hanya milik server lokal, tidak ikut aset rilis. Tidak ada akun guru asli yang dibuat atau diberi akses.

## Data yang dipertahankan

Workbook roster sumber tidak diubah: 57 murid terdistribusi (19 per kelas) dan Faza Nabihan belum ditempatkan sesuai keputusan pemilik. Tidak ada NIS/NISN/nilai yang dikarang. Kunci booking, nilai, presensi dan catatan historis tetap ada; migrasi atribusi tidak diasumsikan. Data jadwal reguler tetap bersumber dari dokumen asal.

## Rujukan istilah

- [Panduan Kurikulum Berbasis Cinta, Kemenag](https://cdn.kemenag.go.id/storage/archives/panduan-kurikulum-berbasis-cinta.pdf), Keputusan Dirjen Pendis 6077/2025.
- [Standar Proses, Kemendikdasmen](https://pskp.kemendikdasmen.go.id/standar-nasional-pendidikan-a/standar-proses), delapan dimensi profil lulusan.

Penyesuaian istilah bukan klaim audit kepatuhan menyeluruh. Native Auth/PostgREST/RLS, pemetaan akun pemilik, Turnstile asli, penerimaan pengelola, cetak fisik dan aktivasi situs/Studio online tetap memerlukan verifikasi rilis yang terpisah. Ikuti AGENTS.md dan kebijakan gratis/rilis repo utama; jangan merilis checkout kotor atau menerapkan SQL dari dokumen ini secara otomatis.
