import type { OrderStatus, PaymentMethod, PaymentStatus, PhotoCategory, UserRole } from '@lawn/contracts';

export type { OrderStatus, PaymentMethod, PaymentStatus, PhotoCategory, UserRole };

export interface TenantProfile {
  id: string;
  businessName: string;
  phone: string;
  address: string;
  logoUrl?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  active?: boolean;
  createdAt?: string;
  tenant?: TenantProfile;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  totalOrders?: number;
  totalSpending?: number;
  activeOrders?: number;
  orders?: OrderSummary[];
}

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  estimatedDurationDays: number;
  active: boolean;
  createdAt?: string;
}

export interface ItemPhoto {
  id: string;
  category: PhotoCategory;
  viewUrl?: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  brand: string;
  model: string;
  color: string;
  size?: string | null;
  serviceId?: string | null;
  serviceName: string;
  price: number;
  conditionNotes?: string | null;
  specialRequest?: string | null;
  treatmentNotes?: string | null;
  photos?: ItemPhoto[];
}

export interface PaymentEvent {
  id: string;
  type: 'PAYMENT' | 'REFUND';
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string | null;
  note?: string | null;
  createdAt: string;
  orderId?: string;
  orderNumber?: string;
  customerName?: string;
}

export interface HistoryEntry {
  id: string;
  type?: 'STATUS' | 'PAYMENT' | 'REFUND' | 'PRICE' | 'CANCELLATION';
  fromStatus?: OrderStatus | null;
  toStatus?: OrderStatus | null;
  note?: string | null;
  actorName?: string;
  createdAt: string;
  label?: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  customer: Pick<Customer, 'id' | 'name' | 'phone'>;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  estimatedCompletion: string;
  total: number;
  createdAt: string;
  items: Array<Pick<OrderItem, 'id' | 'brand' | 'model' | 'serviceName'>>;
  overdue?: boolean;
}

export interface Order extends OrderSummary {
  subtotal: number;
  discount: number;
  notes?: string | null;
  balance: number;
  netPaid: number;
  items: OrderItem[];
  payments: PaymentEvent[];
  history: HistoryEntry[];
  trackingUrl?: string;
  trackingToken?: string;
  tenant?: TenantProfile;
}

export interface DashboardData {
  todayRevenue: number;
  ordersToday: number;
  activeOrders: number;
  readyOrders: number;
  overdueCount: number;
  workQueue: OrderSummary[];
  overdueOrders: OrderSummary[];
}

export interface ReportData {
  orderCount: number;
  completedCount: number;
  activeCount: number;
  netCollected: number;
  byPaymentMethod: Array<{ method: PaymentMethod; amount: number }>;
  popularServices: Array<{ serviceName: string; itemCount: number }>;
  from: string;
  to: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface TrackingData {
  business: Pick<TenantProfile, 'businessName' | 'phone' | 'address'>;
  orderNumber?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  estimatedCompletion: string;
  total: number;
  items: Array<Pick<OrderItem, 'brand' | 'model'>>;
  timeline: Array<{ status: OrderStatus; reachedAt?: string | null }>;
}
