'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, CircleDollarSign, ClipboardList, Home, LogOut, Menu, Plus, Search, Settings, Shirt, Users, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { canCreateOrder, canManagePayments, canManageServices, canManageSettings, canManageTeam, canViewReports } from '@/lib/permissions';

interface NavItem { href: string; label: string; icon: LucideIcon; allowed?: boolean }

function Brand() {
  return <Link href="/dashboard" className="inline-flex min-h-12 items-center gap-3 rounded-xl"><span className="grid size-10 place-items-center rounded-xl bg-moss-dark font-mono text-lg font-semibold text-[#f3d989]">L</span><span><strong className="block text-lg leading-5">Lawn</strong><span className="text-xs text-muted">Shoe care operations</span></span></Link>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const primary: NavItem[] = [
    { href: '/dashboard', label: 'Beranda', icon: Home },
    { href: '/orders', label: 'Order', icon: ClipboardList },
    { href: '/orders/new', label: 'Order Baru', icon: Plus, allowed: canCreateOrder(user.role) },
    { href: '/customers', label: 'Pelanggan', icon: Users },
  ];
  const secondary: NavItem[] = [
    { href: '/services', label: 'Layanan', icon: Shirt, allowed: canManageServices(user.role) },
    { href: '/payments', label: 'Pembayaran', icon: CircleDollarSign, allowed: canManagePayments(user.role) },
    { href: '/reports', label: 'Laporan', icon: BarChart3, allowed: canViewReports(user.role) },
    { href: '/team', label: 'Tim', icon: Wrench, allowed: canManageTeam(user.role) },
    { href: '/settings', label: 'Pengaturan', icon: Settings, allowed: canManageSettings(user.role) },
  ];
  const visiblePrimary = primary.filter((item) => item.allowed !== false);
  const visibleSecondary = secondary.filter((item) => item.allowed !== false);
  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = String(form.get('q') ?? '').trim();
    if (query) router.push(`/orders?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="min-h-dvh bg-paper">
      <a className="sr-only z-[100] rounded bg-white p-3 focus:not-sr-only focus:fixed focus:left-3 focus:top-3" href="#main-content">Lewati ke konten</a>
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-panel px-4 py-5 lg:flex lg:flex-col">
        <Brand />
        <form className="relative mt-6" onSubmit={submitSearch} role="search"><Search className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted" aria-hidden="true" /><label className="sr-only" htmlFor="sidebar-search">Cari order</label><input id="sidebar-search" name="q" className="field pl-10" placeholder="Cari order..." /></form>
        <nav className="mt-5 flex flex-1 flex-col gap-1" aria-label="Navigasi utama">
          {[...visiblePrimary, ...visibleSecondary].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${isActive(href) ? 'bg-wash text-moss-dark' : 'text-muted hover:bg-wash/70 hover:text-ink'}`}><Icon className="size-5" aria-hidden="true" />{label}</Link>)}
        </nav>
        <div className="border-t border-line pt-4"><p className="truncate text-sm font-semibold">{user.name}</p><p className="text-xs text-muted">{user.role}</p><button onClick={() => void logout()} className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-red-700 hover:bg-red-50"><LogOut className="size-5" aria-hidden="true" />Keluar</button></div>
      </aside>

      <header className="no-print sticky top-0 z-20 border-b border-line bg-paper/95 px-4 pb-3 pt-[calc(.75rem+var(--safe-top))] backdrop-blur lg:hidden"><div className="mx-auto flex max-w-3xl items-center justify-between"><Brand /><Link href="/more" className="icon-button" aria-label="Buka menu lainnya"><Menu aria-hidden="true" /></Link></div></header>
      <main id="main-content" tabIndex={-1} className="app-main mx-auto max-w-7xl px-4 pb-[calc(6.5rem+var(--safe-bottom))] pt-5 sm:px-6 lg:ml-64 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pb-[var(--safe-bottom)] backdrop-blur lg:hidden" aria-label="Navigasi bawah">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {[...visiblePrimary.filter((item) => item.href !== '/orders/new').slice(0, 2), { href: '/orders/new', label: 'Order', icon: Plus, allowed: canCreateOrder(user.role) }, { href: '/customers', label: 'Pelanggan', icon: Users }, { href: '/more', label: 'Lainnya', icon: Menu }].map(({ href, label, icon: Icon, allowed }) => allowed === false ? <span key={href} className="grid min-h-[68px] place-items-center text-xs text-muted/40"><Icon className="size-5" aria-hidden="true" /><span>{label}</span></span> : <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined} className={`flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors ${href === '/orders/new' ? '-mt-4 mx-1 mb-2 bg-moss text-white shadow-lg' : isActive(href) ? 'text-moss' : 'text-muted hover:bg-wash'}`}><Icon className="size-5" aria-hidden="true" /><span>{label}</span></Link>)}
        </div>
      </nav>
    </div>
  );
}
