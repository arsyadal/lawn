'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Camera, Check, ChevronLeft, LoaderCircle, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Notice, PageHeader } from '@/components/ui';
import { api, listResult } from '@/lib/api';
import { apiDateTime, formatRupiah, toDateTimeLocal } from '@/lib/format';
import { canCreateOrder } from '@/lib/permissions';
import type { Customer, Order, PaymentMethod, PhotoCategory, Service } from '@/lib/types';
import type { ApiOrder, ApiService } from '@/lib/adapters';
import { normalizeOrder, normalizeService } from '@/lib/adapters';

interface StagedPhoto { id: string; file: File; category: PhotoCategory; error?: string }
interface DraftItem { key: string; brand: string; model: string; color: string; size: string; serviceId: string; conditionNotes: string; specialRequest: string; photos: StagedPhoto[] }
interface UploadRequest { uploadUrl: string; uploadId: string; headers?: Record<string, string> }

const emptyItem = (): DraftItem => ({ key: crypto.randomUUID(), brand: '', model: '', color: '', size: '', serviceId: '', conditionNotes: '', specialRequest: '', photos: [] });
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const PHOTO_TYPES: Record<string, true> = { 'image/jpeg': true, 'image/png': true, 'image/webp': true };
const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [{ value: 'CASH', label: 'Tunai' }, { value: 'QRIS', label: 'QRIS' }, { value: 'TRANSFER', label: 'Transfer' }, { value: 'E_WALLET', label: 'E-Wallet' }, { value: 'OTHER', label: 'Lainnya' }];

