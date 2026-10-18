# PRD — Remi Indonesia Discord Activity

Oct 19, 2026 · @Ibang

## Ringkasan

Remi Indonesia dimainkan oleh tepat 4 orang sebagai Discord Activity. Pemain yang berkumpul di satu voice channel bisa main bersama tanpa keluar dari Discord. Aturan lengkap ada di `Spesifikasi Aturan Remi Indonesia.md`. PRD ini mencatat tujuan, ruang lingkup, dan status implementasi. Aturan permainan tidak diulang di sini.

Saat ini Activity sudah berjalan di Discord dengan dua akun. Pembukaan, giliran, pengambilan dari buangan, penyusunan setelah ronde, skor, putus lalu sambung lagi, dan reset sudah diuji manual.

## Tujuan dan metrik

Tujuan utama: 4 orang di satu voice channel bisa memulai dan menyelesaikan satu sesi Remi (sampai ada pemenang) tanpa bantuan dari luar.

**Bukan tujuan (untuk saat ini)**

- Penonton. Versi pertama hanya untuk 4 pemain.
- Matchmaking dengan orang di luar channel.
- Lawan komputer untuk pemain sungguhan. Bot hanya mengisi kursi kosong saat testing.
- Chat teks di dalam permainan (pemain bisa pakai chat Discord).

**Metrik keberhasilan (usulan, perlu disepakati)**

| Metrik | Target |
| --- | --- |
| Waktu dari membuka Activity sampai giliran pertama | < 30 detik |
| Sesi yang dimulai lalu selesai sampai ada pemenang | ≥ 70% |
| Jeda dari aksi pemain sampai terlihat di layar pemain lain | < 300 ms |
| Sesi yang macet atau error karena server | < 1% |

## Pengguna dan user stories

| Sebagai | Saya ingin | Supaya |
| --- | --- | --- |
| Pemain | membuka Remi dari Activities di voice channel | tidak perlu pindah aplikasi |
| Pemain | hanya melihat kartu saya sendiri, dan jumlah kartu lawan | permainan tetap adil |
| Pemain | menyusun ulang kartu di tangan dan memilih kombinasi saat ronde selesai | skor sesuai dengan yang saya mau |
| Pemain | melihat rincian skor tiap kombinasi dan sampah | tahu dari mana angka skor berasal |
| Pemain | reset game kalau salah mulai | tidak perlu menutup Activity |
| Pemain yang keluar sebentar | kembali dan melanjutkan dari posisi terakhir | tidak kehilangan permainan |

## Ruang lingkup

**Sudah dibuat**

- Aturan permainan lengkap sesuai spesifikasi: kombinasi, joker, putaran pertama, pengambilan dari buangan, closed, skor, dan sesi dengan aturan tersalip. Tes ada di `tests/rules/`.
- Server authoritative: state ruang dan aturan dijalankan di Cloudflare Worker (Durable Object per peluncuran Activity). Klien hanya mengirim niat.
- Tangan lawan disembunyikan, cangkulan hanya ditampilkan jumlahnya.
- Verifikasi peserta: anggota instance Activity diambil dari REST Discord, bukan dari klien.
- Putus lalu sambung lagi: sesi dijeda, dan dibatalkan kalau pemain tidak kembali dalam 60 detik.
- Bot mengisi kursi kosong untuk testing, dengan `NEXT_PUBLIC_ALLOW_BOTS=1`.
- Fase penyusunan setelah ronde: pemain menyusun kombinasi lalu konfirmasi. Hasil menampilkan plus dan minus per kombinasi dan sampah.
- Reset game dengan konfirmasi dua klik.
- Urut kartu di tangan (drag-and-drop dan tombol Urutkan).
- Target skor bisa diatur di awal: pemain yang sudah masuk boleh mengatur target sebelum ronde pertama selesai. Nilainya 100 sampai 5000, default 1000.
- Riwayat poin: tabel skor total setiap pemain setelah tiap ronde.

**Belum dibuat**

- **Uji sesi penuh sampai pemenang.** Belum ada sesi 4 pemain sungguhan yang berjalan sampai `finished`.
- **Uji tampilan di HP.** Layout belum diuji di layar kecil.
- **Uji 4 pemain sungguhan tanpa bot.** Semua tes sejauh ini memakai 2 akun dan bot.

## Status implementasi

| Area | Status | Catatan |
| --- | --- | --- |
| Aturan permainan | Selesai, diuji | Sesuai spesifikasi, kecuali target yang bisa diatur |
| Activity di Discord | Berjalan | Dua akun sudah main bersama |
| Realtime (Worker) | Berjalan | Deploy `remi-room-server.spike-realtime.workers.dev` |
| Web (Vercel) | Berjalan | `remi-indo.vercel.app` |
| Putus dan sambung lagi | Diuji manual | 60 detik |
| Target skor bisa diatur | Selesai | Sebelum ronde pertama selesai, 100–5000 |
| Riwayat poin | Selesai | Tabel total per ronde |
| Sesi sampai pemenang | Belum diuji | Perlu sesi penuh |
| Layout HP | Belum diuji | |
| CI | Hijau | Lint, build, tes, dan typecheck Worker di GitHub Actions |

## Risiko dan catatan teknis

- **Bot token** untuk memanggil REST Discord adalah secret. Kalau bocor, siapa pun bisa membaca data instance Activity. Ganti lewat Developer Portal kalau dicurigai bocor.
- **Respons endpoint `activity-instances`** (field `users`) berasal dari sumber pihak ketiga. Resmi Discord menyebut endpoint itu butuh bot token. Perlu dicek ulang kalau Discord mengubah API.
- **Kursi pertama** ditentukan dari urutan peserta yang dikembalikan Discord, bukan dari pilihan pemain.
- **Pengaturan bot** di environment (`NEXT_PUBLIC_ALLOW_BOTS`) harus dimatikan untuk permainan 4 pemain sungguhan.
- **Konfirmasi susunan** tidak bisa diubah setelah diklik. Ini disengaja untuk menjaga ronde tetap berjalan.

## Keputusan

1. **Target skor diatur di awal.** Pemain yang sudah masuk boleh mengatur target selama ronde pertama belum selesai. Nilainya 100 sampai 5000.
2. **Pemain yang kembali setelah 60 detik.** Sesi dibatalkan. Pemain tidak bisa lanjut setelah batas waktu.
3. **Konfirmasi susunan tidak bisa diubah** setelah diklik, selama pemain lain belum konfirmasi.
