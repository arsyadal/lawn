import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../database/prisma.service';
import { summarizePayments } from '../orders/order.domain';

const JAKARTA_ZONE = 'Asia/Jakarta';
const ACTIVE_STATUSES: OrderStatus[] = [OrderStatus.RECEIVED, OrderStatus.WASHING, OrderStatus.DRYING, OrderStatus.QUALITY_CHECK, OrderStatus.READY];

type ReportPreset = 'TODAY' | 'YESTERDAY' | '7_DAYS' | '30_DAYS' | 'CUSTOM';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(tenantId: string, presetInput?: string, fromInput?: string, toInput?: string) {
    const { start, end, label } = this.period(presetInput, fromInput, toInput);
    const orderWhere = { tenantId, createdAt: { gte: start, lt: end } };
    const [orders, paymentGroups, popularServices] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: orderWhere, _count: { _all: true } }),
      this.prisma.payment.groupBy({ by: ['method', 'type'], where: { tenantId, occurredAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      this.prisma.orderItem.groupBy({
        by: ['serviceNameSnapshot'],
        where: { tenantId, order: { createdAt: { gte: start, lt: end } } },
        _count: { _all: true },
        orderBy: { _count: { serviceNameSnapshot: 'desc' } },
        take: 10,
      }),
    ]);
    const orderCount = orders.reduce((sum, row) => sum + row._count._all, 0);
    const completedCount = orders.find((row) => row.status === OrderStatus.COMPLETED)?._count._all ?? 0;
    const activeCount = orders.filter((row) => ACTIVE_STATUSES.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0);
    const byMethod: Record<PaymentMethod, number> = { CASH: 0, QRIS: 0, TRANSFER: 0, E_WALLET: 0, OTHER: 0 };
    for (const row of paymentGroups) byMethod[row.method] += (row._sum.amount ?? 0) * (row.type === 'PAYMENT' ? 1 : -1);
    return {
      period: { label, start: start.toISOString(), endExclusive: end.toISOString(), timeZone: JAKARTA_ZONE },
      orders: { total: orderCount, completed: completedCount, active: activeCount },
      payments: { netCollected: Object.values(byMethod).reduce((sum, amount) => sum + amount, 0), byMethod },
      popularServices: popularServices.map((row) => ({ serviceName: row.serviceNameSnapshot, itemCount: row._count._all })),
    };
  }

  async dashboard(tenantId: string) {
    const now = new Date();
    const todayStart = DateTime.now().setZone(JAKARTA_ZONE).startOf('day');
    const start = todayStart.toUTC().toJSDate();
    const end = todayStart.plus({ days: 1 }).toUTC().toJSDate();
    const overdueWhere: Prisma.OrderWhereInput = { tenantId, estimatedCompletion: { lt: now }, status: { not: OrderStatus.COMPLETED } };
    const [paymentGroups, ordersToday, activeOrders, readyOrders, overdueCount, overdueOrders] = await Promise.all([
      this.prisma.payment.groupBy({ by: ['type'], where: { tenantId, occurredAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: start, lt: end } } }),
      this.prisma.order.count({ where: { tenantId, status: { in: ACTIVE_STATUSES } } }),
      this.prisma.order.count({ where: { tenantId, status: OrderStatus.READY } }),
      this.prisma.order.count({ where: overdueWhere }),
      this.prisma.order.findMany({
        where: overdueWhere,
        orderBy: { estimatedCompletion: 'asc' },
        take: 20,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          subtotal: true,
          discount: true,
          total: true,
          notes: true,
          createdAt: true,
          estimatedCompletion: true,
          customer: { select: { id: true, name: true, phone: true } },
          items: { orderBy: { position: 'asc' }, select: { id: true, brand: true, model: true, serviceNameSnapshot: true, servicePriceSnapshot: true } },
          payments: { select: { type: true, amount: true } },
        },
      }),
    ]);
    const todayRevenue = paymentGroups.reduce((sum, row) => sum + (row._sum.amount ?? 0) * (row.type === 'PAYMENT' ? 1 : -1), 0);
    return {
      todayRevenue,
      ordersToday,
      activeOrders,
      readyOrders,
      overdueCount,
      overdueOrders: overdueOrders.map(({ payments, ...order }) => ({ ...order, paymentSummary: summarizePayments(order.total, payments) })),
      timeZone: JAKARTA_ZONE,
    };
  }

  private period(presetInput?: string, fromInput?: string, toInput?: string) {
    const preset = (presetInput ?? 'TODAY') as ReportPreset;
    const today = DateTime.now().setZone(JAKARTA_ZONE).startOf('day');
    let start = today;
    let end = today.plus({ days: 1 });
    let label: string = preset;
    if (preset === 'YESTERDAY') {
      start = today.minus({ days: 1 });
      end = today;
    } else if (preset === '7_DAYS') start = today.minus({ days: 6 });
    else if (preset === '30_DAYS') start = today.minus({ days: 29 });
    else if (preset === 'CUSTOM') {
      if (!fromInput || !toInput || !/^\d{4}-\d{2}-\d{2}$/.test(fromInput) || !/^\d{4}-\d{2}-\d{2}$/.test(toInput)) {
        throw new BadRequestException('Tanggal mulai dan akhir wajib dalam format YYYY-MM-DD');
      }
      start = DateTime.fromISO(fromInput, { zone: JAKARTA_ZONE }).startOf('day');
      const inclusiveEnd = DateTime.fromISO(toInput, { zone: JAKARTA_ZONE }).startOf('day');
      if (!start.isValid || !inclusiveEnd.isValid || inclusiveEnd < start) throw new BadRequestException('Rentang tanggal tidak valid');
      if (inclusiveEnd.diff(start, 'days').days > 366) throw new BadRequestException('Rentang laporan maksimal 366 hari');
      end = inclusiveEnd.plus({ days: 1 });
      label = `${fromInput}/${toInput}`;
    } else if (!['TODAY', 'YESTERDAY', '7_DAYS', '30_DAYS'].includes(preset)) throw new BadRequestException('Preset laporan tidak valid');
    return { start: start.toUTC().toJSDate(), end: end.toUTC().toJSDate(), label };
  }
}
