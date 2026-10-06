const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
const dateOnly = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' });

function validDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export const formatRupiah = (value: number) => currency.format(value || 0);
export const formatDateTime = (value: string | Date) => { const date = validDate(value); return date ? dateTime.format(date) : '—'; };
export const formatDate = (value: string | Date) => { const date = validDate(value); return date ? dateOnly.format(date) : '—'; };
export const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value || 0);

export function toDateTimeLocal(value?: string | Date): string {
  const date = value ? new Date(value) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function apiDateTime(localValue: string): string {
  return new Date(localValue).toISOString();
}

export function jakartaDateInput(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}
