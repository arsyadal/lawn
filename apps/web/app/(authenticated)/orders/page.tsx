'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { OrderCard } from '@/components/OrderCard';
import { EmptyState, ErrorState, LoadingPage, PageHeader } from '@/components/ui';
import { api, listResult } from '@/lib/api';
import { canCreateOrder } from '@/lib/permissions';
import type { OrderStatus, OrderSummary } from '@/lib/types';
import type { ApiOrderSummary } from '@/lib/adapters';
import { normalizeOrderSummary } from '@/lib/adapters';

const filters: Array<{ label: string; value: OrderStatus | '' }> = [{ label: 'Semua', value: '' }, { label: 'Diterima', value: 'RECEIVED' }, { label: 'Dicuci', value: 'WASHING' }, { label: 'Dikeringkan', value: 'DRYING' }, { label: 'QC', value: 'QUALITY_CHECK' }, { label: 'Siap', value: 'READY' }, { label: 'Selesai', value: 'COMPLETED' }, { label: 'Batal', value: 'CANCELLED' }];

type OrderListResponse = ApiOrderSummary[] | { data?: ApiOrderSummary[]; items?: ApiOrderSummary[]; total?: number };

function OrdersContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [submittedQuery, setSubmittedQuery] = useState(searchParams.get('q') ?? '');
  const [status, setStatus] = useState<OrderStatus | ''>((searchParams.get('status') as OrderStatus | null) ?? '');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (submittedQuery) params.set('search', submittedQuery);
    if (status) params.set('status', status);
    try {
      const response = await api<OrderListResponse>(`/orders?${params}`);
      const result = listResult(response);
      setOrders(result.data.map(normalizeOrderSummary)); setTotal(result.total);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Daftar order tidak dapat dimuat.'); }
    finally { setLoading(false); }
  }, [status, submittedQuery]);

  useEffect(() => { void load(); }, [load]);
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSubmittedQuery(query.trim()); }

  return <div className="page-enter"><PageHeader eyebrow="Operasional" title="Order" description={loading ? 'Memuat order...' : `${total} order ditemukan`} action={canCreateOrder(user.role) ? <Link className="btn-primary" href="/orders/new"><Plus className="size-5" aria-hidden="true" />Order baru</Link> : null} />
    <form onSubmit={search} className="relative mb-4" role="search"><Search className="pointer-events-none absolute left-4 top-3.5 size-5 text-muted" aria-hidden="true" /><label className="sr-only" htmlFor="order-search">Cari order, pelanggan, nomor HP, atau merek sepatu</label><input className="field pl-12 pr-24" id="order-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nomor order, nama, HP, merek..." /><button className="absolute right-1.5 top-1.5 min-h-9 rounded-lg bg-moss px-3 text-sm font-semibold text-white" type="submit">Cari</button></form>
    <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filter status">{filters.map((filter) => <button className={`chip ${status === filter.value ? 'chip-active' : ''}`} type="button" aria-pressed={status === filter.value} key={filter.value} onClick={() => setStatus(filter.value)}>{filter.label}</button>)}</div>
    {loading ? <LoadingPage label="Memuat daftar order" /> : error ? <ErrorState message={error} retry={() => void load()} /> : orders.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{orders.map((order) => <OrderCard order={order} key={order.id} />)}</div> : <EmptyState title="Order tidak ditemukan" description={submittedQuery || status ? 'Ubah kata pencarian atau filter status.' : 'Buat order pertama untuk mulai mencatat pekerjaan.'} actionHref={canCreateOrder(user.role) ? '/orders/new' : undefined} actionLabel="Buat order" />}
  </div>;
}

export default function OrdersPage() {
  return <Suspense fallback={<LoadingPage label="Memuat daftar order" />}><OrdersContent /></Suspense>;
}