export default function NewOrderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [items, setItems] = useState<DraftItem[]>(() => [emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [estimatedCompletion, setEstimatedCompletion] = useState(() => toDateTimeLocal());
  const [notes, setNotes] = useState('');
  const [payNow, setPayNow] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [failedUploads, setFailedUploads] = useState<Array<{ itemIndex: number; photo: StagedPhoto }>>([]);

  useEffect(() => {
    api<ApiService[] | { data?: ApiService[]; items?: ApiService[] }>('/services').then((response) => setServices(listResult(response).data.map(normalizeService))).catch((cause) => setError(cause instanceof Error ? cause.message : 'Layanan tidak dapat dimuat.'));
  }, []);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (services.find((service) => service.id === item.serviceId)?.price ?? 0), 0), [items, services]);
  const total = Math.max(0, subtotal - discount);

  function updateItem(key: string, changes: Partial<DraftItem>) { setItems((current) => current.map((item) => item.key === key ? { ...item, ...changes } : item)); }
  function removeItem(key: string) { setItems((current) => current.length === 1 ? current : current.filter((item) => item.key !== key)); }

  async function searchCustomers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    try { const response = await api<Customer[] | { data?: Customer[]; items?: Customer[] }>(`/customers?search=${encodeURIComponent(customerQuery.trim())}`); setCustomers(listResult(response).data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Pelanggan tidak dapat dicari.'); }
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const created = await api<Customer>('/customers', { method: 'POST', body: { name: String(form.get('name') ?? '').trim(), phone: String(form.get('phone') ?? '').trim(), email: String(form.get('email') ?? '').trim() || undefined, address: String(form.get('address') ?? '').trim() || undefined } });
      setCustomer(created); setShowCustomerForm(false); setCustomers([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Pelanggan tidak dapat dibuat.'); }
  }

  function addPhotos(item: DraftItem, category: PhotoCategory, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const invalid = files.find((file) => !PHOTO_TYPES[file.type] || file.size > MAX_PHOTO_SIZE);
    if (invalid) { setError(`${invalid.name}: gunakan JPG, PNG, atau WebP maksimal 10 MiB.`); event.target.value = ''; return; }
    updateItem(item.key, { photos: [...item.photos, ...files.map((file) => ({ id: crypto.randomUUID(), file, category }))] });
    event.target.value = '';
  }

  async function uploadPhoto(order: Order, itemIndex: number, photo: StagedPhoto) {
    const orderItem = order.items[itemIndex];
    if (!orderItem) throw new Error('Item hasil order tidak cocok dengan foto.');
    const upload = await api<UploadRequest>('/uploads', { method: 'POST', body: { orderId: order.id, orderItemId: orderItem.id, contentType: photo.file.type, sizeBytes: photo.file.size, category: photo.category } });
    const response = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': photo.file.type, ...upload.headers }, body: photo.file });
    if (!response.ok) throw new Error(`Upload ${photo.file.name} gagal (${response.status}).`);
    await api('/uploads/confirm', { method: 'POST', body: { uploadId: upload.uploadId } });
  }

  async function uploadStaged(order: Order, staged: Array<{ itemIndex: number; photo: StagedPhoto }>) {
    const failed: Array<{ itemIndex: number; photo: StagedPhoto }> = [];
    for (const entry of staged) {
      try { await uploadPhoto(order, entry.itemIndex, entry.photo); }
      catch (cause) { failed.push({ ...entry, photo: { ...entry.photo, error: cause instanceof Error ? cause.message : 'Upload gagal.' } }); }
    }
    setFailedUploads(failed);
    return failed;
  }

  async function submit() {
    setError(null);
    if (!customer) { setError('Pilih pelanggan sebelum membuat order.'); return; }
    if (!estimatedCompletion) { setError('Tentukan estimasi selesai sebelum membuat order.'); return; }
    if (items.some((item) => !item.brand.trim() || !item.model.trim() || !item.color.trim() || !item.serviceId)) { setError('Lengkapi merek, model, warna, dan layanan untuk setiap sepatu.'); return; }
    if (discount < 0 || discount > subtotal) { setError('Diskon harus berada di antara Rp0 dan subtotal.'); return; }
    if (payNow && (paymentAmount <= 0 || paymentAmount > total)) { setError('Nominal pembayaran harus lebih dari Rp0 dan tidak melebihi total.'); return; }
    setSubmitting(true);
    try {
      const response = await api<ApiOrder>('/orders', { method: 'POST', body: { customerId: customer.id, estimatedCompletion: apiDateTime(estimatedCompletion), notes: notes.trim() || undefined, discount, items: items.map((item) => ({ brand: item.brand.trim(), model: item.model.trim(), color: item.color.trim(), size: item.size.trim() || undefined, serviceId: item.serviceId, conditionNotes: item.conditionNotes.trim() || undefined, specialRequest: item.specialRequest.trim() || undefined })), initialPayment: payNow ? { amount: paymentAmount, method: paymentMethod } : undefined } });
      const order = normalizeOrder(response);
      if (order.trackingToken) sessionStorage.setItem(`lawn:tracking:${order.id}`, order.trackingToken);
      setCreatedOrder(order);
      const staged = items.flatMap((item, itemIndex) => item.photos.map((photo) => ({ itemIndex, photo })));
      const failed = await uploadStaged(order, staged);
      if (!failed.length) router.push(`/orders/${order.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Order tidak dapat dibuat.'); }
    finally { setSubmitting(false); }
  }

  async function retryUploads() {
    if (!createdOrder) return;
    setSubmitting(true); setError(null);
    const failed = await uploadStaged(createdOrder, failedUploads);
    setSubmitting(false);
    if (!failed.length) router.push(`/orders/${createdOrder.id}`);
  }

  if (!canCreateOrder(user.role)) return <Notice tone="danger">Peran STAFF tidak dapat membuat order baru.</Notice>;
  if (createdOrder && failedUploads.length) return <div className="max-w-xl page-enter"><PageHeader eyebrow="Order tersimpan" title={createdOrder.orderNumber} description="Order tetap tersimpan, tetapi beberapa foto belum berhasil diunggah." /><Notice tone="danger">{failedUploads.length} foto gagal. Foto tersebut belum tercatat dan aman untuk dicoba kembali.</Notice><ul className="mt-4 space-y-2">{failedUploads.map(({ photo }) => <li className="card" key={photo.id}><strong className="block text-sm">{photo.file.name}</strong><span className="text-xs text-red-700">{photo.error}</span></li>)}</ul><div className="mt-5 flex gap-3"><button className="btn-primary" disabled={submitting} onClick={() => void retryUploads()}>{submitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}Coba upload lagi</button><Link className="btn-secondary" href={`/orders/${createdOrder.id}`}>Buka order</Link></div></div>;

  return <div className="page-enter max-w-4xl"><Link href="/orders" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ChevronLeft className="size-5" aria-hidden="true" />Kembali ke order</Link><PageHeader eyebrow="Penerimaan" title="Order baru" description="Lengkapi pelanggan, sepatu, estimasi, lalu pilih pembayaran sekarang atau nanti." />{error ? <div className="mb-4"><Notice tone="danger">{error}</Notice></div> : null}
    <div className="space-y-5">
      <section className="card"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">01</p><h2 className="section-title">Pelanggan</h2></div>{customer ? <button className="text-sm font-semibold text-moss" type="button" onClick={() => setCustomer(null)}>Ganti</button> : null}</div>{customer ? <div className="flex items-center gap-3 rounded-xl bg-wash p-3"><span className="grid size-10 place-items-center rounded-full bg-moss text-white"><Check className="size-5" aria-hidden="true" /></span><div><strong className="block">{customer.name}</strong><span className="text-sm text-muted">{customer.phone}</span></div></div> : <><form className="relative flex gap-2" onSubmit={searchCustomers}><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3.5 size-5 text-muted" aria-hidden="true" /><label className="sr-only" htmlFor="customer-search">Cari nama atau nomor HP</label><input className="field pl-10" id="customer-search" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Nama atau nomor HP" /></div><button className="btn-secondary" type="submit">Cari</button></form>{customers.length ? <div className="mt-3 divide-y divide-line rounded-xl border border-line">{customers.map((result) => <button className="flex min-h-14 w-full items-center justify-between px-3 text-left hover:bg-wash" key={result.id} type="button" onClick={() => setCustomer(result)}><span><strong className="block text-sm">{result.name}</strong><span className="text-xs text-muted">{result.phone}</span></span><span className="text-sm font-semibold text-moss">Pilih</span></button>)}</div> : null}<button className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-moss" type="button" onClick={() => setShowCustomerForm((shown) => !shown)}><UserPlus className="size-5" aria-hidden="true" />Pelanggan baru</button>{showCustomerForm ? <form className="mt-3 grid gap-3 rounded-xl bg-wash p-4 sm:grid-cols-2" onSubmit={createCustomer}><div><label className="field-label" htmlFor="new-name">Nama *</label><input className="field" id="new-name" name="name" required /></div><div><label className="field-label" htmlFor="new-phone">Nomor HP *</label><input className="field" id="new-phone" name="phone" type="tel" required /></div><div><label className="field-label" htmlFor="new-email">Email</label><input className="field" id="new-email" name="email" type="email" /></div><div><label className="field-label" htmlFor="new-address">Alamat</label><input className="field" id="new-address" name="address" /></div><button className="btn-primary sm:col-span-2" type="submit">Simpan dan pilih pelanggan</button></form> : null}</>}</section>
      <section><div className="mb-3 flex items-end justify-between"><div><p className="eyebrow">02</p><h2 className="section-title">Sepatu dan treatment</h2></div><button className="btn-secondary" type="button" onClick={() => setItems((current) => [...current, emptyItem()])}><Plus className="size-4" aria-hidden="true" />Tambah sepatu</button></div><div className="space-y-4">{items.map((item, index) => { const selectedService = services.find((service) => service.id === item.serviceId); return <article className="card" key={item.key}><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Sepatu {index + 1}</h3><button className="icon-button size-10 text-red-700" type="button" disabled={items.length === 1} onClick={() => removeItem(item.key)} aria-label={`Hapus sepatu ${index + 1}`}><Trash2 className="size-4" aria-hidden="true" /></button></div><div className="grid gap-3 sm:grid-cols-2"><div><label className="field-label" htmlFor={`brand-${item.key}`}>Merek *</label><input className="field" id={`brand-${item.key}`} value={item.brand} onChange={(event) => updateItem(item.key, { brand: event.target.value })} required /></div><div><label className="field-label" htmlFor={`model-${item.key}`}>Model *</label><input className="field" id={`model-${item.key}`} value={item.model} onChange={(event) => updateItem(item.key, { model: event.target.value })} required /></div><div><label className="field-label" htmlFor={`color-${item.key}`}>Warna *</label><input className="field" id={`color-${item.key}`} value={item.color} onChange={(event) => updateItem(item.key, { color: event.target.value })} required /></div><div><label className="field-label" htmlFor={`size-${item.key}`}>Ukuran</label><input className="field" id={`size-${item.key}`} value={item.size} onChange={(event) => updateItem(item.key, { size: event.target.value })} /></div><div className="sm:col-span-2"><label className="field-label" htmlFor={`service-${item.key}`}>Layanan *</label><select className="field" id={`service-${item.key}`} value={item.serviceId} onChange={(event) => updateItem(item.key, { serviceId: event.target.value })} required><option value="">Pilih layanan</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name} · {formatRupiah(service.price)}</option>)}</select>{selectedService ? <p className="field-hint">Estimasi layanan {selectedService.estimatedDurationDays} hari.</p> : null}</div><div><label className="field-label" htmlFor={`condition-${item.key}`}>Kondisi awal</label><textarea className="field min-h-24" id={`condition-${item.key}`} value={item.conditionNotes} onChange={(event) => updateItem(item.key, { conditionNotes: event.target.value })} /></div><div><label className="field-label" htmlFor={`request-${item.key}`}>Permintaan khusus</label><textarea className="field min-h-24" id={`request-${item.key}`} value={item.specialRequest} onChange={(event) => updateItem(item.key, { specialRequest: event.target.value })} /></div></div><div className="mt-4 border-t border-line pt-4"><p className="field-label">Foto kondisi</p><div className="flex flex-wrap gap-2"><label className="btn-secondary cursor-pointer"><Camera className="size-4" aria-hidden="true" />Foto sebelum<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => addPhotos(item, 'BEFORE', event)} /></label><label className="btn-secondary cursor-pointer"><Camera className="size-4" aria-hidden="true" />Foto masalah<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => addPhotos(item, 'PROBLEM', event)} /></label></div>{item.photos.length ? <ul className="mt-3 space-y-1 text-sm text-muted">{item.photos.map((photo) => <li className="flex items-center justify-between gap-2" key={photo.id}><span className="truncate">{photo.category === 'BEFORE' ? 'Sebelum' : 'Masalah'} · {photo.file.name}</span><button className="min-h-10 shrink-0 px-2 font-semibold text-red-700" type="button" onClick={() => updateItem(item.key, { photos: item.photos.filter((candidate) => candidate.id !== photo.id) })}>Hapus</button></li>)}</ul> : null}<p className="field-hint">JPG, PNG, atau WebP. Maksimal 10 MiB per foto.</p></div></article>; })}</div></section>
      <section className="card"><p className="eyebrow">03</p><h2 className="section-title mb-4">Penyelesaian dan pembayaran</h2><div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label" htmlFor="estimated">Estimasi selesai *</label><input className="field" id="estimated" type="datetime-local" value={estimatedCompletion} onChange={(event) => setEstimatedCompletion(event.target.value)} required /></div><div><label className="field-label" htmlFor="discount">Diskon tetap</label><input className="field" id="discount" type="number" min="0" max={subtotal} value={discount || ''} onChange={(event) => setDiscount(Number(event.target.value))} inputMode="numeric" /></div><div className="sm:col-span-2"><label className="field-label" htmlFor="notes">Catatan order</label><textarea className="field min-h-24" id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div></div><div className="mt-5 rounded-xl bg-wash p-4"><div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-mono tabular-nums">{formatRupiah(subtotal)}</span></div><div className="mt-2 flex justify-between text-sm"><span>Diskon</span><span className="font-mono tabular-nums">-{formatRupiah(discount)}</span></div><div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-semibold"><span>Total</span><span className="font-mono tabular-nums">{formatRupiah(total)}</span></div></div><fieldset className="mt-5"><legend className="field-label">Pembayaran</legend><div className="grid grid-cols-2 gap-2"><button className={`btn-secondary ${!payNow ? '!border-moss !bg-wash' : ''}`} type="button" aria-pressed={!payNow} onClick={() => setPayNow(false)}>Bayar nanti</button><button className={`btn-secondary ${payNow ? '!border-moss !bg-wash' : ''}`} type="button" aria-pressed={payNow} onClick={() => { setPayNow(true); setPaymentAmount(total); }}>Bayar sekarang</button></div>{payNow ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="field-label" htmlFor="payment-amount">Nominal *</label><input className="field" id="payment-amount" type="number" min="1" max={total} value={paymentAmount || ''} onChange={(event) => setPaymentAmount(Number(event.target.value))} /></div><div><label className="field-label" htmlFor="payment-method">Metode *</label><select className="field" id="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></div></div> : null}</fieldset></section>
      <div className="sticky bottom-[calc(5rem+var(--safe-bottom))] z-10 rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur lg:bottom-4"><button className="btn-primary w-full" type="button" disabled={submitting || !customer || subtotal === 0} onClick={() => void submit()}>{submitting ? <><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Menyimpan order...</> : <>Buat order · {formatRupiah(total)}</>}</button></div>
    </div>
  </div>;
}
