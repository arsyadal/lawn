import { canTransitionOrder, summarizePayments } from './order.domain';

it('allows only forward workflow steps or cancellation', () => {
  expect(canTransitionOrder('RECEIVED', 'WASHING')).toBe(true);
  expect(canTransitionOrder('RECEIVED', 'DRYING')).toBe(false);
  expect(canTransitionOrder('READY', 'COMPLETED')).toBe(true);
  expect(canTransitionOrder('COMPLETED', 'CANCELLED')).toBe(false);
  expect(canTransitionOrder('CANCELLED', 'RECEIVED')).toBe(false);
});

it('derives payment status from immutable events', () => {
  expect(summarizePayments(100_000, [])).toMatchObject({ status: 'UNPAID', netCollected: 0, balance: 100_000 });
  expect(summarizePayments(100_000, [{ type: 'PAYMENT', amount: 40_000 }])).toMatchObject({ status: 'PARTIAL', netCollected: 40_000, balance: 60_000 });
  expect(summarizePayments(100_000, [{ type: 'PAYMENT', amount: 100_000 }])).toMatchObject({ status: 'PAID', netCollected: 100_000, balance: 0 });
  expect(summarizePayments(100_000, [{ type: 'PAYMENT', amount: 40_000 }, { type: 'REFUND', amount: 40_000 }])).toMatchObject({ status: 'REFUNDED', netCollected: 0, balance: 100_000 });
});

it('treats a fully discounted order as paid without payments', () => {
  expect(summarizePayments(0, [])).toMatchObject({ status: 'PAID', netCollected: 0, balance: 0 });
});

it('keeps installment boundaries distinct', () => {
  const installments = [
    { type: 'PAYMENT' as const, amount: 30_000 },
    { type: 'PAYMENT' as const, amount: 70_000 },
  ];
  expect(summarizePayments(100_000, installments)).toMatchObject({ status: 'PAID', captured: 100_000, refunded: 0 });
  expect(summarizePayments(100_000, [{ type: 'PAYMENT', amount: 99_999 }])).toMatchObject({ status: 'PARTIAL', balance: 1 });
  expect(summarizePayments(100_000, [{ type: 'PAYMENT', amount: 100_000 }, { type: 'REFUND', amount: 20_000 }])).toMatchObject({ status: 'PARTIAL', netCollected: 80_000, balance: 20_000 });
});
