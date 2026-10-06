import Link from 'next/link';
import { AlertTriangle, ChevronRight, Clock3 } from 'lucide-react';
import type { OrderSummary } from '@/lib/types';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { PaymentBadge, StatusBadge } from './StatusBadge';

export function OrderCard({ order, compact = false }: { order: OrderSummary; compact?: boolean }) {
  const itemLabel = order.items.map((item) => `${item.brand} ${item.model}`.trim()).join(', ');
  return <Link href={`/orders/${order.id}`} className="group block rounded-2xl border border-line bg-white p-4 shadow-panel transition-[border-color,box-shadow] hover:border-moss/40 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-moss">{order.orderNumber}</span>{order.overdue ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700"><AlertTriangle className="size-3.5" aria-hidden="true" />Terlambat</span> : null}</div><h3 className="mt-1 truncate font-semibold">{order.customer.name}</h3><p className="mt-0.5 line-clamp-2 text-sm text-muted">{itemLabel || 'Detail sepatu belum tersedia'}</p></div><ChevronRight className="mt-1 size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></div>{compact ? null : <div className="mt-4 flex flex-wrap items-center gap-2"><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} /></div>}<div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />{formatDateTime(order.estimatedCompletion)}</span><strong className="font-mono text-sm tabular-nums text-ink">{formatRupiah(order.total)}</strong></div></Link>;
}
