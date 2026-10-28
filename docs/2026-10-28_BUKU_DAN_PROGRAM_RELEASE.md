# Buku dan program Curriculum — rilis 28 Oktober 2026

Pemilik menyetujui pemisahan bagian, sorotan di beranda, aktivasi penyimpanan dan deploy melalui instruksi “lalu deploy dan tayangkan”. Ringkasan tetap publik; buku lengkap dan monitoring khusus admin langsung di Curriculum, tanpa Studio.

## Alamat dan perilaku

- Beranda `https://curriculum.irsyads.com/`: tiga rencana program terdekat menurut buku. Rencana kedaluwarsa keluar dari sorotan; bila tidak ada rencana berikutnya, bagian beranda menampilkan program utama. Perhitungan tanggal memakai Asia/Jakarta. Tanggal rencana bukan bukti pelaksanaan.
- `buku-kurikulum.html`: ringkasan publik buku utama, tanpa catatan evaluasi atau checklist.
- `program.html`: bagian program publik tersendiri, berisi program utama dan ringkasan rencana terpilih.
- `buku-admin.html`: buku lengkap sebagai teks, pencarian, navigasi bab, serta penyuntingan per blok.
- `program-kurikulum.html`: 40 program buku, checklist dan penyuntingan; 12 konfirmasi kegiatan Wakakur terpisah. Tidak menyimpulkan keterlaksanaan dari file arsip atau tanggal rencana.

Sorotan publik dipilih secara editorial di `assets/curriculum-public-programs.mjs`. Penyuntingan catatan privat tidak otomatis menerbitkan isi ke publik. Teks lengkap dari Word tidak disertakan dalam aset publik atau Git. Isi tabel menjadi urutan teks sel; bukan replika tata letak Word. Word dan PDF belum dibandingkan.

## Pemasangan

- Cloudflare Worker `curriculum-maicn`: versi `ee502f48-d109-4cd6-9335-f06ce346c93e`; sebelumnya `f0515bfe-dbd0-43cb-b948-57896a63cf9b`.
- Proyek Supabase Irsyads `mqesvxweuygplrdxchkv`: migrasi `curriculum_book_and_program_monitoring` dan seed privat 3.904 blok buku, 40 program dan 12 konfirmasi.
- `CURRICULUM_CONTENT_ENABLED=true`. Tidak mengubah akun, peran, layanan lain, antrean pesan atau penyedia email. Tidak menambah layanan berbayar.
- Seed memakai `ON CONFLICT DO NOTHING` dan tidak memindahkan perubahan akun contoh dari lab. Setelah pengujian native, 0 checklist selesai dan 0 riwayat edit; semua baris awal tetap revisi 1.
- Receipt dan paket rilis berada di `.codex/releases/curriculum-20261028-book-program/` di luar repo publik. Pengemasan tanpa bundling mengikuti impor relatif dari entry Worker di root paket. Tidak mengunggah root repo.

## Verifikasi

- 22 tes lokal terarah lulus: SQL/PGlite, pembatasan admin, revisi usang, sumber dan riwayat, SSO, serta data beranda dan batas tanggal Jakarta.
- SQL native: baca dengan konteks akun admin aktif, simpan checklist, penolakan revisi usang, penolakan akun tanpa identitas dan role anon. Seluruh perubahan uji dalam transaksi di-rollback. Jumlah data setelahnya tepat 3.956.
- Privilege native: anon dan authenticated tidak memiliki SELECT langsung pada tabel privat; anon tidak memiliki EXECUTE pada RPC baca.
- Advisor menandai pola tabel RLS tanpa policy dan fungsi SECURITY DEFINER yang dapat dipanggil authenticated. Ini jalur tertutup yang disengaja: tidak ada grant tabel ke klien; kedua fungsi memeriksa ulang `auth.uid()`, kesiapan akun dan `private.is_admin()`, dengan search_path kosong. Pengujian native memverifikasi penolakannya. Tidak mengubah peringatan lama di luar cakupan.
- 12 pemeriksaan HTTP online lulus: delapan hash aset publik cocok, dua halaman admin mengarah ke login, API privat anonim 403, dan input Word privat 404.
- Browser lokal: navigasi buku/monitoring terpisah dan halaman program publik pada lebar 390 px tanpa overflow/pageerror. Browser online memeriksa sorotan beranda pada mobile dan program publik pada desktop. Login dan penyimpanan melalui UI akun pemilik belum diuji; bukti akun admin native berasal dari transaksi SQL, bukan sesi browser pemilik.

## Pemulihan

Rollback ke versi Worker sebelumnya atau matikan flag konten jika diperlukan. Pertahankan tabel privat, seed, riwayat dan edit admin. Jangan menghapus atau mengulang impor dengan penimpaan saat memulihkan UI.
