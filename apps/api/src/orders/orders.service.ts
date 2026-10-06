import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, OrderStatus, PaymentEventType, Prisma, UserRole } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { DateTime } from 'luxon';
import { PrismaService } from '../database/prisma.service';
import type { AuthContext } from '../auth/auth.types';
import { CreateOrderDto, UpdateOrderDto } from './order.dto';
import { canTransitionOrder, summarizePayments } from './order.domain';
import { orderDetailInclude } from './order.select';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AuthContext, input: CreateOrderDto) {
    const trackingToken = randomBytes(32).toString('base64url');
    const trackingTokenHash = createHash('sha256').update(trackingToken).digest('hex');
    const order = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { tenantId: auth.tenantId, id: input.customerId }, select: { id: true } });
      if (!customer) throw new NotFoundException('Pelanggan tidak ditemukan');
      const serviceIds = [...new Set(input.items.map((item) => item.serviceId))];
      const services = await tx.service.findMany({ where: { tenantId: auth.tenantId, id: { in: serviceIds }, active: true } });
      if (services.length !== serviceIds.length) throw new BadRequestException('Satu atau lebih layanan tidak aktif atau tidak ditemukan');
      const serviceById = new Map(services.map((service) => [service.id, service]));
      const subtotal = input.items.reduce((sum, item) => sum + serviceById.get(item.serviceId)!.price, 0);
      if (subtotal > 2_147_483_647) throw new BadRequestException('Subtotal melebihi batas nilai rupiah');
      const discount = input.discount ?? 0;
      if (discount > subtotal) throw new BadRequestException('Diskon tidak boleh melebihi subtotal');
      const total = subtotal - discount;
      if (input.initialPayment && input.initialPayment.amount > total) throw new BadRequestException('Pembayaran melebihi total order');

      const year = DateTime.now().setZone('Asia/Jakarta').year;
      const sequenceRows = await tx.$queryRaw<Array<{ value: number }>>(Prisma.sql`
        INSERT INTO "TenantOrderSequence" ("tenantId", "year", "nextNumber")
        VALUES (${auth.tenantId}::uuid, ${year}, 2)
        ON CONFLICT ("tenantId", "year") DO UPDATE
        SET "nextNumber" = "TenantOrderSequence"."nextNumber" + 1
        RETURNING "nextNumber" - 1 AS value
      `);
      const sequence = sequenceRows[0]?.value;
      if (!sequence) throw new ConflictException('Nomor order gagal dialokasikan');
      const orderNumber = `ORD-${year}-${String(sequence).padStart(6, '0')}`;
      const created = await tx.order.create({
        data: {
          tenantId: auth.tenantId,
          customerId: customer.id,
          createdById: auth.userId,
          orderNumber,
          estimatedCompletion: new Date(input.estimatedCompletion),
          subtotal,
          discount,
          total,
          notes: input.notes?.trim(),
          trackingTokenHash,
          items: {
            create: input.items.map((item, position) => {
              const service = serviceById.get(item.serviceId)!;
              return {
                position,
                serviceId: service.id,
                brand: item.brand.trim(),
                model: item.model.trim(),
                color: item.color.trim(),
                size: item.size?.trim(),
                serviceNameSnapshot: service.name,
                servicePriceSnapshot: service.price,
                conditionNotes: item.conditionNotes?.trim(),
                specialRequest: item.specialRequest?.trim(),
              };
            }),
          },
        },
      });
      await tx.orderStatusHistory.create({
        data: { tenantId: auth.tenantId, orderId: created.id, actorId: auth.userId, fromStatus: null, toStatus: OrderStatus.RECEIVED },
      });
      if (input.initialPayment) {
        const payment = await tx.payment.create({
          data: {
            tenantId: auth.tenantId,
            orderId: created.id,
            createdById: auth.userId,
            type: PaymentEventType.PAYMENT,
            amount: input.initialPayment.amount,
            method: input.initialPayment.method,
            referenceNumber: input.initialPayment.referenceNumber?.trim(),
          },
        });
        await tx.orderActivity.create({
          data: { tenantId: auth.tenantId, orderId: created.id, actorId: auth.userId, type: ActivityType.PAYMENT_RECORDED, details: { paymentId: payment.id, amount: payment.amount, method: payment.method } },
        });
      }
      return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: orderDetailInclude });
    });
    const { trackingTokenHash: _trackingTokenHash, ...publicOrder } = order;
    return { ...publicOrder, paymentSummary: summarizePayments(order.total, order.payments), trackingToken };
  }

  async list(tenantId: string, options: { search?: string; status?: OrderStatus; overdue?: boolean; page: number; limit: number }) {
    const page = Math.max(options.page, 1);
    const take = Math.min(Math.max(options.limit, 1), 100);
    const query = options.search?.trim();
    const where: Prisma.OrderWhereInput = {
      tenantId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.overdue ? { estimatedCompletion: { lt: new Date() }, AND: { status: { not: OrderStatus.COMPLETED } } } : {}),
      ...(query
        ? {
            OR: [
              { orderNumber: { contains: query, mode: 'insensitive' } },
              { customer: { name: { contains: query, mode: 'insensitive' } } },
              { customer: { phone: { contains: query } } },
              { items: { some: { brand: { contains: query, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: { customer: { select: { id: true, name: true, phone: true } }, items: { orderBy: { position: 'asc' }, select: { id: true, brand: true, model: true, serviceNameSnapshot: true } }, payments: { select: { type: true, amount: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      data: orders.map(({ payments, trackingTokenHash: _trackingTokenHash, ...order }) => ({ ...order, paymentSummary: summarizePayments(order.total, payments) })),
      total,
      page,
      limit: take,
    };
  }

  async detail(auth: AuthContext, id: string) {
    const order = await this.prisma.order.findFirst({ where: { tenantId: auth.tenantId, id }, include: orderDetailInclude });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    const paymentSummary = summarizePayments(order.total, order.payments);
    const { trackingTokenHash: _trackingTokenHash, ...publicOrder } = order;
    if (auth.role !== UserRole.STAFF) return { ...publicOrder, paymentSummary };
    const { payments: _payments, activities: _activities, ...staffOrder } = publicOrder;
    return { ...staffOrder, paymentSummary };
  }

  async update(auth: AuthContext, id: string, input: UpdateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, auth.tenantId, id);
      const order = await tx.order.findFirst({ where: { tenantId: auth.tenantId, id }, include: { items: true, payments: true } });
      if (!order) throw new NotFoundException('Order tidak ditemukan');
      if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) throw new BadRequestException('Order terminal tidak dapat diubah');
      const priceChanges = input.itemPrices ?? [];
      if (new Set(priceChanges.map((change) => change.itemId)).size !== priceChanges.length) throw new BadRequestException('Item harga duplikat');
      const priceByItem = new Map(priceChanges.map((change) => [change.itemId, change.price]));
      if (priceChanges.some((change) => !order.items.some((item) => item.id === change.itemId))) throw new BadRequestException('Item order tidak ditemukan');
      const subtotal = order.items.reduce((sum, item) => sum + (priceByItem.get(item.id) ?? item.servicePriceSnapshot), 0);
      if (subtotal > 2_147_483_647) throw new BadRequestException('Subtotal melebihi batas nilai rupiah');
      const discount = input.discount ?? order.discount;
      if (discount > subtotal) throw new BadRequestException('Diskon tidak boleh melebihi subtotal');
      const total = subtotal - discount;
      const paymentSummary = summarizePayments(order.total, order.payments);
      if (paymentSummary.netCollected > total) throw new BadRequestException('Total baru lebih kecil dari pembayaran bersih yang sudah diterima');
      for (const change of priceChanges) {
        await tx.orderItem.update({ where: { id: change.itemId }, data: { servicePriceSnapshot: change.price } });
      }
      await tx.order.update({
        where: { id },
        data: {
          subtotal,
          discount,
          total,
          ...(input.estimatedCompletion !== undefined ? { estimatedCompletion: new Date(input.estimatedCompletion) } : {}),
          ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
        },
      });
      if (priceChanges.length > 0 || discount !== order.discount) {
        await tx.orderActivity.create({
          data: {
            tenantId: auth.tenantId,
            orderId: id,
            actorId: auth.userId,
            type: ActivityType.PRICE_CHANGED,
            details: {
              before: { subtotal: order.subtotal, discount: order.discount, total: order.total },
              after: { subtotal, discount, total },
              itemPrices: priceChanges.map((change) => ({ itemId: change.itemId, price: change.price })),
            },
          },
        });
      }
      const refreshed = await tx.order.findUniqueOrThrow({ where: { id }, include: orderDetailInclude });
      const { trackingTokenHash: _trackingTokenHash, ...publicOrder } = refreshed;
      return { ...publicOrder, paymentSummary: summarizePayments(refreshed.total, refreshed.payments) };
    });
  }

  async updateTreatmentNotes(auth: AuthContext, orderId: string, itemId: string, treatmentNotes: string | undefined) {
    const item = await this.prisma.orderItem.findFirst({ where: { tenantId: auth.tenantId, id: itemId, orderId }, include: { order: { select: { status: true } } } });
    if (!item) throw new NotFoundException('Item order tidak ditemukan');
    if (item.order.status === OrderStatus.COMPLETED || item.order.status === OrderStatus.CANCELLED) throw new BadRequestException('Order terminal tidak dapat diubah');
    return this.prisma.orderItem.update({ where: { id: item.id }, data: { treatmentNotes: treatmentNotes?.trim() ?? null } });
  }

  async transition(auth: AuthContext, id: string, toStatus: OrderStatus, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findFirst({ where: { tenantId: auth.tenantId, id }, select: { id: true, status: true } });
      if (!current) throw new NotFoundException('Order tidak ditemukan');
      if (toStatus === OrderStatus.CANCELLED && auth.role === UserRole.STAFF) throw new ForbiddenException('Staff tidak dapat membatalkan order');
      if (!canTransitionOrder(current.status, toStatus)) throw new BadRequestException(`Perubahan status ${current.status} ke ${toStatus} tidak diizinkan`);
      const result = await tx.order.updateMany({ where: { id, tenantId: auth.tenantId, status: current.status }, data: { status: toStatus } });
      if (result.count !== 1) throw new ConflictException('Status order telah berubah, muat ulang lalu coba lagi');
      const history = await tx.orderStatusHistory.create({
        data: { tenantId: auth.tenantId, orderId: id, actorId: auth.userId, fromStatus: current.status, toStatus, note: note?.trim() },
      });
      if (toStatus === OrderStatus.CANCELLED) {
        await tx.orderActivity.create({ data: { tenantId: auth.tenantId, orderId: id, actorId: auth.userId, type: ActivityType.ORDER_CANCELLED, details: { fromStatus: current.status, note: note?.trim() ?? null } } });
      }
      return history;
    });
  }

  async rotateTrackingToken(auth: AuthContext, id: string) {
    const order = await this.prisma.order.findFirst({ where: { tenantId: auth.tenantId, id }, select: { id: true } });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    const trackingToken = randomBytes(32).toString('base64url');
    const trackingTokenHash = createHash('sha256').update(trackingToken).digest('hex');
    await this.prisma.order.update({ where: { id: order.id }, data: { trackingTokenHash } });
    return { trackingToken };
  }

  async publicTracking(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new NotFoundException('Tautan pelacakan tidak valid');
    const trackingTokenHash = createHash('sha256').update(token).digest('hex');
    const order = await this.prisma.order.findUnique({
      where: { trackingTokenHash },
      select: {
        status: true,
        estimatedCompletion: true,
        total: true,
        tenant: { select: { businessName: true, phone: true, address: true } },
        items: { orderBy: { position: 'asc' }, select: { brand: true, model: true } },
        statusHistory: { orderBy: { createdAt: 'asc' }, select: { toStatus: true, createdAt: true } },
        payments: { select: { type: true, amount: true } },
      },
    });
    if (!order) throw new NotFoundException('Tautan pelacakan tidak valid');
    const { payments, ...publicOrder } = order;
    return { ...publicOrder, paymentStatus: summarizePayments(order.total, payments).status };
  }

  private async lockOrder(tx: Prisma.TransactionClient, tenantId: string, id: string): Promise<void> {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "tenantId" = ${tenantId}::uuid AND "id" = ${id}::uuid FOR UPDATE`);
  }
}
