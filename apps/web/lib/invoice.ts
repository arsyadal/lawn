import { jsPDF } from 'jspdf';
import type { Order, TenantProfile } from './types';
import { formatDate, formatRupiah } from './format';

export function downloadInvoicePdf(order: Order, tenant?: TenantProfile) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 18;
  const right = 192;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(tenant?.businessName || order.tenant?.businessName || 'Lawn', left, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  y += 6;
  const business = tenant ?? order.tenant;
  if (business?.address) { doc.text(business.address, left, y, { maxWidth: 110 }); y += 5; }
  if (business?.phone) { doc.text(business.phone, left, y); y += 5; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('INVOICE', right, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.text(order.orderNumber, right, 27, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(order.createdAt), right, 33, { align: 'right' });

  y = Math.max(y + 7, 48);
  doc.setDrawColor(215, 221, 211);
  doc.line(left, y, right, y);
  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.text('Pelanggan', left, y);
  doc.setFont('helvetica', 'normal');
  doc.text(order.customer.name, left + 35, y);
  y += 6;
  doc.text('Estimasi selesai', left, y);
  doc.text(formatDate(order.estimatedCompletion), left + 35, y);

  y += 10;
  doc.setFillColor(232, 238, 232);
  doc.rect(left, y - 5, right - left, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Item / Layanan', left + 3, y + 1);
  doc.text('Harga', right - 3, y + 1, { align: 'right' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  for (const item of order.items) {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.text(`${item.brand} ${item.model}`.trim(), left + 3, y);
    doc.setTextColor(90, 100, 92);
    doc.text(item.serviceName, left + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    doc.text(formatRupiah(item.price), right - 3, y, { align: 'right' });
    y += 13;
  }

  doc.line(left, y, right, y);
  y += 8;
  const totals: Array<[string, number]> = [['Subtotal', order.subtotal], ['Diskon', -order.discount], ['Total', order.total]];
  for (const [label, amount] of totals) {
    doc.setFont('helvetica', label === 'Total' ? 'bold' : 'normal');
    doc.text(label, 130, y);
    doc.text(formatRupiah(amount), right - 3, y, { align: 'right' });
    y += 7;
  }
  doc.setFont('helvetica', 'normal');
  doc.text(`Status pembayaran: ${order.paymentStatus}`, left, y + 5);
  doc.setFontSize(8);
  doc.setTextColor(90, 100, 92);
  doc.text('Invoice ini dibuat oleh Lawn.', left, 282);
  doc.save(`invoice-${order.orderNumber}.pdf`);
}
