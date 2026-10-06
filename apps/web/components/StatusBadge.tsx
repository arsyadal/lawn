import type { OrderStatus, PaymentStatus } from '@/lib/types';

const orderLabels: Record<OrderStatus, string> = { RECEIVED: 'Diterima', WASHING: 'Dicuci', DRYING: 'Dikeringkan', QUALITY_CHECK: 'Cek kualitas', READY: 'Siap diambil', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' };
const orderClasses: Record<OrderStatus, string> = { RECEIVED: 'bg-slate-100 text-slate-800', WASHING: 'bg-blue-100 text-blue-900', DRYING: 'bg-amber-100 text-amber-900', QUALITY_CHECK: 'bg-violet-100 text-violet-900', READY: 'bg-emerald-100 text-emerald-900', COMPLETED: 'bg-stone-200 text-stone-800', CANCELLED: 'bg-red-100 text-red-800' };
const paymentLabels: Record<PaymentStatus, string> = { UNPAID: 'Belum dibayar', PARTIAL: 'Dibayar sebagian', PAID: 'Lunas', REFUNDED: 'Dikembalikan' };

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${orderClasses[status] ?? 'bg-stone-200 text-stone-800'}`}>{orderLabels[status] ?? status}</span>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const classes = status === 'PAID' ? 'bg-emerald-100 text-emerald-900' : status === 'PARTIAL' ? 'bg-amber-100 text-amber-900' : status === 'REFUNDED' ? 'bg-blue-100 text-blue-900' : 'bg-red-100 text-red-800';
  return <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{paymentLabels[status] ?? status}</span>;
}

export { orderLabels, paymentLabels };
