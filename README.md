# Latihan Kode Produk

Kuis bahasa Indonesia untuk menghafal kode dan nama 100 produk. Situs statis untuk GitHub Pages, tanpa framework atau instalasi dependensi.

## Fitur

- 100 soal isian: 50 menebak kode dan 50 menebak nama, diacak pada setiap sesi baru.
- Nama yang sama pada beberapa kode selalu ditanyakan dari kode ke nama.
- Durasi 10, 30, 45, atau 60 menit, dengan 45 menit sebagai pilihan awal.
- Navigasi soal, penanda ragu-ragu, penyimpanan jawaban otomatis di browser.
- Skor maksimal 100, pembahasan setelah selesai, dan unduhan hasil dalam TXT.
- Perpindahan tab/aplikasi, hilangnya fokus jendela, keluar fullscreen, dan reload dicatat. Pelanggaran ketiga menyelesaikan percobaan otomatis.
- Kejadian terkait dalam satu episode dihitung sekali. Soal ditutupi sampai peserta mengakui peringatan dan kembali ke ujian.
- Waktu berbasis tenggat absolut. Reload dan halaman yang berjalan di latar belakang tidak mereset durasi.
- Web Locks membatasi penulisan sesi ke satu tab pada browser yang mendukungnya.
- Saat bank soal berubah, sesi dengan data lama diarahkan ke halaman awal. Jawaban lama tersimpan sampai pengguna memulai latihan baru; sesi dengan bank yang sama tetap melanjutkan tenggat semula.
- Tampilan responsif dan tombol yang bisa digunakan melalui keyboard.

## Menjalankan

```sh
python3 -m http.server 8765
```

Buka `http://localhost:8765`. Untuk mencoba tanpa server, buka `index.html` langsung. Dukungan penyimpanan, fullscreen, dan penguncian satu tab pada alamat `file://` dapat berbeda antarbrowser; gunakan GitHub Pages untuk pemakaian utama.

## GitHub Pages

Repositori: [hendigunawan/Test_din](https://github.com/hendigunawan/Test_din). Semua file aplikasi berada di root branch `main`, termasuk `.nojekyll`. Versi publik berada di branch `gh-pages`; pembuatan branch ini sudah mengaktifkan GitHub Pages.

Untuk memeriksa pengaturan, buka [**Settings → Pages**](https://github.com/hendigunawan/Test_din/settings/pages). Sumber publikasi adalah **Deploy from a branch → gh-pages → / (root)**. Alamat situs ditampilkan GitHub setelah deployment selesai.

Untuk menerbitkan perubahan selanjutnya, perbarui `main`, lalu gabungkan perubahan tersebut ke `gh-pages`. Hanya perubahan pada `gh-pages` yang memperbarui situs publik.

Dengan GitHub Free, Pages membutuhkan repositori public. Aturan akun/organisasi lain dapat berbeda. File produk di situs statis dapat dibaca oleh pengunjung.

## Pengujian

```sh
node --check app.js
node --check core.js
node --test tests/*.test.cjs
```

12 tes mencakup komposisi 50/50, nama ambigu, nol di depan kode, penilaian, deduplikasi pelanggaran, penutupan pada pelanggaran ketiga, pemulihan sesi, tenggat waktu, format data tersimpan, alur pengisian sampai hasil, serta penggantian sesi dari bank soal lama tanpa menimpa jawaban sebelum pengguna memulai sesi baru. Tes pengendali memakai adapter DOM minimal dan tidak menggantikan pemeriksaan visual maupun perilaku fullscreen/fokus pada browser nyata.

Checklist manual setelah deploy:

1. Setujui aturan dan mulai. Isi satu jawaban, pindah soal, lalu kembali: jawaban tetap ada.
2. Pindah tab/aplikasi: satu peringatan muncul saat kembali. Perpindahan bersamaan dengan keluar fullscreen tetap satu pelanggaran.
3. Klik kembali ke ujian. Ulangi hingga tiga episode: percobaan selesai dengan jawaban terakhir.
4. Reload di tengah sesi: jawaban/urutan/tenggat sama, satu pelanggaran tercatat, tidak membuat sesi baru.
5. Selesaikan lebih awal: soal kosong bernilai nol dan jawaban tidak bisa diedit setelah selesai.
6. Cek di HP dan desktop. Fullscreen tergantung dukungan browser; tidak semua perangkat mengizinkannya.

## Batas pengawasan

Ini sarana latihan pribadi dengan pengawasan berbasis browser, bukan proctoring yang mengunci perangkat. JavaScript tidak dapat melarang perpindahan aplikasi/tab atau menutup browser. Fullscreen, `visibilitychange`, fokus, dan peringatan keluar hanya membantu mendeteksi kejadian yang disampaikan browser. Browser/OS tertentu mungkin menghentikan halaman tanpa sempat mengirim event.

Data dan kunci jawaban tersedia di frontend. Peserta yang mengubah source, memakai DevTools, menghapus penyimpanan browser, menggunakan profil lain atau perangkat lain dapat melewati mekanisme ini. GitHub Pages tidak menyediakan verifikasi server, identitas peserta, atau rekap hasil terpusat. Hasil dan log hanya tersimpan pada browser/perangkat yang mengerjakan.

Sesi baru boleh dimulai setelah selesai karena aplikasi ditujukan untuk latihan berulang. Browser yang tidak mendukung Web Locks menggunakan pemantauan perubahan penyimpanan antartab sebagai bantuan, bukan jaminan penguncian atomik.

## Sumber produk

Dipilih dari laporan `Transfer Crosstab (1).xls`, sheet `rptFormPermintaan`, KARAWANG HQ, periode 1–3 September 2026. Prioritas didasarkan pada **Total pengiriman**, sebagai pendekatan produk yang sering dibeli. Data ini tidak membuktikan jumlah pembelian pelanggan.

100 produk dipilih setelah mengecualikan kemasan, tas, ongkos/deposit, `ROTI BS PR KG`, dan `PUTIH TELOR PER KG`. Nilai sama diurutkan berdasarkan kode naik.

Pada 8 Oktober 2026, seluruh 100 pasangan kode/nama dicocokkan dengan `sudah dibenerin kode produk.xlsx`, sheet `rptFormPermintaan`, kolom B–C. Pembaruan memperbaiki atau melengkapi 25 nama. Kode lima digit dan nol di depan dipertahankan. Penanda nama ambigu dihitung ulang terhadap seluruh katalog menggunakan normalisasi penilaian aplikasi.

Pilihan 100 produk tetap mengikuti total lengkap pada laporan awal. File koreksi memuat bagian 20 cabang tanpa bagian lanjutan/kolom Total; angka pada 20 cabang tersebut sama dengan laporan awal. Karena itu, tidak dibuat peringkat baru dari jumlah cabang yang tidak lengkap. Repositori hanya memuat daftar kode/nama yang diperlukan untuk kuis.

## Referensi

- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [Fullscreen change](https://developer.mozilla.org/en-US/docs/Web/API/Document/fullscreenchange_event)
- [Peringatan sebelum keluar](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
- [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
- [Menyiapkan GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
