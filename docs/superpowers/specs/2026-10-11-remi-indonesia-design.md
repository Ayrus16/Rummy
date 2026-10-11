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

- Bukan lawan komputer (bot) di versi pertama.
- Bukan permainan dengan lebih atau kurang dari 4 pemain.
- Bukan lobi publik atau sistem matchmaking.
- Bukan chat teks di dalam permainan (pemain bisa pakai chat Discord).

## Anti-tujuan (dianggap gagal walaupun teknisnya jalan)

- Kartu bocor ke klien pemain lain, misalnya karena klien menerima seluruh state permainan termasuk tangan lawan.
- Aturan dihitung berbeda dari spesifikasi, terutama joker dan skor.
- Sesi macet tanpa batas waktu karena ada pemain yang disconnect dan tidak pernah kembali.

## Keputusan platform (ditentukan oleh kami, bukan pemain)

- **Frontend:** Next.js (App Router), dirender sebagai aplikasi klien di dalam iframe Discord Activity.
- **Realtime:** server Node.js terpisah dengan WebSocket (Socket.IO). Alasannya: koneksi realtime yang panjang tidak cocok dijalankan di serverless tempat Next.js biasanya di-deploy. Ini keputusan kami dan perlu dicek ulang saat implementasi.
- **Otoritas aturan:** server yang menjalankan seluruh logika permainan, termasuk pengocokan, pembagian, validasi kombinasi, dan skor. Klien hanya mengirim niat (ambil, turunkan, buang) dan menerima tampilan yang sudah disaring.
- **Integrasi Discord:** memakai Discord Embedded App SDK. Detail autentikasi dan cara mendaftarkan Activity harus dicek ke dokumentasi resmi Discord saat implementasi, karena belum diverifikasi.
- **Bahasa:** TypeScript di seluruh kode.
- **Penyimpanan:** tidak ada database di versi pertama. Sesi hidup di memori server. Kalau server restart, sesi hilang.

## Konstrain

- Tepat 4 pemain per sesi.
- Satu set kartu 52 lembar, tanpa joker cetak.
- Semua aturan mengikuti spesifikasi.
- Pemain menggunakan Discord, jadi identitas pemain berasal dari Discord.

## Bagian cara kerja (keputusan yang sudah diambil)

### Alur sesi
1. Satu pemain membuat sesi dari Discord Activity. Empat kursi diisi otomatis dari anggota voice channel yang sedang aktif di Activity. Tidak ada penonton di versi pertama.
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
3. Realtime memakai server Node terpisah, bukan API route Next.js.
4. Tidak ada database di versi pertama.
5. Sesi dibuat dan dikelola dari dalam Discord Activity, bukan lewat perintah slash bot.
6. Batas waktu menunggu pemain yang disconnect: nilai awal 60 detik, bisa diubah di konfigurasi. Angka ini belum diuji dan harus dicek saat playtest.
