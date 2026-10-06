import type { OrderStatus, PaymentEventType } from '@prisma/client';
import type { PaymentStatus } from '@lawn/contracts';

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  RECEIVED: 'WASHING',
  WASHING: 'DRYING',
  DRYING: 'QUALITY_CHECK',
  QUALITY_CHECK: 'READY',
  READY: 'COMPLETED',
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === 'COMPLETED' || from === 'CANCELLED') return false;
  return to === 'CANCELLED' || NEXT_STATUS[from] === to;
}

export interface PaymentSummary {
  captured: number;
  refunded: number;
  netCollected: number;
  balance: number;
  status: PaymentStatus;
}

export function summarizePayments(total: number, events: Array<{ type: PaymentEventType; amount: number }>): PaymentSummary {
  let captured = 0;
  let refunded = 0;
  for (const event of events) {
    if (event.type === 'PAYMENT') captured += event.amount;
    else refunded += event.amount;
  }
  const netCollected = captured - refunded;
  let status: PaymentStatus = 'PARTIAL';
  if (netCollected === total) status = 'PAID';
  else if (netCollected === 0) status = refunded > 0 ? 'REFUNDED' : 'UNPAID';
  return { captured, refunded, netCollected, balance: Math.max(total - netCollected, 0), status };
}
