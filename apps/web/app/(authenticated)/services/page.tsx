'use client';

import { FormEvent, useState } from 'react';
import { Clock3, Edit3, LoaderCircle, Plus, Power, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { EmptyState, ErrorState, LoadingPage, Notice, PageHeader } from '@/components/ui';
import { api, listResult } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { canManageServices } from '@/lib/permissions';
import type { Service } from '@/lib/types';
import type { ApiService } from '@/lib/adapters';
import { normalizeService } from '@/lib/adapters';
import { useApiData } from '@/lib/useApiData';

type ServiceResponse = ApiService[] | { data?: ApiService[]; items?: ApiService[] };

export default function ServicesPage() {
  const { user } = useAuth();
  const result = useApiData<ServiceResponse>('/services?includeInactive=true');
  const [editing, setEditing] = useState<Service | 'new' | null>(null); const [saving, setSaving] = useState(false); const [actionError, setActionError] = useState<string | null>(null);
  if (!canManageServices(user.role)) return <Notice tone="danger">Peran STAFF tidak dapat mengelola layanan.</Notice>;
  if (result.loading) return <LoadingPage label="Memuat layanan" />;
  if (result.error || !result.data) return <ErrorState message={result.error ?? 'Layanan tidak tersedia.'} retry={() => void result.refresh()} />;
  const services = listResult(result.data).data.map(normalizeService);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setActionError(null); const form = new FormData(event.currentTarget);
    const days = Number(form.get('estimatedDurationDays'));
    const body = { name: String(form.get('name') ?? '').trim(), description: String(form.get('description') ?? '').trim() || undefined, price: Number(form.get('price')), estimatedMinutes: Number.isFinite(days) && days > 0 ? Math.round(days * 1440) : undefined };
    try { if (editing === 'new') await api('/services', { method: 'POST', body }); else if (editing) await api(`/services/${editing.id}`, { method: 'PATCH', body }); setEditing(null); await result.refresh(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Layanan tidak dapat disimpan.'); }
    finally { setSaving(false); }
  }
  async function toggle(service: Service) { setActionError(null); try { await api(`/services/${service.id}`, { method: 'PATCH', body: { active: !service.active } }); await result.refresh(); } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Status layanan tidak dapat diubah.'); } }

  return <div className="page-enter"><PageHeader eyebrow="Katalog" title="Layanan" description="Atur treatment, harga, dan estimasi pengerjaan. Layanan nonaktif tetap tersimpan pada order lama." action={<button className="btn-primary" onClick={() => setEditing('new')}><Plus className="size-5" aria-hidden="true" />Layanan baru</button>} />{actionError ? <div className="mb-4"><Notice tone="danger">{actionError}</Notice></div> : null}
    {services.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{services.map((service) => <article className={`card ${service.active ? '' : 'opacity-65'}`} key={service.id}><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{service.name}</h2><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${service.active ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-200 text-stone-700'}`}>{service.active ? 'Aktif' : 'Nonaktif'}</span></div><strong className="font-mono text-sm tabular-nums">{formatRupiah(service.price)}</strong></div><p className="mt-3 min-h-10 text-sm leading-5 text-muted">{service.description || 'Tanpa deskripsi'}</p><p className="mt-3 flex items-center gap-2 text-sm"><Clock3 className="size-4 text-moss" aria-hidden="true" />{service.estimatedDurationDays} hari</p><div className="mt-4 flex gap-2 border-t border-line pt-4"><button className="btn-secondary flex-1" onClick={() => setEditing(service)}><Edit3 className="size-4" aria-hidden="true" />Ubah</button><button className="icon-button" onClick={() => void toggle(service)} aria-label={service.active ? `Nonaktifkan ${service.name}` : `Aktifkan ${service.name}`}><Power className="size-4" aria-hidden="true" /></button></div></article>)}</div> : <EmptyState title="Belum ada layanan" description="Tambahkan treatment agar dapat dipilih saat membuat order." />}
    {editing ? <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 sm:place-items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="service-form-title"><form className="w-full max-w-lg rounded-t-3xl bg-white p-5 sm:rounded-2xl" onSubmit={submit}><div className="flex items-center justify-between"><div><p className="eyebrow">Katalog layanan</p><h2 className="section-title" id="service-form-title">{editing === 'new' ? 'Layanan baru' : 'Ubah layanan'}</h2></div><button className="icon-button" type="button" onClick={() => setEditing(null)} aria-label="Tutup"><X className="size-5" aria-hidden="true" /></button></div><div className="mt-5 space-y-4"><div><label className="field-label" htmlFor="service-name">Nama *</label><input className="field" id="service-name" name="name" defaultValue={editing === 'new' ? '' : editing.name} required autoFocus /></div><div><label className="field-label" htmlFor="service-description">Deskripsi</label><textarea className="field min-h-20" id="service-description" name="description" defaultValue={editing === 'new' ? '' : editing.description ?? ''} /></div><div className="grid grid-cols-2 gap-3"><div><label className="field-label" htmlFor="service-price">Harga *</label><input className="field" id="service-price" name="price" type="number" min="0" defaultValue={editing === 'new' ? '' : editing.price} required /></div><div><label className="field-label" htmlFor="service-duration">Durasi (hari) *</label><input className="field" id="service-duration" name="estimatedDurationDays" type="number" min="1" defaultValue={editing === 'new' ? 3 : editing.estimatedDurationDays} required /></div></div></div><button className="btn-primary mt-5 w-full" disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}Simpan layanan</button></form></div> : null}
  </div>;
}
