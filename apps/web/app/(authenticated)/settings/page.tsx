'use client';

import { FormEvent, useState } from 'react';
import { Building2, LoaderCircle, Save } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ErrorState, LoadingPage, Notice, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { canManageSettings } from '@/lib/permissions';
import type { TenantProfile } from '@/lib/types';
import { useApiData } from '@/lib/useApiData';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth(); const result = useApiData<TenantProfile>('/settings'); const [saving, setSaving] = useState(false); const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  if (!canManageSettings(user.role)) return <Notice tone="danger">Hanya OWNER yang dapat mengubah profil usaha.</Notice>;
  if (result.loading) return <LoadingPage label="Memuat pengaturan" />;
  if (result.error || !result.data) return <ErrorState message={result.error ?? 'Pengaturan tidak tersedia.'} retry={() => void result.refresh()} />;
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setMessage(null); const form = new FormData(event.currentTarget); try { await api('/settings', { method: 'PATCH', body: { businessName: String(form.get('businessName') ?? '').trim(), phone: String(form.get('phone') ?? '').trim(), address: String(form.get('address') ?? '').trim() } }); await Promise.all([result.refresh(), refreshUser()]); setMessage({ tone: 'success', text: 'Profil usaha sudah disimpan.' }); } catch (cause) { setMessage({ tone: 'danger', text: cause instanceof Error ? cause.message : 'Pengaturan tidak dapat disimpan.' }); } finally { setSaving(false); } }
  const tenant = result.data;
  return <div className="page-enter max-w-3xl"><PageHeader eyebrow="Konfigurasi" title="Pengaturan usaha" description="Informasi ini tampil pada invoice, halaman pelacakan, dan pesan pelanggan." />{message ? <div className="mb-4"><Notice tone={message.tone}>{message.text}</Notice></div> : null}<form className="card" onSubmit={submit}><div className="flex items-center gap-3 border-b border-line pb-5"><span className="grid size-12 place-items-center rounded-xl bg-wash text-moss"><Building2 aria-hidden="true" /></span><div><h2 className="font-semibold">Profil bisnis</h2><p className="text-sm text-muted">Data kontak untuk pelanggan</p></div></div><div className="mt-5 space-y-4"><div><label className="field-label" htmlFor="business-name">Nama usaha *</label><input className="field" id="business-name" name="businessName" defaultValue={tenant.businessName} required /></div><div><label className="field-label" htmlFor="business-phone">Nomor telepon *</label><input className="field" id="business-phone" name="phone" type="tel" defaultValue={tenant.phone} required /></div><div><label className="field-label" htmlFor="business-address">Alamat *</label><textarea className="field min-h-28" id="business-address" name="address" defaultValue={tenant.address} required /></div></div><button className="btn-primary mt-5 w-full sm:w-auto" disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}Simpan pengaturan</button></form></div>;
}
