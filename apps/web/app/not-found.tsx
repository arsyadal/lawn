import Link from 'next/link';
import { MapPinOff } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper p-6">
      <section className="card max-w-md text-center">
        <MapPinOff className="mx-auto mb-4 text-moss" aria-hidden="true" />
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Halaman tidak ditemukan</h1>
        <Link className="btn-primary mt-6" href="/dashboard">Kembali ke beranda</Link>
      </section>
    </main>
  );
}
