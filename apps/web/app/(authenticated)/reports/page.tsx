'use client';

import { useState } from 'react';
import { BarChart3, Banknote, CheckCircle2, ClipboardList } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { EmptyState, ErrorState, LoadingPage, Notice, PageHeader } from '@/components/ui';
import { formatNumber, formatRupiah, jakartaDateInput } from '@/lib/format';
import { canViewReports } from '@/lib/permissions';
import type { ApiReport } from '@/lib/adapters';
import { normalizeReport } from '@/lib/adapters';
import { useApiData } from '@/lib/useApiData';

type Range = 'TODAY' | 'YESTERDAY' | '7_DAYS' | '30_DAYS' | 'CUSTOM';
const ranges: Array<{ value: Range; label: string }> = [{ value: 'TODAY', label: 'Hari ini' }, { value: 'YESTERDAY', label: 'Kemarin' }, { value: '7_DAYS', label: '7 hari' }, { value: '30_DAYS', label: '30 hari' }, { value: 'CUSTOM', label: 'Rentang' }];
const methodLabels: Record<string, string> = { CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', E_WALLET: 'E-Wallet', OTHER: 'Lainnya' };

export default function ReportsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>('TODAY');
  const [from, setFrom] = useState(jakartaDateInput());
  const [to, setTo] = useState(jakartaDateInput());
  const query = range === 'CUSTOM' ? `preset=CUSTOM&from=${from}&to=${to}` : `preset=${range}`;
  const result = useApiData<ApiReport>(`/reports?${query}`);
  if (!canViewReports(user.role)) return <Notice tone="danger">Peran STAFF tidak dapat melihat laporan bisnis.</Notice>;
  const data = result.data ? normalizeReport(result.data) : null;
  const metrics = data ? [{ label: 'Netto diterima', value: formatRupiah(data.netCollected), icon: Banknote }, { label: 'Order dibuat', value: formatNumber(data.orderCount), icon: ClipboardList }, { label: 'Order selesai', value: formatNumber(data.completedCount), icon: CheckCircle2 }, { label: 'Masih aktif', value: formatNumber(data.activeCount), icon: BarChart3 }] : [];
  const paymentMax = data ? Math.max(1, ...data.byPaymentMethod.map((entry) => Math.abs(entry.amount))) : 1;
  const serviceMax = data ? Math.max(1, ...data.popularServices.map((entry) => entry.itemCount)) : 1;

  return (
    <div className="page-enter">
      <PageHeader eyebrow="Kinerja" title="Laporan" description="Tanggal order memakai waktu pembuatan. Pendapatan memakai waktu pembayaran atau refund di Asia/Jakarta." />
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Rentang laporan">
        {ranges.map((option) => <button className={`chip ${range === option.value ? 'chip-active' : ''}`} aria-pressed={range === option.value} onClick={() => setRange(option.value)} key={option.value}>{option.label}</button>)}
      </div>
      {range === 'CUSTOM' ? (
        <div className="card mb-5 grid gap-3 sm:grid-cols-2">
          <div><label className="field-label" htmlFor="report-from">Dari tanggal</label><input className="field" id="report-from" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></div>
          <div><label className="field-label" htmlFor="report-to">Sampai tanggal</label><input className="field" id="report-to" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></div>
        </div>
      ) : null}
      {result.loading ? (
        <LoadingPage label="Menghitung laporan" />
      ) : result.error || !data ? (
        <ErrorState message={result.error ?? 'Laporan tidak tersedia.'} retry={() => void result.refresh()} />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon }) => (
              <article className="card" key={label}>
                <Icon className="mb-4 size-6 text-moss" aria-hidden="true" />
                <p className="text-xs font-semibold text-muted sm:text-sm">{label}</p>
                <p className="metric-number mt-1 truncate">{value}</p>
              </article>
            ))}
          </section>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="card">
              <p className="eyebrow">Arus kas</p>
              <h2 className="section-title mt-1">Berdasarkan metode</h2>
              {data.byPaymentMethod.length ? (
                <div className="mt-5 space-y-4">
                  {data.byPaymentMethod.map((entry) => (
                    <div key={entry.method}>
                      <div className="mb-1.5 flex justify-between gap-3 text-sm">
                        <span>{methodLabels[entry.method]}</span>
                        <strong className="font-mono">{formatRupiah(entry.amount)}</strong>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-wash">
                        <div className="h-full rounded-full bg-moss" style={{ width: `${Math.max(2, Math.abs(entry.amount) / paymentMax * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5"><EmptyState title="Belum ada pembayaran" description="Tidak ada transaksi pada rentang ini." /></div>
              )}
            </section>
            <section className="card">
              <p className="eyebrow">Permintaan pelanggan</p>
              <h2 className="section-title mt-1">Layanan populer</h2>
              {data.popularServices.length ? (
                <div className="mt-5 space-y-4">
                  {data.popularServices.map((entry, index) => (
                    <div className="flex items-center gap-3" key={entry.serviceName}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-wash font-mono text-xs font-semibold text-moss">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="truncate font-semibold">{entry.serviceName}</span>
                          <span className="shrink-0 text-muted">{formatNumber(entry.itemCount)} item</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-wash">
                          <div className="h-full rounded-full bg-[#c75a3a]" style={{ width: `${entry.itemCount / serviceMax * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5"><EmptyState title="Belum ada layanan" description="Tidak ada item pada rentang ini." /></div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
