import type { Order } from './types';
import { formatRupiah } from './format';

export function whatsappLink(order: Pick<Order, 'orderNumber' | 'total' | 'customer' | 'items'>): string {
  const digits = order.customer.phone.replace(/\D/g, '');
  const phone = digits.startsWith('62') ? digits : digits.startsWith('0') ? `62${digits.slice(1)}` : `62${digits}`;
  const itemNames = order.items.map((item) => `${item.brand} ${item.model}`.trim()).join(', ');
  const text = [
    `Halo ${order.customer.name},`,
    '',
    `Sepatu ${itemNames} Anda sudah selesai dan siap diambil.`,
    '',
    `Order: ${order.orderNumber}`,
    `Total: ${formatRupiah(order.total)}`,
    '',
    'Silakan ambil di outlet kami.',
    'Terima kasih.',
  ].join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
