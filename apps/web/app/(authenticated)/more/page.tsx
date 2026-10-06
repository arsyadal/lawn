'use client';

import Link from 'next/link';
import { BarChart3, ChevronRight, CircleDollarSign, LogOut, Settings, Shirt, UserRoundCog } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader } from '@/components/ui';
import { canManagePayments, canManageServices, canManageSettings, canManageTeam, canViewReports } from '@/lib/permissions';

export default function MorePage() {
  const { user, logout } = useAuth();
  const links = [
    { href: '/services', label: 'Layanan', description: 'Harga dan durasi treatment', icon: Shirt, allowed: canManageServices(user.role) },
    { href: '/payments', label: 'Pembayaran', description: 'Riwayat pembayaran dan refund', icon: CircleDollarSign, allowed: canManagePayments(user.role) },
    { href: '/reports', label: 'Laporan', description: 'Pendapatan dan statistik order', icon: BarChart3, allowed: canViewReports(user.role) },
    { href: '/team', label: 'Tim', description: 'Akun dan peran pengguna', icon: UserRoundCog, allowed: canManageTeam(user.role) },
    { href: '/settings', label: 'Pengaturan', description: 'Profil usaha dan kontak', icon: Settings, allowed: canManageSettings(user.role) },
  ].filter((item) => item.allowed);
  return <div className="page-enter max-w-2xl"><PageHeader eyebrow="Menu" title="Lainnya" description={`${user.name} · ${user.role}`} /><div className="panel-flat divide-y divide-line">{links.map(({ href, label, description, icon: Icon }) => <Link className="flex min-h-[72px] items-center gap-4 p-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-wash" href={href} key={href}><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-wash text-moss"><Icon className="size-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><strong className="block">{label}</strong><span className="text-sm text-muted">{description}</span></span><ChevronRight className="size-5 text-muted" aria-hidden="true" /></Link>)}</div><button className="btn-danger mt-6 w-full" onClick={() => void logout()}><LogOut className="size-5" aria-hidden="true" />Keluar dari Lawn</button></div>;
}
