'use client';

import { useParams } from 'next/navigation';
import { Check, Clock3, MapPin, Phone, ShieldCheck, X } from 'lucide-react';
import { ErrorState, LoadingPage } from '@/components/ui';
import { orderLabels, paymentLabels } from '@/components/StatusBadge';
import { formatDate, formatDateTime, formatRupiah } from '@/lib/format';
import type { OrderStatus, TrackingData } from '@/lib/types';
import type { ApiTracking } from '@/lib/adapters';
import { normalizeTracking } from '@/lib/adapters';
import { useApiData } from '@/lib/useApiData';

const sequence: OrderStatus[] = ['RECEIVED', 'WASHING', 'DRYING', 'QUALITY_CHECK', 'READY', 'COMPLETED'];

export default function TrackingPage() {
  const params = useParams<{ token: string }>();
  const { data: raw, loading, error, refresh } = useApiData<ApiTracking>(`/track/${encodeURIComponent(params.token)}`);
  if (loading) return <main className="mx-auto min-h-dvh max-w-2xl bg-paper px-4 py-10"><LoadingPage label="Memuat status order" /></main>;
  if (error || !raw) return <main className="grid min-h-dvh place-items-center bg-paper p-5"><div className="w-full max-w-md"><ErrorState message={error ?? 'Tautan pelacakan tidak ditemukan atau sudah diganti.'} retry={() => void refresh()} /></div></main>;
  const data: TrackingData = normalizeTracking(raw);
  const reached = new Map(data.timeline.map((entry) => [entry.status, entry.reachedAt]));
  const currentIndex = sequence.indexOf(data.status);
  const cancelled = data.status === 'CANCELLED';
  return <main className="min-h-dvh bg-paper px-4 py-8 sm:py-12"><div className="mx-auto max-w-2xl page-enter"><header className="mb-8 flex items-center justify-between"><div className="inline-flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-moss-dark font-mono text-lg font-semibold text-[#f3d989]">L</span><span><strong className="block text-lg leading-5">Lawn</strong><span className="text-xs text-muted">Pelacakan order</span></span></div><span className="inline-flex items-center gap-1.5 rounded-full bg-wash px-3 py-1.5 text-xs font-semibold text-moss"><ShieldCheck className="size-4" aria-hidden="true" />Tautan privat</span></header>
    <section className="overflow-hidden rounded-3xl border border-line bg-white shadow-panel"><div className="bg-moss-dark px-5 py-6 text-white sm:px-8"><p className="font-mono text-xs uppercase tracking-[.14em] text-[#f3d989]">Status pengerjaan</p><h1 className="mt-2 text-3xl font-semibold text-white">{cancelled ? 'Order dibatalkan' : orderLabels[data.status]}</h1><p className="mt-2 text-sm text-white/70">{data.business.businessName}</p></div><div className="p-5 sm:p-8"><div className="grid gap-3 sm:grid-cols-2">{data.items.map((item, index) => <article className="rounded-xl bg-wash p-4" key={`${item.brand}-${item.model}-${index}`}><p className="text-xs font-semibold text-muted">Sepatu {index + 1}</p><h2 className="mt-1 font-semibold">{item.brand} {item.model}</h2></article>)}</div>
      {cancelled ? <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"><span className="grid size-9 place-items-center rounded-full bg-red-100"><X className="size-5" aria-hidden="true" /></span><div><strong className="block">Pengerjaan dihentikan</strong><span className="text-sm">Hubungi laundry untuk informasi lebih lanjut.</span></div></div> : <ol className="mt-8 space-y-0">{sequence.map((status, index) => { const done = index <= currentIndex; const current = status === data.status; const reachedAt = reached.get(status); return <li className="relative flex min-h-[70px] gap-4" key={status}>{index < sequence.length - 1 ? <span className={`absolute left-[17px] top-9 h-[calc(100%-4px)] w-0.5 ${index < currentIndex ? 'bg-moss' : 'bg-line'}`} /> : null}<span className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 ${done ? 'border-moss bg-moss text-white' : 'border-line bg-white text-muted'}`}>{done ? <Check className="size-4" aria-hidden="true" /> : <span className="size-2 rounded-full bg-line" />}</span><div className="pt-1"><strong className={current ? 'text-moss' : done ? 'text-ink' : 'text-muted'}>{orderLabels[status]}</strong>{reachedAt ? <p className="mt-0.5 text-xs text-muted">{formatDateTime(reachedAt)}</p> : null}</div></li>; })}</ol>}
      <div className="mt-6 grid gap-3 border-t border-line pt-6 sm:grid-cols-2"><div className="rounded-xl bg-wash p-4"><p className="flex items-center gap-2 text-xs font-semibold text-muted"><Clock3 className="size-4" aria-hidden="true" />Estimasi selesai</p><p className="mt-2 font-semibold">{formatDate(data.estimatedCompletion)}</p></div><div className="rounded-xl bg-wash p-4"><p className="text-xs font-semibold text-muted">Total dan pembayaran</p><p className="mt-2 font-mono font-semibold">{formatRupiah(data.total)}</p><p className="mt-1 text-xs text-muted">{paymentLabels[data.paymentStatus]}</p></div></div>
    </div></section><footer className="mt-5 rounded-2xl border border-line bg-white p-5"><h2 className="font-semibold">{data.business.businessName}</h2><div className="mt-3 space-y-2 text-sm text-muted"><p className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><a className="hover:underline" href={`tel:${data.business.phone}`}>{data.business.phone}</a></p><p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{data.business.address}</p></div></footer><p className="mt-6 text-center text-xs text-muted">Status diperbarui langsung oleh tim laundry.</p></div></main>;
}
