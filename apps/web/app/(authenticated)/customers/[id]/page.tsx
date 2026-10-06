'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Mail, MapPin, Phone } from 'lucide-react';
import { OrderCard } from '@/components/OrderCard';
import { EmptyState, ErrorState, LoadingPage, PageHeader } from '@/components/ui';
import { formatNumber, formatRupiah } from '@/lib/format';
import type { ApiCustomerDetail } from '@/lib/adapters';
import { normalizeCustomerDetail } from '@/lib/adapters';
import { useApiData } from '@/lib/useApiData';

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, loading, error, refresh } = useApiData<ApiCustomerDetail>(`/customers/${params.id}`);
  if (loading) return <LoadingPage label="Memuat pelanggan" />;
  if (error || !data) return <ErrorState message={error ?? 'Pelanggan tidak ditemukan.'} retry={() => void refresh()} />;
  const customer = normalizeCustomerDetail(data);
  const stats = [{ label: 'Total order', value: formatNumber(customer.totalOrders ?? customer.orders?.length ?? 0) }, { label: 'Total belanja', value: formatRupiah(customer.totalSpending ?? 0) }, { label: 'Order aktif', value: formatNumber(customer.activeOrders ?? 0) }];
  return <div className="page-enter"><Link className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink" href="/customers"><ChevronLeft className="size-5" aria-hidden="true" />Kembali ke pelanggan</Link><PageHeader eyebrow="Profil pelanggan" title={customer.name} description={`Terdaftar sejak ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(customer.createdAt))}`} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><div><section className="grid grid-cols-3 gap-3">{stats.map((stat) => <article className="card min-w-0" key={stat.label}><p className="text-xs font-semibold text-muted">{stat.label}</p><p className="mt-1 truncate font-mono text-lg font-semibold tabular-nums sm:text-2xl">{stat.value}</p></article>)}</section><section className="mt-6"><p className="eyebrow">Riwayat</p><h2 className="section-title mt-1 mb-4">Order pelanggan</h2>{customer.orders?.length ? <div className="grid gap-3 xl:grid-cols-2">{customer.orders.map((order) => <OrderCard order={order} key={order.id} />)}</div> : <EmptyState title="Belum ada order" description="Riwayat order pelanggan akan muncul di sini." actionHref="/orders/new" actionLabel="Buat order" />}</section></div>
      <aside className="card h-fit"><p className="eyebrow">Kontak</p><dl className="mt-4 space-y-4 text-sm"><div className="flex gap-3"><Phone className="size-5 shrink-0 text-moss" aria-hidden="true" /><div><dt className="text-muted">Nomor HP</dt><dd><a className="font-semibold hover:underline" href={`tel:${customer.phone}`}>{customer.phone}</a></dd></div></div>{customer.email ? <div className="flex gap-3"><Mail className="size-5 shrink-0 text-moss" aria-hidden="true" /><div className="min-w-0"><dt className="text-muted">Email</dt><dd className="break-words font-semibold">{customer.email}</dd></div></div> : null}{customer.address ? <div className="flex gap-3"><MapPin className="size-5 shrink-0 text-moss" aria-hidden="true" /><div><dt className="text-muted">Alamat</dt><dd className="font-semibold">{customer.address}</dd></div></div> : null}</dl>{customer.notes ? <div className="mt-5 border-t border-line pt-4"><p className="text-xs font-semibold text-muted">Catatan</p><p className="mt-1 text-sm leading-6">{customer.notes}</p></div> : null}</aside></div>
  </div>;
}
