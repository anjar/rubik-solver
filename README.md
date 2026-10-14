# Rubik Pandu

PWA responsif berbahasa Indonesia untuk menyelesaikan Rubik 3×3. Dibangun dengan **Next.js App Router, TypeScript, React, dan Three.js**. Next.js mengekspor situs statis; tidak ada API, akun, database, atau pemrosesan gambar/solusi di server.

## Menjalankan

Gunakan Node.js 22.13+ atau Node.js 24 LTS dan npm.

```sh
npm ci
npm run dev
```

Buka `http://localhost:3000`. Mode pengembangan tidak mendaftarkan service worker. Kamera di HP memerlukan HTTPS; alamat HTTP LAN bukan secure context.

Untuk memeriksa versi PWA/offline:

```sh
npm run build
npm run preview
```

Build menghasilkan folder `out/` beserta `sw.js`, manifest, ikon, font lokal, dan worker solver. Seluruh folder dapat dihosting di layanan static hosting dengan HTTPS pada root domain. Tunggu label **Siap offline** sebelum memutus koneksi. Aset solver ikut di-cache sebelum pertama kali dipakai. Development dan build memakai **Turbopack**, default Next.js 16. Worker solver dibundel bersama semua dependensinya; pembuatan cache PWA berjalan setelah build dan tidak bergantung pada plugin Webpack.

## Fitur versi pertama

- Playground simulator: tarik kotak dengan satu jari/mouse untuk memutar lapisan luar atau tengah. Setiap jari mengendalikan arah lapisannya sendiri, sehingga dua baris/kolom bisa diputar berlawanan arah secara bersamaan. Jari yang diam tidak memutar lapisannya; setelah satu jari dilepas, jari lain tetap bisa melanjutkan tarikan. Tiga jari dapat memilih tiga baris. Lapisan sejajar mengikuti tarikan masing-masing lalu mengunci pada 90°. Tarik area di luar kotak atau Shift+drag untuk memutar seluruh Rubik. Satu gestur beberapa lapisan bisa dibatalkan dengan satu Undo. Acak dan Reset juga tersedia; latihan ini terpisah dari sesi solve.
- Tombol fullscreen memperbesar playground. Jika Fullscreen API tidak tersedia, playground tetap memenuhi viewport. Keluar lewat tombol atau Escape; browser juga dapat mengakhiri fullscreen native.

- Scan enam sisi secara berurutan: depan/hijau, kanan/merah, belakang/biru, kiri/oranye, atas/putih, bawah/kuning.
- Bingkai kamera 3×3, pembacaan warna dengan median piksel dan HSV, penanda hasil meragukan, serta koreksi warna sebelum menghitung solusi.
- Input manual langsung pada kotak Rubik 3D; tampilannya otomatis menghadap sisi yang sedang diisi dan warnanya berubah langsung. Grid 2D tetap tersedia sebagai alternatif.
- Palet menampilkan jumlah kotak tiap warna di seluruh sisi, termasuk pusat yang terkunci. Warna yang sudah mencapai 9 kotak tidak dapat ditambahkan lagi; mengganti warna kotak akan membebaskan kuota warna sebelumnya.
- Bantuan jika izin kamera ditolak atau kamera tidak tersedia.
- Validasi jumlah warna, kombinasi keping, orientasi edge/corner, dan paritas susunan. Kondisi yang tidak bisa diselesaikan ditolak.
- Solver two-phase dari [cubejs](https://github.com/ldez/cubejs), berjalan di Web Worker perangkat. Solusi diperiksa kembali sebelum dikirim ke panduan.
- Animasi Three.js satu gerakan per langkah, orbit dengan sentuhan, reset sudut pandang, ulang animasi, dan pembatalan gerakan terakhir yang sudah dikonfirmasi.
- Scan ulang/input ulang jika kondisi Rubik asli berbeda. Solusi baru menggantikan sesi lama.
- Penyimpanan otomatis satu sesi menggunakan localStorage. Saat melanjutkan panduan, pengguna mencocokkan Rubik asli dengan kondisi terakhir yang dikonfirmasi.
- PWA tanpa login. Kamera tidak direkam, diunggah, atau disimpan. Hanya warna, solusi, dan langkah terakhir disimpan lokal.

Rubik harus memakai skema warna standar: putih atas, hijau depan, merah kanan, kuning bawah, oranye kiri, biru belakang. Pengguna mempertahankan posisi seluruh Rubik saat mengikuti panduan. Animasi adalah pratinjau; progres baru tersimpan setelah menekan **Sudah, lanjut** pada gerakan yang benar-benar dilakukan.

## Verifikasi

```sh
npm run typecheck
npm test
npm run build
npm run check:build
```

Tes mencakup validasi susunan legal/ilegal, enam warna pada beberapa tingkat kecerahan, solver pada kondisi acak, kesesuaian geometri animasi untuk seluruh 18 putaran, pembatalan gerakan, integritas sesi tersimpan, dan alur antarmuka manual/panduan/pemulihan sesi/izin kamera.

`check:build` menjalankan **worker hasil build Next.js** di lingkungan worker terisolasi, membuktikan solusi dapat diterapkan, dan memeriksa bahwa setiap dependensi worker serta seluruh aset yang dibutuhkan tersedia dalam precache.

Jalankan build dan typecheck secara berurutan, karena keduanya menghasilkan/membaca tipe Next.js di `.next/`.

Uji browser nyata bisa dijalankan dengan:

```sh
npx playwright install chromium
npm run test:e2e
```

Pengujian browser dan Rubik fisik masih diperlukan untuk menilai akurasi scan di berbagai HP/pencahayaan, kenyamanan instruksi untuk pemula, instalasi Android/iPhone, dan pemakaian offline setelah reload. Uji otomatis tidak membuktikan seseorang sudah berhasil menyelesaikan Rubik asli. Pembacaan kamera versi pertama memakai bingkai manual, bukan deteksi posisi Rubik otomatis.

## Struktur

- `src/app/`: halaman dan metadata Next.js.
- `src/App.tsx`: alur input → koreksi → validasi → orientasi → panduan → selesai.
- `src/components/`: model 3D, scanner, dan editor warna.
- `src/lib/`: representasi/validasi Rubik, sampling warna, sesi, dan pendaftaran service worker.
- `src/solver.worker.ts`: solver lokal.
- `scripts/build-sw.mjs`: precache otomatis untuk ekspor statis.
- `scripts/check-build.mjs`: pemeriksaan paket offline dan worker terkompilasi.

Timer, akun, riwayat solve, materi metode layer-by-layer, dan pendeteksian gerakan lewat kamera berada di luar versi pertama.
