# Remi Indonesia sebagai Discord Activity: Dokumen Desain

Tanggal: 2026-10-11
Aturan lengkap: `Spesifikasi Aturan Remi Indonesia.md` (sumber kebenaran untuk semua aturan permainan).

## Tujuan dan alasan

Membuat permainan kartu Remi Indonesia yang bisa dimainkan 4 orang secara online di dalam Discord, sebagai Discord Activity. Pemain berkumpul di satu voice channel dan main bersama tanpa perlu aplikasi lain.

## Sukses itu seperti apa

- 4 orang bisa masuk ke satu sesi dari Discord dan bermain sampai ada pemenang.
- Aturan dijalankan persis seperti spesifikasi, termasuk joker, penalti, closed, dan aturan tersalip.
- Tidak ada pemain yang bisa melihat kartu di tangan pemain lain.

## Bukan tujuan (non-goals)

- Bukan lawan komputer untuk pemain sungguhan. Bot hanya mengisi kursi kosong saat testing (lihat keputusan bot di bawah).
- Bukan permainan dengan lebih atau kurang dari 4 pemain.
- Bukan lobi publik atau sistem matchmaking.
- Bukan chat teks di dalam permainan (pemain bisa pakai chat Discord).

## Anti-tujuan (dianggap gagal walaupun teknisnya jalan)

- Kartu bocor ke klien pemain lain, misalnya karena klien menerima seluruh state permainan termasuk tangan lawan.
- Aturan dihitung berbeda dari spesifikasi, terutama joker dan skor.
- Sesi macet tanpa batas waktu karena ada pemain yang disconnect dan tidak pernah kembali.

## Keputusan platform (ditentukan oleh kami, bukan pemain)

- **Frontend:** Next.js (App Router) di Vercel, dirender sebagai aplikasi klien di dalam iframe Discord Activity. Vercel hanya melayani halaman dan `/api/token`.
- **Realtime:** Cloudflare Worker dengan Durable Object `Table`, satu per peluncuran Activity (`instanceId`), memakai WebSocket native. Koneksi realtime yang panjang tidak bisa dijalankan di Vercel, jadi bagian ini dipisah. Pola ini sama dengan aplikasi uno.
- **Koneksi dari Discord:** klien hanya boleh menghubungi domain Vercel dan domain yang dipetakan di URL Mappings. WebSocket ke Worker lewat mapping `/ws` (klien memakai `/.proxy/ws/room/<instanceId>`).
- **Otoritas aturan:** server yang menjalankan seluruh logika permainan, termasuk pengocokan, pembagian, validasi kombinasi, dan skor. Klien hanya mengirim niat (ambil, turunkan, buang) dan menerima tampilan yang sudah disaring.
- **Integrasi Discord:** memakai Discord Embedded App SDK. Detail autentikasi dan cara mendaftarkan Activity harus dicek ke dokumentasi resmi Discord saat implementasi, karena belum diverifikasi.
- **Bahasa:** TypeScript di seluruh kode.
- **Penyimpanan:** state ruang disimpan di storage Durable Object (SQLite, paket gratis Cloudflare). Tidak ada database terpisah. Alarm Durable Object dipakai untuk timer bot dan batas waktu putus.
- **Verifikasi peserta:** server memanggil REST Discord `GET /applications/{app_id}/activity-instances/{instance_id}` dengan bot token (secret Worker `DISCORD_BOT_TOKEN`). Daftar `users` di respons menjadi kursi. Klien tidak mengirim daftar peserta.

## Konstrain

- Tepat 4 pemain per sesi.
- Satu set kartu 52 lembar, tanpa joker cetak.
- Semua aturan mengikuti spesifikasi.
- Pemain menggunakan Discord, jadi identitas pemain berasal dari Discord.

## Bagian cara kerja (keputusan yang sudah diambil)

### Alur sesi
1. Satu pemain membuat sesi dari Discord Activity. Empat kursi diisi dari daftar peserta instance Activity yang diverifikasi server lewat REST Discord. Peserta harus terhubung ke instance itu. Tidak ada penonton di versi pertama.
2. Pemain bisa menentukan target poin (default 1000) sebelum permainan dimulai.
3. Ronde pertama dimulai dengan pemain 1. Setelah itu, giliran pertama di setiap ronde berikutnya diberikan kepada pemain dengan skor total tertinggi. Kalau skor sama, pemain dengan nomor kursi lebih kecil (keputusan kami; spesifikasi tidak menyebutkannya).

