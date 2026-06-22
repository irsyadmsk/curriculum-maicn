import json

with open("master-data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

prota_raw = """
1	Juni 2026	Kedatangan & Penyambutan Peserta Didik Baru (Indo. Timur & Reguler)	Waka Kesiswaan + TU	100% peserta didik hadir sesuai jadwal gelombang	20–21 Jun; 4–5 Jul 2026	Terlaksana	Koordinasi dengan Boarding
2	Juni–Juli 2026	Matrikulasi Tahap I – Pra-Tes, KBM Matrikulasi, Pasca-Tes	Waka Kurikulum + Tim Guru	Seluruh peserta didik memahami materi esensial 15 mapel	22 Jun – 3 Jul 2026	Terlaksana	Berbasis Buku Kerja 2
3	Juli 2026	MATSAMA (Masa Ta'aruf Murid Madrasah)	Waka Kesiswaan + OSIM	Peserta didik mengenal lingkungan, tata tertib, budaya madrasah	6–8 Jul 2026	Terlaksana	3 hari penuh
4	Juli 2026	Matrikulasi Tahap II – Pra-Tes, KBM Matrikulasi, Pasca-Tes	Waka Kurikulum + Tim Guru	Peserta didik reguler memahami materi esensial 15 mapel	9–17 Jul 2026	Terlaksana	Setelah MATSAMA
5	Juli 2026	Evaluasi dan Penutupan Program Matrikulasi	Waka Kurikulum	Laporan evaluasi matrikulasi tersusun	18 Jul 2026	Terlaksana	Dokumen wajib
6	Juli–November 2026	Pembelajaran Efektif Semester Ganjil	Seluruh Guru + Waka Kurikulum	Ketercapaian CP sesuai ATP; modul ajar tersampaikan	20 Jul – 27 Nov 2026	Berlangsung	Kurikulum Merdeka Fase E
7	Agustus 2026	Pembentukan dan Pelaksanaan Ekstrakurikuler & KBS	Waka Kesiswaan + Pembina Ekskul	Seluruh peserta didik terdaftar minimal 1 ekskul	Mulai 27 Jul 2026	Berlangsung	Jadwal Sabtu & jam 16.00
8	September 2026	Sumatif Tengah Semester (STS) Ganjil	Waka Kurikulum + Tim Guru	100% mapel terlaksana STS; nilai tercatat di e-Rapor	21–25 Sep 2026	Terjadwal	5 hari kerja
9	Oktober 2026	Bulan Bahasa – Puncak Lomba Trilingual	Waka Kurikulum + Guru Bahasa	Lomba bahasa terlaksana; pemenang tersertifikasi	5–31 Okt 2026	Terjadwal	Puncak 31 Okt
10	Oktober 2026	Hari Santri Nasional – Acara Keasramaan	Waka Kesiswaan + Boarding	Kegiatan keasramaan terlaksana	22 Okt 2026	Terjadwal	Panitia Khusus
11	November 2026	Pekan Muraja'ah Al-Qur'an	Guru Tahfidz + Waka Kesiswaan	Seluruh peserta didik mengikuti muraja'ah	16–20 Nov 2026	Terjadwal	
12	November 2026	Ujian Tahfidz Al-Qur'an Semester Ganjil	Guru Tahfidz	Target capaian hafalan per kelas	23–27 Nov 2026	Terjadwal	Hasil masuk e-Rapor
13	November–Desember 2026	Sumatif Akhir Semester (SAS) Ganjil	Waka Kurikulum + Tim Guru	100% mapel terlaksana SAS; nilai final tercatat	30 Nov – 4 Des 2026	Terjadwal	5 hari kerja
14	Desember 2026	Remedial dan Pengayaan Semester Ganjil	Tim Guru	Peserta didik yang belum tuntas mendapat remedi	7–11 Des 2026	Terjadwal	
15	Desember 2026	Class Meeting & Haflah Taqrim Semester Ganjil	Waka Kesiswaan + Panitia	Kegiatan kesiswaan terlaksana meriah	14–17 Des 2026	Terjadwal	ICN Haflah Taqrim
16	Desember 2026	Pembagian Buku Laporan Hasil Belajar (Rapor) Semester Ganjil	Waka Kurikulum + Wali Kelas	100% rapor tersampaikan kepada orang tua	18 Des 2026	Terjadwal	Dokumen akreditasi
17	Januari 2027	Awal Masuk Semester Genap – Upacara Bendera	Kepala Madrasah + Waka	Seluruh peserta didik hadir	4 Jan 2027	Terjadwal	
18	Januari 2027	Pembelajaran Efektif Semester Genap	Seluruh Guru + Waka Kurikulum	Ketercapaian CP sesuai ATP semester genap	4 Jan – 28 Mei 2027	Terjadwal	
19	Januari 2027	Pekan Lomba SARL – Sains, Art, Sport, Religion & Language	Waka Kesiswaan + Panitia	Lomba antar SMP/MTs terlaksana	25–29 Jan 2027	Terjadwal	Program Unggulan MA ICN
20	Februari 2027	Program Ramadan – Syahrun Ma'al Qur'an & Sanlat	Waka Kurikulum + Guru Agama	Seluruh program Ramadan terlaksana	11 Feb – 26 Feb 2027	Terjadwal	Sesuai 1 Ramadan 1448 H
21	Maret 2027	Sumatif Tengah Semester (STS) Genap	Waka Kurikulum + Tim Guru	100% mapel terlaksana; nilai tercatat	1–5 Mar 2027	Terjadwal	5 hari kerja
22	April 2027	Hari Kartini & Hari Bumi – Kegiatan Tematik	Waka Kesiswaan + Guru Mapel	Kegiatan terlaksana; laporan tersusun	21–22 Apr 2027	Terjadwal	Pilihan format kegiatan
23	Mei 2027	Rihlah Ilmiah (Tentatif)	Waka Kesiswaan + Panitia	Peserta didik mengikuti pembelajaran di luar madrasah	4–7 Mei 2027	Tentatif	Konsep dispensasi/sebagian
24	Mei 2027	Sumatif Akhir Semester (SAS) Genap	Waka Kurikulum + Tim Guru	100% mapel terlaksana SAS; nilai final tercatat	31 Mei – 4 Jun 2027	Terjadwal	
25	Juni 2027	Remedial dan Pengayaan Semester Genap	Tim Guru	Peserta didik yang belum tuntas mendapat remedi	8–11 Jun 2027	Terjadwal	
26	Juni 2027	Class Meeting & Panggung Gembira Akhir Tahun	Waka Kesiswaan + Panitia	Kegiatan akhir tahun terlaksana	14–17 Jun 2027	Terjadwal	Penutup TP 2026/2027
27	Juni 2027	Pembagian Buku Laporan Hasil Belajar (Rapor) Akhir Tahun	Waka Kurikulum + Wali Kelas	100% rapor tersampaikan kepada orang tua	18 Jun 2027	Terjadwal	Dokumen akreditasi
28	Juni–Juli 2027	Libur Akhir Tahun Pelajaran 2026/2027	—	Peserta didik beristirahat & persiapan kelas XI	19 Jun – 10 Jul 2027	Terjadwal	Rihlah Guru 19–20 Jun
"""

prota = []
for line in prota_raw.strip().split('\n'):
    parts = line.split('\t')
    if len(parts) >= 7:
        prota.append({
            "no": int(parts[0]),
            "bulan": parts[1],
            "program": parts[2],
            "pj": parts[3],
            "waktu": parts[5],
            "status": parts[6],
            "keterangan": parts[7] if len(parts) > 7 else ""
        })

jadwal_senin_kamis_raw = """
1	03.40 – 05.30	110 menit	Bangun Tidur, MCK, Qiyamullail, Tadarus Al-Qur'an, Shalat Subuh Berjamaah, Tahfidz Al-Qur'an	Kegiatan wajib seluruh peserta didik	Ibadah & Tahfidz
2	05.30 – 06.40	70 menit	Makan Pagi dan Persiapan Apel Pagi	Makan sesuai jadwal dapur asrama	Makan & Persiapan
3	06.40 – 06.55	15 menit	Apel Pagi	Pemeriksaan kerapian dan absensi harian	Kesiswaan
4	07.00 – 07.45	45 menit	Jam Pelajaran 1 (JP 1)	KBM reguler	KBM
5	07.45 – 08.30	45 menit	Jam Pelajaran 2 (JP 2)	KBM reguler	KBM
6	08.30 – 09.15	45 menit	Jam Pelajaran 3 (JP 3)	KBM reguler	KBM
7	09.15 – 09.30	15 menit	Istirahat I (Shalat Dhuha & Snack Pagi)	Shalat Dhuha berjamaah di masjid, dilanjutkan snack/jajan kantin	Ibadah & Istirahat
8	09.30 – 10.15	45 menit	Jam Pelajaran 4 (JP 4)	KBM reguler	KBM
9	10.15 – 11.00	45 menit	Jam Pelajaran 5 (JP 5)	KBM reguler	KBM
10	11.00 – 11.45	45 menit	Jam Pelajaran 6 (JP 6)	KBM reguler	KBM
11	11.45 – 12.45	60 menit	Istirahat II, Shalat Dzuhur Berjamaah, dan Makan Siang	Shalat berjamaah di masjid madrasah	Ibadah & Makan
12	12.45 – 13.30	45 menit	Jam Pelajaran 7 (JP 7)	KBM reguler	KBM
13	13.30 – 14.15	45 menit	Jam Pelajaran 8 (JP 8)	KBM reguler	KBM
14	14.15 – 15.00	45 menit	Jam Pelajaran 9 (JP 9)	KBM reguler	KBM
15	15.00 – 15.45	45 menit	Jam Pelajaran 10 (JP 10)	KBM reguler	KBM
16	15.45 – 16.00	15 menit	Shalat Ashar Berjamaah	Berjamaah di masjid madrasah	Ibadah
17	16.00 – 17.45	105 menit	Ekstrakurikuler / Olahraga / Istirahat / MCK / Makan Malam	Sesuai jadwal ekskul masing-masing	Ekskul & Mandiri
18	17.45 – 18.30	45 menit	Persiapan Shalat Maghrib, Tadarus Al-Qur'an, Shalat Maghrib Berjamaah	Berjamaah di masjid madrasah	Ibadah & Tahfidz
19	18.30 – 19.00	30 menit	Kegiatan Belajar Terbimbing I (Bimbingan Pembina)	Dipandu oleh Guru Pembina Asrama	Belajar Terbimbing
20	19.00 – 20.00	60 menit	Shalat Isya Berjamaah & Kegiatan Belajar Terbimbing II	Berjamaah + belajar terbimbing lanjutan	Ibadah & Belajar
21	20.00 – 22.00	120 menit	Belajar Mandiri dan Pembinaan Peserta Didik	Belajar mandiri di kamar / aula belajar	Belajar Mandiri
22	22.00 – 03.40	340 menit	Istirahat Malam	Seluruh lampu kamar dimatikan pukul 22.00	Istirahat
"""

jadwal_jumat_raw = """
1	03.40 – 05.30	110 menit	Bangun Tidur, MCK, Qiyamullail, Tadarus Al-Qur'an, Shalat Subuh Berjamaah, Tahfidz Al-Qur'an	Kegiatan wajib seluruh peserta didik	Ibadah & Tahfidz
2	05.30 – 06.25	55 menit	Makan Pagi dan Persiapan Apel Pagi	Makan sesuai jadwal dapur asrama	Makan & Persiapan
3	06.25 – 06.40	15 menit	Menuju Masjid untuk Shalat Dhuha	Berjamaah di masjid madrasah	Ibadah
4	06.40 – 06.55	15 menit	Apel Pagi	Pemeriksaan kerapian dan absensi harian	Kesiswaan
5	07.00 – 07.45	45 menit	Jam Pelajaran 1 (JP 1)	KBM reguler	KBM
6	07.45 – 08.30	45 menit	Jam Pelajaran 2 (JP 2)	KBM reguler	KBM
7	08.30 – 09.15	45 menit	Jam Pelajaran 3 (JP 3)	KBM reguler	KBM
8	09.15 – 09.30	15 menit	Istirahat I	Snack/jajan kantin	Istirahat
9	09.30 – 10.15	45 menit	Jam Pelajaran 4 (JP 4)	KBM reguler	KBM
10	10.15 – 11.00	45 menit	Jam Pelajaran 5 (JP 5)	KBM reguler	KBM
11	11.00 – 11.45	45 menit	Jam Pelajaran 6 (JP 6)	KBM reguler	KBM
12	11.45 – 13.30	105 menit	Istirahat II, Shalat Dzuhur Berjamaah, dan Makan Siang	Shalat berjamaah di masjid madrasah	Ibadah & Makan
13	13.30 – 14.15	45 menit	Jam Pelajaran 7 (JP 7)	KBM reguler	KBM
14	14.15 – 15.00	45 menit	Jam Pelajaran 8 (JP 8)	KBM reguler	KBM
15	15.00 – 15.45	45 menit	Jam Pelajaran 9 (JP 9)	KBM reguler	KBM
16	15.45 – 16.00	15 menit	Shalat Ashar Berjamaah	Berjamaah di masjid madrasah	Ibadah
17	16.00 – 17.45	105 menit	Ekstrakurikuler / Olahraga / Istirahat / MCK / Makan Malam	Sesuai jadwal ekskul masing-masing	Ekskul & Mandiri
18	17.45 – 18.30	45 menit	Persiapan Shalat Maghrib, Tadarus Al-Qur'an, Shalat Maghrib Berjamaah	Berjamaah di masjid madrasah	Ibadah & Tahfidz
19	18.30 – 19.00	30 menit	Kegiatan Belajar Terbimbing I (Bimbingan Pembina)	Dipandu oleh Guru Pembina Asrama	Belajar Terbimbing
20	19.00 – 20.00	60 menit	Shalat Isya Berjamaah & Kegiatan Belajar Terbimbing II	Berjamaah + belajar terbimbing lanjutan	Ibadah & Belajar
21	20.00 – 22.00	120 menit	Belajar Mandiri dan Pembinaan Peserta Didik	Belajar mandiri di kamar / aula belajar	Belajar Mandiri
22	22.00 – 03.40	340 menit	Istirahat Malam	Seluruh lampu kamar dimatikan pukul 22.00	Istirahat
"""

jadwal_sabtu_raw = """
1	04.00 – 05.30	90 menit	Bangun Tidur, MCK, Qiyamullail, Tadarus Al-Qur'an, Shalat Subuh Berjamaah, Tahfidz Al-Qur'an	Kegiatan wajib pagi	Ibadah & Tahfidz
2	05.30 – 07.00	90 menit	Makan Pagi dan Persiapan Kegiatan Pagi	Persiapan kegiatan Sabtu	Makan & Persiapan
3	07.00 – 07.30	30 menit	Olahraga dan Senam Pagi Bersama	Seluruh warga madrasah	Olahraga
4	07.30 – 09.00	90 menit	Klub Bidang Studi (KBS) – Pendalaman Mapel	Dibimbing guru mata pelajaran	KBS
5	09.00 – 10.30	90 menit	Pembinaan Karya Tulis Ilmiah (KTI)	Dibimbing guru pembimbing KTI	KTI
6	10.30 – 12.00	90 menit	Kegiatan Proyek / Kewirausahaan Madrasah	Proyek berbasis P5-PPRA	Proyek & Wirausaha
7	12.00 – 17.20	320 menit	Istirahat, Shalat Dzuhur Berjamaah, Makan Siang, Waktu Mandiri / Kegiatan Ekskul	Pesiar / istirahat / mandiri	Ibadah & Mandiri
8	17.20 – 18.00	40 menit	Persiapan Shalat Maghrib Berjamaah	Berjamaah di masjid	Ibadah
9	18.00 – 19.00	60 menit	Shalat Isya Berjamaah	Berjamaah di masjid	Ibadah
10	19.00 – 20.00	60 menit	Kegiatan Mandiri (OSIM / Angkatan / Istirahat)	Kegiatan organisasi atau mandiri	Mandiri & Organisasi
11	20.00 – 22.00	120 menit	Belajar Mandiri dan Pembinaan	Belajar mandiri di kamar	Belajar Mandiri
12	22.00 – 04.00	360 menit	Istirahat Malam	Seluruh lampu kamar dimatikan pukul 22.00	Istirahat
"""

def parse_jadwal(raw):
    res = []
    for line in raw.strip().split('\n'):
        p = line.split('\t')
        if len(p) >= 6:
            res.append({
                "no": int(p[0]),
                "waktu": p[1],
                "durasi": p[2],
                "kegiatan": p[3],
                "catatan": p[4],
                "status": p[5]
            })
    return res

jadwal = {
    "senin_kamis": parse_jadwal(jadwal_senin_kamis_raw),
    "jumat": parse_jadwal(jadwal_jumat_raw),
    "sabtu": parse_jadwal(jadwal_sabtu_raw)
}

data['program_tahunan'] = prota
data['jadwal_harian'] = jadwal

with open("master-data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=1, ensure_ascii=False)

with open("data.js", "w", encoding="utf-8") as f:
    f.write("window.MASTER_DATA = ")
    json.dump(data, f, indent=1, ensure_ascii=False)
    f.write(";")

print("Data updated!")
