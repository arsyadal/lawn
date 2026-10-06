import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper p-6">
      <section className="card max-w-md text-center">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-wash text-moss"><WifiOff aria-hidden="true" /></span>
        <h1 className="text-2xl font-semibold">Tidak ada koneksi</h1>
        <p className="mt-2 text-muted">Lawn membutuhkan internet untuk membaca dan menyimpan data operasional.</p>
        <Link className="btn-primary mt-6 inline-flex" href="/dashboard">Coba lagi</Link>
      </section>
    </main>
  );
}