### Ronde
- Pengocokan dan pembagian: 7 kartu per pemain, 24 kartu sebagai cangkulan.
- Putaran pertama dan penentuan joker mengikuti spesifikasi, termasuk aturan tidak boleh ada angka buangan yang sama dan penalti buang joker.
- Setiap giliran: ambil (cangkulan atau buangan), turunkan kalau perlu, buang tepat satu kartu.
- Ronde berakhir oleh closed atau cangkulan habis.
- Pemain yang disconnect di tengah ronde (keputusan pemain, sesuai rekomendasi): permainan berhenti dan menunggu pemain itu kembali. Ada batas waktu; kalau pemain tidak kembali sampai batas waktu, sesi dibatalkan. Bot tidak dipakai di versi pertama.
- Skor dihitung untuk semua pemain. Kartu di buangan tidak dihitung (keputusan kami).

### Joker dengan joker
- Tiga joker (angka penentu) tidak boleh membentuk tris sendiri. Sudah dikonfirmasi pemain.

### Sesi
- Permainan berlanjut sampai ada pemain yang mencapai target.
- Kalau lebih dari satu pemain melewati target dalam satu sesi, pemenang adalah yang skornya paling tinggi. Sudah dikonfirmasi pemain.
- Aturan tersalip dan reset ke 0 mengikuti spesifikasi.

## Yang diserahkan ke pembangun

- Struktur folder dan pembagian modul antara klien, server, dan logika aturan.
- Pemilihan library UI dan gaya visual meja kartu.
- Strategi uji: cara menguji aturan (joker, closed, skor, tersalip) secara terpisah dari jaringan.
- Format pengiriman state ke klien, termasuk cara menyaring tangan lawan.

## Keputusan saya (bisa diubah)

1. Giliran pertama ronde berikutnya diberikan kepada pemain dengan skor total tertinggi. Saat skor sama, dipilih nomor kursi lebih kecil. Ronde pertama dimulai dengan pemain 1.
2. Kartu di buangan tidak dihitung dalam skor.
3. Realtime memakai Cloudflare Worker dengan Durable Object, bukan server Node dan bukan API route Next.js. Keputusan ini diambil karena Vercel tidak bisa menjalankan koneksi WebSocket yang panjang.
4. Tidak ada database terpisah. State ruang disimpan di storage Durable Object.
5. Sesi dibuat dan dikelola dari dalam Discord Activity, bukan lewat perintah slash bot.
6. Batas waktu menunggu pemain yang disconnect: 60 detik (`ROOM_OPTIONS.disconnectTimeoutMs` di `worker/worker.ts`). Sudah diuji manual dengan 2 akun: kembali dalam batas waktu melanjutkan permainan, dan lewat batas waktu sesi dibatalkan.
7. Bot untuk testing: pemain yang sudah masuk bisa menekan "Tambah bot" saat menunggu, lalu bot mengisi kursi kosong dan memakai intent yang sama dengan pemain, sehingga aturan tetap dijalankan engine. Strateginya sederhana: selalu ambil dari cangkulan, buang kartu bernilai tertinggi (bukan joker), dan tidak pernah mengambil dari buangan. Bot tidak menggantikan pemain yang disconnect; sesi tetap menunggu sampai batas waktu.

## Status implementasi (per Oktober 2026)

**Yang sudah berjalan:**
- Aturan permainan di `src/rules/` dengan tes, dan logika ruang di `server/room.ts` (tanpa I/O).
- Activity berjalan di Discord dengan 2 akun: pembukaan, giliran, dan tampilan per pemain.
- Putus lalu kembali dalam 60 detik melanjutkan permainan. Putus lebih dari 60 detik membatalkan sesi. Keduanya sudah diuji manual.
- Peserta diverifikasi lewat REST Discord, bukan dari daftar yang dikirim klien.

**Yang belum diuji:**
- Satu ronde penuh sampai skor dan ronde berikutnya di server (scoring lewat Worker).
- Permainan sampai ada pemenang (status `finished`).
- Permainan 4 pemain sungguhan tanpa bot.

**Risiko yang diketahui:**
- Permainan dengan semua bot tidak pernah mencapai target skor, karena bot tidak mengambil dari buangan dan tidak menurunkan kartu.
- Respons endpoint Discord `activity-instances` (field `users`) berasal dari sumber pihak ketiga, dan sudah berjalan di Discord. Tetap perlu dicek ulang kalau Discord mengubah API.
- Bot token adalah secret. Kalau bocor, siapa pun bisa membaca data instance Activity. Ganti lewat Developer Portal bila dicurigai bocor.
- Kursi pertama ditentukan dari urutan peserta yang dikembalikan Discord, bukan dari pilihan pemain.
