import type { Customer, DashboardData, HistoryEntry, Order, OrderItem, OrderSummary, PaymentEvent, ReportData, Service, TrackingData, User } from './types';

export interface ApiUser extends Omit<User, 'name'> { displayName: string }
export interface ApiService extends Omit<Service, 'estimatedDurationDays'> { estimatedMinutes?: number | null }
export interface ApiPayment extends Omit<PaymentEvent, 'createdAt' | 'orderId' | 'orderNumber' | 'customerName'> {
  occurredAt: string;
  order?: { id: string; orderNumber: string; customer: { name: string } };
}
interface ApiPaymentSummary { netCollected: number; balance: number; status: Order['paymentStatus'] }
interface ApiOrderItem extends Omit<OrderItem, 'serviceName' | 'price'> { serviceNameSnapshot: string; servicePriceSnapshot: number }
export interface ApiOrderSummary extends Omit<OrderSummary, 'items' | 'paymentStatus'> { items: ApiOrderItem[]; paymentSummary: ApiPaymentSummary }
export interface ApiOrder extends Omit<Order, 'items' | 'payments' | 'history' | 'paymentStatus' | 'netPaid' | 'balance'> {
  items: ApiOrderItem[];
  payments: ApiPayment[];
  paymentSummary: ApiPaymentSummary;
  statusHistory: Array<{ id: string; fromStatus?: Order['status'] | null; toStatus: Order['status']; note?: string | null; createdAt: string; actor?: { displayName: string } }>;
  activities: Array<{ id: string; type: HistoryEntry['type']; createdAt: string; actor?: { displayName: string }; details?: unknown }>;
}
export interface ApiCustomerDetail {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  aggregates: { totalOrders: number; totalSpending: number; activeOrders: number };
  orders: Array<Omit<OrderSummary, 'customer' | 'items' | 'paymentStatus'> & { paymentSummary?: ApiPaymentSummary }>;
}
export interface ApiDashboard { todayRevenue: number; ordersToday: number; activeOrders: number; readyOrders: number; overdueCount: number; overdueOrders: ApiOrderSummary[] }
export interface ApiReport { period: { start: string; endExclusive: string }; orders: { total: number; completed: number; active: number }; payments: { netCollected: number; byMethod: Record<string, number> }; popularServices: Array<{ serviceName: string; itemCount: number }> }
export interface ApiTracking { tenant: TrackingData['business']; status: TrackingData['status']; paymentStatus: TrackingData['paymentStatus']; estimatedCompletion: string; total: number; items: TrackingData['items']; statusHistory: Array<{ toStatus: TrackingData['status']; createdAt: string }> }

export function normalizeUser(user: ApiUser): User {
  return { ...user, name: user.displayName };
}

export function normalizeService(service: ApiService): Service {
  return { ...service, estimatedDurationDays: Math.max(1, Math.ceil((service.estimatedMinutes ?? 1440) / 1440)) };
}

function normalizeItem(item: ApiOrderItem): OrderItem {
  return { ...item, serviceName: item.serviceNameSnapshot, price: item.servicePriceSnapshot ?? 0 };
}

export function normalizeOrderSummary(order: ApiOrderSummary): OrderSummary {
  return { ...order, items: (order.items ?? []).map(normalizeItem), paymentStatus: order.paymentSummary?.status ?? 'UNPAID', overdue: new Date(order.estimatedCompletion).getTime() < Date.now() && order.status !== 'COMPLETED' };
}

export function normalizeOrder(order: ApiOrder): Order {
  const history: HistoryEntry[] = (order.statusHistory ?? []).map((entry) => ({ id: entry.id, type: entry.toStatus === 'CANCELLED' ? 'CANCELLATION' : 'STATUS', fromStatus: entry.fromStatus, toStatus: entry.toStatus, note: entry.note, actorName: entry.actor?.displayName, createdAt: entry.createdAt }));
  for (const activity of order.activities ?? []) history.push({ id: activity.id, type: activity.type, label: activity.type?.replaceAll('_', ' '), actorName: activity.actor?.displayName, createdAt: activity.createdAt });
  history.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  return { ...order, items: (order.items ?? []).map(normalizeItem), payments: (order.payments ?? []).map(normalizePayment), history, paymentStatus: order.paymentSummary.status, netPaid: order.paymentSummary.netCollected, balance: order.paymentSummary.balance };
}

export function normalizePayment(payment: ApiPayment): PaymentEvent {
  return { ...payment, createdAt: payment.occurredAt, orderId: payment.order?.id, orderNumber: payment.order?.orderNumber, customerName: payment.order?.customer.name };
}

export function normalizeCustomerDetail(customer: ApiCustomerDetail): Customer {
  const owner = { id: customer.id, name: customer.name, phone: customer.phone };
  return { ...customer, ...customer.aggregates, orders: customer.orders.map((order) => ({ ...order, customer: owner, items: [], paymentStatus: order.paymentSummary?.status ?? 'UNPAID' })) };
}

export function normalizeDashboard(dashboard: ApiDashboard, orders: ApiOrderSummary[]): DashboardData {
  const normalized = orders.map(normalizeOrderSummary);
  return {
    ...dashboard,
    workQueue: normalized.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status)),
    overdueOrders: dashboard.overdueOrders.map(normalizeOrderSummary),
  };
}

export function normalizeReport(report: ApiReport): ReportData {
  return {
    orderCount: report.orders.total,
    completedCount: report.orders.completed,
    activeCount: report.orders.active,
    netCollected: report.payments.netCollected,
    byPaymentMethod: Object.entries(report.payments.byMethod)
      .filter(([, amount]) => amount !== 0)
      .map(([method, amount]) => ({ method: method as ReportData['byPaymentMethod'][number]['method'], amount })),
    popularServices: report.popularServices,
    from: report.period.start,
    to: report.period.endExclusive,
  };
}

export function normalizeTracking(tracking: ApiTracking): TrackingData {
  return { business: tracking.tenant, status: tracking.status, paymentStatus: tracking.paymentStatus, estimatedCompletion: tracking.estimatedCompletion, total: tracking.total, items: tracking.items, timeline: tracking.statusHistory.map((entry) => ({ status: entry.toStatus, reachedAt: entry.createdAt })) };
}
