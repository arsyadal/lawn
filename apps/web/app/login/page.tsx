'use client';

import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import { api, clearApiSession } from '@/lib/api';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await api('/auth/login', { method: 'POST', skipCsrf: true, body: { identifier: String(form.get('identifier') ?? '').trim(), password: String(form.get('password') ?? '') } });
      clearApiSession();
      const requested = new URLSearchParams(window.location.search).get('next');
      window.location.assign(requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login gagal. Periksa data Anda dan coba lagi.');
      setSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh overflow-hidden bg-moss-dark lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-20 top-20 size-80 rounded-full border border-white/10" /><div className="absolute -bottom-24 left-20 size-96 rounded-full border border-[#f3d989]/20" />
        <div className="relative inline-flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-[#f3d989] font-mono text-xl font-semibold text-moss-dark">L</span><span className="text-2xl font-semibold">Lawn</span></div>
        <div className="relative max-w-xl"><p className="font-mono text-sm uppercase tracking-[.16em] text-[#f3d989]">Ruang kerja harian</p><h1 className="mt-4 text-5xl font-semibold leading-[1.08] tracking-[-.045em] text-white">Setiap pasang sepatu, jelas prosesnya.</h1><p className="mt-5 max-w-lg text-lg leading-8 text-white/70">Catat order, ikuti pengerjaan, dan selesaikan pembayaran dari satu tempat.</p></div>
        <p className="relative text-sm text-white/50">Operasional laundry sepatu</p>
      </section>
      <section className="grid min-h-dvh place-items-center bg-paper px-5 py-12 sm:px-10 lg:rounded-l-[2.5rem]">
        <div className="w-full max-w-md page-enter">
          <div className="mb-9 flex items-center gap-3 lg:hidden"><span className="grid size-11 place-items-center rounded-xl bg-moss-dark font-mono text-lg font-semibold text-[#f3d989]">L</span><strong className="text-2xl">Lawn</strong></div>
          <p className="eyebrow">Masuk ke ruang kerja</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.035em]">Selamat datang kembali</h2><p className="mt-2 text-muted">Gunakan email atau username yang terdaftar.</p>
          <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div> : null}
            <div><label className="field-label" htmlFor="identifier">Email atau username</label><input className="field" id="identifier" name="identifier" autoComplete="username" required autoFocus /></div>
            <div><label className="field-label" htmlFor="password">Password</label><div className="relative"><input className="field pr-14" id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required /><button className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted hover:text-ink" type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}</button></div></div>
            <button className="btn-primary w-full" disabled={submitting}>{submitting ? <><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Memeriksa akun...</> : <><LockKeyhole className="size-5" aria-hidden="true" />Masuk</>}</button>
          </form>
          <p className="mt-8 text-center text-xs leading-5 text-muted">Akun dibuat oleh pemilik usaha. Hubungi pemilik bila Anda belum memiliki akses.</p>
        </div>
      </section>
    </main>
  );
}
