'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Banknote, ClipboardCheck, Clock3, PackageCheck, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { OrderCard } from '@/components/OrderCard';
import { EmptyState, ErrorState, LoadingPage, PageHeader } from '@/components/ui';
import { api, listResult } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { canCreateOrder } from '@/lib/permissions';
import type { DashboardData, OrderStatus } from '@/lib/types';
import type { ApiDashboard, ApiOrderSummary } from '@/lib/adapters';
import { normalizeDashboard } from '@/lib/adapters';

const filters: Array<{ label: string; status: OrderStatus | 'ALL' }> = [
  { label: 'Semua', status: 'ALL' }, { label: 'Diterima', status: 'RECEIVED' }, { label: 'Dicuci', status: 'WASHING' }, { label: 'Dikeringkan', status: 'DRYING' }, { label: 'QC', status: 'QUALITY_CHECK' }, { label: 'Siap', status: 'READY' },
];

type OrderListResponse = ApiOrderSummary[] | { data?: ApiOrderSummary[]; items?: ApiOrderSummary[]; total?: number };

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboard, orders] = await Promise.all([
        api<ApiDashboard>('/dashboard'),
        api<OrderListResponse>('/orders?limit=100'),
      ]);
      setData(normalizeDashboard(dashboard, listResult(orders).data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Dashboard tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <LoadingPage label="Memuat dashboard" />;
  if (error || !data) return <ErrorState message={error ?? 'Dashboard tidak tersedia.'} retry={() => void load()} />;
  const queue = filter === 'ALL' ? data.workQueue : data.workQueue.filter((order) => order.status === filter);

  const metrics = [
    { label: 'Pendapatan hari ini', value: formatRupiah(data.todayRevenue), icon: Banknote, tone: 'bg-emerald-50 text-emerald-800' },
    { label: 'Order hari ini', value: String(data.ordersToday), icon: ClipboardCheck, tone: 'bg-blue-50 text-blue-800' },
    { label: 'Order aktif', value: String(data.activeOrders), icon: Clock3, tone: 'bg-amber-50 text-amber-800' },
    { label: 'Siap diambil', value: String(data.readyOrders), icon: PackageCheck, tone: 'bg-violet-50 text-violet-800' },
  ];

  return <div className="page-enter">
    <PageHeader eyebrow="Ringkasan hari ini" title={`Halo, ${user.name.split(' ')[0]}`} description="Lihat pekerjaan yang perlu ditangani dan order yang sudah siap." action={canCreateOrder(user.role) ? <Link href="/orders/new" className="btn-primary"><Plus className="size-5" aria-hidden="true" />Order baru</Link> : null} />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Metrik hari ini">{metrics.map(({ label, value, icon: Icon, tone }) => <article className="card min-w-0" key={label}><span className={`mb-4 grid size-10 place-items-center rounded-xl ${tone}`}><Icon className="size-5" aria-hidden="true" /></span><p className="truncate text-xs font-semibold text-muted sm:text-sm">{label}</p><p className="metric-number mt-1 truncate">{value}</p></article>)}</section>
    {data.overdueCount > 0 ? <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex sm:items-center sm:justify-between"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" /><div><h2 className="font-semibold text-red-900">{data.overdueCount} order terlambat</h2><p className="text-sm text-red-800">Periksa estimasi selesai dan tindak lanjuti progresnya.</p></div></div><a href="#overdue" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-red-900 sm:mt-0">Lihat order <ArrowRight className="size-4" aria-hidden="true" /></a></section> : null}
    <section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Antrean kerja</p><h2 className="section-title mt-1">Pekerjaan aktif</h2></div><Link href="/orders" className="text-sm font-semibold text-moss hover:underline">Semua order</Link></div><div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filter antrean">{filters.map((item) => <button key={item.status} type="button" className={`chip ${filter === item.status ? 'chip-active' : ''}`} aria-pressed={filter === item.status} onClick={() => setFilter(item.status)}>{item.label}</button>)}</div>{queue.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{queue.map((order) => <OrderCard key={order.id} order={order} />)}</div> : <EmptyState title="Antrean kosong" description="Tidak ada order pada tahap ini." />}</section>
    {data.overdueOrders.length ? <section className="mt-8" id="overdue"><p className="eyebrow text-red-700">Perlu perhatian</p><h2 className="section-title mt-1 mb-4">Order terlambat</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.overdueOrders.map((order) => <OrderCard key={order.id} order={order} />)}</div></section> : null}
    <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:hidden"><Link className="btn-secondary" href="/orders"><Search className="size-5" aria-hidden="true" />Cari order</Link><Link className="btn-secondary" href="/orders?status=READY"><PackageCheck className="size-5" aria-hidden="true" />Siap diambil</Link></section>
  </div>;
}
