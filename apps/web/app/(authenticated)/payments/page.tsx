'use client';

import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { EmptyState, ErrorState, LoadingPage, Notice, PageHeader } from '@/components/ui';
import { listResult } from '@/lib/api';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { canManagePayments } from '@/lib/permissions';
import type { ApiPayment } from '@/lib/adapters';
import { normalizePayment } from '@/lib/adapters';
import { useApiData } from '@/lib/useApiData';

type PaymentResponse = ApiPayment[] | { data?: ApiPayment[]; items?: ApiPayment[]; total?: number; netCollected?: number };

export default function PaymentsPage() {
  const { user } = useAuth(); const result = useApiData<PaymentResponse>('/payments');
  if (!canManagePayments(user.role)) return <Notice tone="danger">Peran STAFF tidak dapat melihat atau mencatat pembayaran.</Notice>;
  if (result.loading) return <LoadingPage label="Memuat pembayaran" />;
  if (result.error || !result.data) return <ErrorState message={result.error ?? 'Pembayaran tidak tersedia.'} retry={() => void result.refresh()} />;
  const payments = listResult(result.data).data.map(normalizePayment);
  let net = 0; for (const payment of payments) net += payment.type === 'REFUND' ? -payment.amount : payment.amount;
  return <div className="page-enter"><PageHeader eyebrow="Kas" title="Pembayaran" description="Semua pembayaran dan refund dicatat sebagai transaksi yang tidak dapat diubah." />
    <section className="card mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold text-muted">Netto pada daftar ini</p><p className="metric-number mt-1">{formatRupiah(net)}</p></div><span className="grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><ArrowDownLeft aria-hidden="true" /></span></section>
    {payments.length ? <><div className="space-y-3 md:hidden">{payments.map((payment) => <Link className="card flex items-center gap-3" href={`/orders/${payment.orderId}`} key={payment.id}><span className={`grid size-10 shrink-0 place-items-center rounded-full ${payment.type === 'REFUND' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{payment.type === 'REFUND' ? <ArrowUpRight className="size-5" aria-hidden="true" /> : <ArrowDownLeft className="size-5" aria-hidden="true" />}</span><span className="min-w-0 flex-1"><strong className="block truncate">{payment.orderNumber}</strong><span className="block truncate text-xs text-muted">{payment.customerName} · {formatDateTime(payment.createdAt)}</span><span className="text-xs text-muted">{payment.method}{payment.referenceNumber ? ` · ${payment.referenceNumber}` : ''}</span></span><strong className={`font-mono text-sm ${payment.type === 'REFUND' ? 'text-red-700' : ''}`}>{payment.type === 'REFUND' ? '-' : '+'}{formatRupiah(payment.amount)}</strong><ChevronRight className="size-4 text-muted" aria-hidden="true" /></Link>)}</div><div className="table-wrap hidden md:block"><table className="data-table"><thead><tr><th>Waktu</th><th>Order</th><th>Pelanggan</th><th>Jenis</th><th>Metode</th><th className="text-right">Nominal</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{formatDateTime(payment.createdAt)}</td><td><Link className="font-mono font-semibold text-moss hover:underline" href={`/orders/${payment.orderId}`}>{payment.orderNumber}</Link></td><td>{payment.customerName}</td><td>{payment.type === 'REFUND' ? 'Refund' : 'Pembayaran'}</td><td>{payment.method}</td><td className={`text-right font-mono font-semibold ${payment.type === 'REFUND' ? 'text-red-700' : ''}`}>{payment.type === 'REFUND' ? '-' : '+'}{formatRupiah(payment.amount)}</td></tr>)}</tbody></table></div></> : <EmptyState title="Belum ada transaksi" description="Pembayaran yang dicatat dari detail order akan muncul di sini." />}
  </div>;
}
