import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Syarat dan Ketentuan - Remi Indonesia",
};

export default function TermsPage() {
  return (
    <main className={styles.main}>
      <h1>Syarat dan Ketentuan</h1>
      <p className={styles.updated}>Terakhir diperbarui: 21 Oktober 2026</p>

      <p>
        Dengan menggunakan Remi Indonesia sebagai Discord Activity, kamu setuju dengan syarat berikut.
      </p>

      <h2>Penggunaan layanan</h2>
      <p>
        Remi Indonesia disediakan untuk bermain kartu remi bersama pemain lain di dalam Discord. Kamu
        tidak boleh memakai Activity ini untuk tujuan yang melanggar hukum, mengganggu pemain lain, atau
        merusak layanan.
      </p>

      <h2>Akun</h2>
      <p>
        Akses ke permainan mengikuti akun Discord kamu. Kamu bertanggung jawab atas akun yang kamu
        gunakan untuk bermain.
      </p>

      <h2>Ketersediaan</h2>
      <p>
        Layanan disediakan apa adanya. Kami bisa mengubah, menghentikan, atau memperbarui fitur kapan
        saja tanpa pemberitahuan sebelumnya.
      </p>

      <h2>Batasan tanggung jawab</h2>
      <p>
        Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian yang timbul dari penggunaan
        atau ketidakmampuan menggunakan Activity ini, termasuk permainan yang terputus.
      </p>

      <h2>Hubungan dengan Discord</h2>
      <p>
        Activity ini tunduk juga pada{" "}
        <a href="https://discord.com/terms">Ketentuan Layanan Discord</a> dan{" "}
        <a href="https://discord.com/guidelines">Pedoman Komunitas Discord</a>.
      </p>

      <h2>Kontak</h2>
      <p>
        Pertanyaan tentang syarat ini bisa dikirim ke <strong>ibang090202@gmail.com</strong>.
      </p>
    </main>
  );
}
