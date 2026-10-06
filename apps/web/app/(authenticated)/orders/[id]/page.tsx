'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Camera, Check, ChevronLeft, Clipboard, Download, ExternalLink, LoaderCircle, MessageCircle, Printer, RotateCw, Share2, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { PaymentBadge, StatusBadge, orderLabels, paymentLabels } from '@/components/StatusBadge';
import { ErrorState, LoadingPage, Notice, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, formatRupiah } from '@/lib/format';
import { downloadInvoicePdf } from '@/lib/invoice';
import { canManagePayments, canRotateTracking, canViewAudit } from '@/lib/permissions';
import type { ItemPhoto, Order, OrderItem, OrderStatus, PaymentMethod, PhotoCategory } from '@/lib/types';
import { useApiData } from '@/lib/useApiData';
import { whatsappLink } from '@/lib/whatsapp';
import type { ApiOrder } from '@/lib/adapters';
import { normalizeOrder } from '@/lib/adapters';

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = { RECEIVED: 'WASHING', WASHING: 'DRYING', DRYING: 'QUALITY_CHECK', QUALITY_CHECK: 'READY', READY: 'COMPLETED' };
const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [{ value: 'CASH', label: 'Tunai' }, { value: 'QRIS', label: 'QRIS' }, { value: 'TRANSFER', label: 'Transfer' }, { value: 'E_WALLET', label: 'E-Wallet' }, { value: 'OTHER', label: 'Lainnya' }];
const photoLabels: Record<PhotoCategory, string> = { BEFORE: 'Sebelum', PROBLEM: 'Masalah', AFTER: 'Sesudah' };
interface UploadRequest { uploadUrl: string; uploadId: string; headers?: Record<string, string> }

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const result = useApiData<ApiOrder>(`/orders/${params.id}`);
  const { error, loading, refresh } = result;
  const order = result.data ? normalizeOrder(result.data) : null;
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showPayment, setShowPayment] = useState<'PAYMENT' | 'REFUND' | null>(null);

  const perform = useCallback(async (key: string, action: () => Promise<unknown>) => {
    setBusy(key); setActionError(null);
    try { await action(); await refresh(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Tindakan tidak dapat disimpan.'); }
    finally { setBusy(null); }
  }, [refresh]);

  if (loading) return <LoadingPage label="Memuat detail order" />;
  if (error || !order) return <ErrorState message={error ?? 'Order tidak ditemukan.'} retry={() => void refresh()} />;
  const next = nextStatus[order.status];
  const terminal = order.status === 'COMPLETED' || order.status === 'CANCELLED';
  const waUrl = whatsappLink(order);

  const updateStatus = async (status: OrderStatus) => {
    await perform('status', () => api(`/orders/${order.id}/status`, { method: 'POST', body: { status, note: statusNote.trim() || undefined } }));
    setStatusNote(''); setShowCancel(false);
  };

  const shareInvoice = async () => {
    const url = window.location.href;
    if (navigator.share) { await navigator.share({ title: `Invoice ${order.orderNumber}`, text: `Invoice ${order.orderNumber} untuk ${order.customer.name}`, url }); return; }
    await navigator.clipboard.writeText(url);
    window.alert('Tautan invoice sudah disalin.');
  };

  return <div className="page-enter"><Link href="/orders" className="no-print mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ChevronLeft className="size-5" aria-hidden="true" />Kembali ke order</Link><PageHeader eyebrow={order.orderNumber} title={order.customer.name} description={`${order.customer.phone} · dibuat ${formatDateTime(order.createdAt)}`} action={<div className="flex flex-wrap gap-2"><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} /></div>} />
    {actionError ? <div className="no-print mb-4"><Notice tone="danger">{actionError}</Notice></div> : null}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(330px,.6fr)]"><div className="space-y-5">
      {!terminal ? <section className="no-print card"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">Alur pengerjaan</p><h2 className="section-title mt-1">{next ? `Lanjut ke ${orderLabels[next]}` : 'Perbarui status'}</h2><p className="mt-1 text-sm text-muted">Setiap perubahan tercatat beserta pengguna dan waktunya.</p></div>{next ? <button className="btn-primary shrink-0" disabled={busy === 'status'} onClick={() => void updateStatus(next)}>{busy === 'status' ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}{orderLabels[next]}</button> : null}</div><label className="field-label mt-4" htmlFor="status-note">Catatan perubahan (opsional)</label><input className="field" id="status-note" value={statusNote} onChange={(event) => setStatusNote(event.target.value)} placeholder="Contoh: noda perlu treatment ulang" /><div className="mt-3"><button className="min-h-11 text-sm font-semibold text-red-700" type="button" onClick={() => setShowCancel((shown) => !shown)}>Batalkan order</button>{showCancel ? <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3"><span className="mr-auto text-sm text-red-800">Pembatalan tidak dapat dibalik.</span><button className="btn-danger" disabled={busy === 'status'} onClick={() => void updateStatus('CANCELLED')}><X className="size-4" aria-hidden="true" />Ya, batalkan</button></div> : null}</div></section> : null}
      <section><div className="mb-3 flex items-end justify-between"><div><p className="eyebrow">Item</p><h2 className="section-title mt-1">Sepatu dan treatment</h2></div><span className="font-mono text-sm text-muted">{order.items.length} item</span></div><div className="space-y-4">{order.items.map((item, index) => <OrderItemPanel key={item.id} order={order} item={item} index={index} busy={busy} setBusy={setBusy} onError={setActionError} onSaved={refresh} />)}</div></section>
      <section className="card"><div className="flex items-end justify-between"><div><p className="eyebrow">Pembayaran</p><h2 className="section-title mt-1">Riwayat transaksi</h2></div><PaymentBadge status={order.paymentStatus} /></div><div className="mt-4 rounded-xl bg-wash p-4"><div className="flex justify-between text-sm"><span>Total order</span><span className="font-mono">{formatRupiah(order.total)}</span></div><div className="mt-2 flex justify-between text-sm"><span>Netto diterima</span><span className="font-mono">{formatRupiah(order.netPaid)}</span></div><div className="mt-3 flex justify-between border-t border-line pt-3 font-semibold"><span>Sisa tagihan</span><span className="font-mono">{formatRupiah(order.balance)}</span></div></div>{canManagePayments(user.role) ? <div className="no-print mt-4 flex flex-wrap gap-2"><button className="btn-primary" type="button" disabled={order.balance <= 0} onClick={() => setShowPayment('PAYMENT')}>Catat pembayaran</button><button className="btn-secondary" type="button" disabled={order.netPaid <= 0} onClick={() => setShowPayment('REFUND')}>Catat refund</button></div> : null}{showPayment ? <PaymentForm order={order} type={showPayment} close={() => setShowPayment(null)} saved={refresh} /> : null}{order.payments.length ? <ul className="mt-5 divide-y divide-line">{order.payments.map((payment) => <li className="flex items-start justify-between gap-3 py-3 text-sm" key={payment.id}><span><strong className={payment.type === 'REFUND' ? 'text-red-700' : ''}>{payment.type === 'REFUND' ? 'Refund' : 'Pembayaran'} · {payment.method}</strong><span className="block text-xs text-muted">{formatDateTime(payment.createdAt)}{payment.referenceNumber ? ` · ${payment.referenceNumber}` : ''}</span></span><strong className="font-mono tabular-nums">{payment.type === 'REFUND' ? '-' : '+'}{formatRupiah(payment.amount)}</strong></li>)}</ul> : <p className="mt-5 text-sm text-muted">Belum ada transaksi.</p>}</section>
      {canViewAudit(user.role) ? <section className="card"><p className="eyebrow">Audit</p><h2 className="section-title mt-1">Aktivitas order</h2><ol className="mt-4 space-y-4 border-l border-line pl-5">{order.history.map((entry) => <li className="relative" key={entry.id}><span className="absolute -left-[25px] top-1 size-2 rounded-full bg-moss ring-4 ring-white" /><strong className="block text-sm">{entry.label ?? (entry.toStatus ? `${entry.fromStatus ? orderLabels[entry.fromStatus] : 'Order'} → ${orderLabels[entry.toStatus]}` : entry.type)}</strong><span className="text-xs text-muted">{formatDateTime(entry.createdAt)}{entry.actorName ? ` · ${entry.actorName}` : ''}</span>{entry.note ? <p className="mt-1 text-sm text-muted">{entry.note}</p> : null}</li>)}</ol></section> : null}
    </div><aside className="space-y-5">
      <section className="invoice-print card"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-2xl font-semibold text-moss">Lawn</p><p className="mt-1 text-sm font-semibold">{order.tenant?.businessName}</p><p className="max-w-xs text-xs leading-5 text-muted">{order.tenant?.address}<br />{order.tenant?.phone}</p></div><div className="text-right"><p className="text-xl font-semibold">INVOICE</p><p className="font-mono text-sm text-moss">{order.orderNumber}</p><p className="text-xs text-muted">{formatDate(order.createdAt)}</p></div></div><div className="my-5 border-y border-line py-4 text-sm"><div className="flex justify-between gap-4"><span className="text-muted">Pelanggan</span><strong>{order.customer.name}</strong></div><div className="mt-2 flex justify-between gap-4"><span className="text-muted">Estimasi selesai</span><strong>{formatDate(order.estimatedCompletion)}</strong></div></div><div className="space-y-3">{order.items.map((item) => <div className="flex justify-between gap-3 text-sm" key={item.id}><span><strong className="block">{item.brand} {item.model}</strong><span className="text-muted">{item.serviceName}</span></span><span className="shrink-0 font-mono">{formatRupiah(item.price)}</span></div>)}</div><div className="mt-5 space-y-2 border-t border-line pt-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatRupiah(order.subtotal)}</span></div><div className="flex justify-between"><span>Diskon</span><span className="font-mono">-{formatRupiah(order.discount)}</span></div><div className="flex justify-between border-t border-line pt-3 text-lg font-semibold"><span>Total</span><span className="font-mono">{formatRupiah(order.total)}</span></div><div className="flex justify-between"><span>Status bayar</span><strong>{paymentLabels[order.paymentStatus]}</strong></div></div></section>
      <section className="no-print card"><p className="eyebrow">Invoice dan kontak</p><div className="mt-3 grid grid-cols-2 gap-2"><button className="btn-secondary" onClick={() => window.print()}><Printer className="size-4" aria-hidden="true" />Cetak</button><button className="btn-secondary" onClick={() => downloadInvoicePdf(order, order.tenant)}><Download className="size-4" aria-hidden="true" />PDF</button><button className="btn-secondary" onClick={() => void shareInvoice()}><Share2 className="size-4" aria-hidden="true" />Bagikan</button><a className="btn-secondary" href={waUrl} target="_blank" rel="noreferrer"><MessageCircle className="size-4" aria-hidden="true" />WhatsApp</a></div>{order.status === 'READY' ? <a className="btn-primary mt-3 w-full" href={waUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" aria-hidden="true" />Kabari siap diambil</a> : null}</section>
      {canRotateTracking(user.role) ? <TrackingLink order={order} onSaved={refresh} /> : null}
    </aside></div>
  </div>;
}

function OrderItemPanel({ order, item, index, busy, setBusy, onError, onSaved }: { order: Order; item: OrderItem; index: number; busy: string | null; setBusy: (value: string | null) => void; onError: (value: string | null) => void; onSaved: () => Promise<void> }) {
  const [notes, setNotes] = useState(item.treatmentNotes ?? '');
  async function saveNotes() {
    setBusy(`notes-${item.id}`); onError(null);
    try { await api(`/orders/${order.id}/items/${item.id}`, { method: 'PATCH', body: { treatmentNotes: notes.trim() || null } }); await onSaved(); }
    catch (cause) { onError(cause instanceof Error ? cause.message : 'Catatan treatment tidak dapat disimpan.'); }
    finally { setBusy(null); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { onError('Gunakan JPG, PNG, atau WebP maksimal 10 MiB.'); return; }
    setBusy(`photo-${item.id}`); onError(null);
    try {
      const signed = await api<UploadRequest>('/uploads', { method: 'POST', body: { orderId: order.id, orderItemId: item.id, contentType: file.type, sizeBytes: file.size, category: 'AFTER' } });
      const response = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type, ...signed.headers }, body: file });
      if (!response.ok) throw new Error(`Upload gagal (${response.status}).`);
      await api('/uploads/confirm', { method: 'POST', body: { uploadId: signed.uploadId } });
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : 'Foto tidak dapat diunggah.'); }
    finally { setBusy(null); }
  }
  return <article className="card"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Sepatu {index + 1}</p><h3 className="mt-1 text-lg font-semibold">{item.brand} {item.model}</h3><p className="text-sm text-muted">{item.color}{item.size ? ` · Ukuran ${item.size}` : ''}</p></div><strong className="font-mono text-sm">{formatRupiah(item.price)}</strong></div><div className="mt-4 rounded-xl bg-wash p-3 text-sm"><strong>{item.serviceName}</strong>{item.conditionNotes ? <p className="mt-1 text-muted">Kondisi: {item.conditionNotes}</p> : null}{item.specialRequest ? <p className="mt-1 text-muted">Permintaan: {item.specialRequest}</p> : null}</div><div className="mt-4"><label className="field-label" htmlFor={`notes-${item.id}`}>Catatan treatment</label><div className="flex flex-col gap-2 sm:flex-row"><textarea className="field min-h-20 flex-1" id={`notes-${item.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} /><button className="btn-secondary self-end" disabled={busy === `notes-${item.id}`} onClick={() => void saveNotes()}>Simpan</button></div></div><div className="mt-4"><div className="flex items-center justify-between"><p className="field-label">Dokumentasi</p><label className="btn-secondary cursor-pointer"><Camera className="size-4" aria-hidden="true" />Foto sesudah<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void upload(event)} /></label></div>{item.photos?.length ? <div className="mt-3 grid grid-cols-3 gap-2">{item.photos.map((photo) => <PrivatePhoto photo={photo} item={item} key={photo.id} />)}</div> : <p className="mt-2 text-sm text-muted">Belum ada foto tersimpan.</p>}</div></article>;
}
function PrivatePhoto({ photo, item }: { photo: ItemPhoto; item: OrderItem }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api<{ downloadUrl: string }>(`/photos/${photo.id}/download`).then((response) => { if (active) setUrl(response.downloadUrl); }).catch(() => undefined);
    return () => { active = false; };
  }, [photo.id]);
  if (!url) return <div className="skeleton aspect-square" aria-label={`Memuat foto ${photoLabels[photo.category]}`} />;
  return <a className="relative aspect-square overflow-hidden rounded-xl border border-line bg-wash" href={url} target="_blank" rel="noreferrer"><img className="size-full object-cover" src={url} alt={`${photoLabels[photo.category]} ${item.brand} ${item.model}`} loading="lazy" /><span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">{photoLabels[photo.category]}</span></a>;
}


function PaymentForm({ order, type, close, saved }: { order: Order; type: 'PAYMENT' | 'REFUND'; close: () => void; saved: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError(null);
    const form = new FormData(event.currentTarget);
    try { await api(`/orders/${order.id}/payments`, { method: 'POST', body: { type, amount: Number(form.get('amount')), method: String(form.get('method')), referenceNumber: String(form.get('referenceNumber') ?? '').trim() || undefined, note: String(form.get('note') ?? '').trim() || undefined } }); await saved(); close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Transaksi tidak dapat disimpan.'); }
    finally { setSubmitting(false); }
  }
  const max = type === 'PAYMENT' ? order.balance : order.netPaid;
  return <form className="no-print mt-4 rounded-xl border border-line bg-wash p-4" onSubmit={submit}><div className="flex items-center justify-between"><h3 className="font-semibold">{type === 'PAYMENT' ? 'Pembayaran baru' : 'Refund baru'}</h3><button className="icon-button size-10" type="button" onClick={close} aria-label="Tutup formulir"><X className="size-4" aria-hidden="true" /></button></div>{error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}<div className="mt-3 grid gap-3 sm:grid-cols-2"><div><label className="field-label" htmlFor={`${type}-amount`}>Nominal *</label><input className="field" id={`${type}-amount`} name="amount" type="number" min="1" max={max} defaultValue={max} required /></div><div><label className="field-label" htmlFor={`${type}-method`}>Metode *</label><select className="field" id={`${type}-method`} name="method">{paymentMethods.map((method) => <option value={method.value} key={method.value}>{method.label}</option>)}</select></div><div><label className="field-label" htmlFor={`${type}-reference`}>Nomor referensi</label><input className="field" id={`${type}-reference`} name="referenceNumber" /></div><div><label className="field-label" htmlFor={`${type}-note`}>Catatan</label><input className="field" id={`${type}-note`} name="note" /></div></div><button className={type === 'REFUND' ? 'btn-danger mt-4 w-full' : 'btn-primary mt-4 w-full'} disabled={submitting}>{submitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}Simpan {type === 'REFUND' ? 'refund' : 'pembayaran'}</button></form>;
}

function TrackingLink({ order, onSaved }: { order: Order; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null); const [newToken, setNewToken] = useState<string | null>(() => (typeof window === 'undefined' ? null : window.sessionStorage.getItem(`lawn:tracking:${order.id}`)));
  const token = newToken ?? order.trackingToken;
  const url = order.trackingUrl ?? (token ? `${typeof window === 'undefined' ? '' : window.location.origin}/track/${token}` : '');
  async function rotate() { setBusy(true); setMessage(null); try { const response = await api<{ trackingToken: string }>(`/orders/${order.id}/tracking-token/rotate`, { method: 'POST' }); window.sessionStorage.setItem(`lawn:tracking:${order.id}`, response.trackingToken); setNewToken(response.trackingToken); setMessage('Tautan baru dibuat. Tautan lama sudah tidak berlaku.'); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Tautan tidak dapat diperbarui.'); } finally { setBusy(false); } }
  async function copy() { if (!url) return; await navigator.clipboard.writeText(url); setMessage('Tautan pelacakan disalin.'); }
  return <section className="no-print card"><p className="eyebrow">Pelacakan pelanggan</p><h2 className="section-title mt-1">Tautan privat</h2><p className="mt-1 text-sm text-muted">Siapa pun yang memiliki tautan dapat melihat status publik order.</p>{url ? <div className="mt-3 flex gap-2"><input className="field min-w-0" value={url} readOnly aria-label="Tautan pelacakan" /><button className="icon-button" onClick={() => void copy()} aria-label="Salin tautan"><Clipboard className="size-4" aria-hidden="true" /></button></div> : null}{message ? <p className="mt-2 text-xs text-muted" role="status">{message}</p> : null}<button className="btn-secondary mt-3 w-full" disabled={busy} onClick={() => void rotate()}>{busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <RotateCw className="size-4" aria-hidden="true" />}{url ? 'Buat ulang tautan' : 'Buat tautan'}</button></section>;
}
