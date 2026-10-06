import Link from 'next/link';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>{eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}<h1 className="page-title">{title}</h1>{description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted sm:text-base">{description}</p> : null}</div>{action ? <div className="shrink-0">{action}</div> : null}</header>;
}

export function LoadingPage({ label = 'Memuat data' }: { label?: string }) {
  return <div className="space-y-4" role="status"><span className="sr-only">{label}</span><div className="skeleton h-9 w-52" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-32" />)}</div><div className="skeleton h-64" /></div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <section className="card flex flex-col items-center py-10 text-center" role="alert"><AlertCircle className="mb-3 size-8 text-red-700" aria-hidden="true" /><h2 className="font-semibold">Data tidak dapat dimuat</h2><p className="mt-1 max-w-md text-sm text-muted">{message}</p>{retry ? <button className="btn-secondary mt-5" onClick={retry}><RefreshCw className="size-4" aria-hidden="true" />Coba lagi</button> : null}</section>;
}

export function EmptyState({ title, description, actionHref, actionLabel }: { title: string; description: string; actionHref?: string; actionLabel?: string }) {
  return <section className="card flex flex-col items-center py-10 text-center"><span className="mb-4 grid size-12 place-items-center rounded-xl bg-wash text-moss"><Inbox aria-hidden="true" /></span><h2 className="font-semibold">{title}</h2><p className="mt-1 max-w-sm text-sm text-muted">{description}</p>{actionHref && actionLabel ? <Link className="btn-primary mt-5" href={actionHref}>{actionLabel}</Link> : null}</section>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'danger'; children: React.ReactNode }) {
  const classes = tone === 'danger' ? 'border-red-200 bg-red-50 text-red-800' : tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-blue-200 bg-blue-50 text-blue-900';
  return <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`} role={tone === 'danger' ? 'alert' : 'status'}>{children}</div>;
}
