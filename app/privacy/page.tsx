import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Kebijakan Privasi - Remi Indonesia",
};

export default function PrivacyPage() {
  return (
    <main className={styles.main}>
      <h1>Kebijakan Privasi</h1>
      <p className={styles.updated}>Terakhir diperbarui: 21 Oktober 2026</p>

      <p>
        Remi Indonesia adalah Discord Activity untuk bermain kartu remi bersama pemain di satu voice
        channel. Halaman ini menjelaskan data apa saja yang kami proses.
      </p>

      <h2>Data yang kami proses</h2>
      <ul>
        <li>
          ID pengguna Discord, nama tampilan, dan foto profil (avatar), yang diambil dari Discord saat
          kamu membuka Activity.
        </li>
        <li>
          Data permainan: kartu yang dipegang, giliran, skor, dan status ronde selama permainan
          berlangsung.
        </li>
      </ul>

      <h2>Cara data digunakan</h2>
      <p>
        Data dipakai hanya untuk menjalankan permainan: menampilkan meja, menentukan giliran, menghitung
        skor, dan mengembalikan permainan jika koneksi terputus. Kami tidak menjual data dan tidak
        memakainya untuk iklan.
      </p>

      <h2>Penyimpanan</h2>
      <p>
        State permainan disimpan di infrastruktur Cloudflare Durable Objects selama sesi Activity
        berjalan dan dihapus ketika sesi berakhir. Kami tidak menyimpan riwayat permainan secara
        permanen.
      </p>

      <h2>Pihak ketiga</h2>
      <p>
        Activity ini berjalan di dalam Discord dan memakai layanan Discord untuk autentikasi serta data
        profil. Penggunaan data oleh Discord tunduk pada{" "}
        <a href="https://discord.com/privacy">Kebijakan Privasi Discord</a>.
      </p>

      <h2>Hak kamu</h2>
      <p>
        Kamu bisa berhenti menggunakan Activity kapan saja. Untuk pertanyaan atau permintaan terkait data,
        hubungi kami di <strong>ibang090202@gmail.com</strong>.
      </p>

      <h2>Perubahan kebijakan</h2>
      <p>
        Kebijakan ini bisa diperbarui. Perubahan akan ditampilkan di halaman ini dengan tanggal baru.
      </p>
    </main>
  );
}
