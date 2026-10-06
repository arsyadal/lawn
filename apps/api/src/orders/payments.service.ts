import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, PaymentEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthContext } from '../auth/auth.types';
import { RecordPaymentDto } from './payment.dto';
import { summarizePayments } from './order.domain';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(auth: AuthContext, orderId: string, input: RecordPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "tenantId" = ${auth.tenantId}::uuid AND "id" = ${orderId}::uuid FOR UPDATE`);
      const order = await tx.order.findFirst({ where: { tenantId: auth.tenantId, id: orderId }, include: { payments: { select: { type: true, amount: true } } } });
      if (!order) throw new NotFoundException('Order tidak ditemukan');
      const summary = summarizePayments(order.total, order.payments);
      if (input.type === PaymentEventType.PAYMENT && summary.netCollected + input.amount > order.total) throw new BadRequestException('Pembayaran melebihi sisa tagihan');
      if (input.type === PaymentEventType.REFUND && summary.refunded + input.amount > summary.captured) throw new BadRequestException('Total refund tidak boleh melebihi pembayaran yang diterima');
      const payment = await tx.payment.create({
        data: {
          tenantId: auth.tenantId,
          orderId,
          createdById: auth.userId,
          type: input.type,
          amount: input.amount,
          method: input.method,
          referenceNumber: input.referenceNumber?.trim(),
          note: input.note?.trim(),
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        },
      });
      await tx.orderActivity.create({
        data: {
          tenantId: auth.tenantId,
          orderId,
          actorId: auth.userId,
          type: input.type === PaymentEventType.PAYMENT ? ActivityType.PAYMENT_RECORDED : ActivityType.REFUND_RECORDED,
          details: { paymentId: payment.id, type: payment.type, amount: payment.amount, method: payment.method, referenceNumber: payment.referenceNumber },
        },
      });
      return { payment, paymentSummary: summarizePayments(order.total, [...order.payments, payment]) };
    });
  }

  async listForOrder(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { tenantId, id: orderId }, select: { id: true, total: true } });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    const payments = await this.prisma.payment.findMany({ where: { tenantId, orderId }, orderBy: { occurredAt: 'asc' }, include: { createdBy: { select: { id: true, displayName: true } } } });
    return { data: payments, paymentSummary: summarizePayments(order.total, payments) };
  }

  async list(tenantId: string, pageInput: number, limitInput: number) {
    const page = Math.max(pageInput, 1);
    const take = Math.min(Math.max(limitInput, 1), 100);
    const where = { tenantId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ where, orderBy: { occurredAt: 'desc' }, skip: (page - 1) * take, take, include: { order: { select: { id: true, orderNumber: true, customer: { select: { name: true } } } }, createdBy: { select: { displayName: true } } } }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, total, page, limit: take };
  }
}
