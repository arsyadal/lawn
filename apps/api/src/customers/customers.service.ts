import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, input: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        tenantId,
        name: input.name.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim().toLowerCase(),
        address: input.address?.trim(),
        notes: input.notes?.trim(),
      },
    });
  }

  list(tenantId: string, search = '', page = 1, limit = 20) {
    const query = search.trim();
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where = { tenantId, ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' as const } }, { phone: { contains: query } }] } : {}) };
    return this.prisma.$transaction(async (tx) => {
      const [data, total] = await Promise.all([
        tx.customer.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
        tx.customer.count({ where }),
      ]);
      return { data, total, page: Math.max(page, 1), limit: take };
    });
  }

  async detail(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { tenantId, id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, orderNumber: true, status: true, total: true, estimatedCompletion: true, createdAt: true },
        },
      },
    });
    if (!customer) throw new NotFoundException('Pelanggan tidak ditemukan');
    const activeStatuses: OrderStatus[] = [OrderStatus.RECEIVED, OrderStatus.WASHING, OrderStatus.DRYING, OrderStatus.QUALITY_CHECK, OrderStatus.READY];
    return {
      ...customer,
      aggregates: {
        totalOrders: customer.orders.length,
        totalSpending: customer.orders.filter((order) => order.status !== OrderStatus.CANCELLED).reduce((sum, order) => sum + order.total, 0),
        activeOrders: customer.orders.filter((order) => activeStatuses.includes(order.status)).length,
      },
    };
  }

  async update(tenantId: string, id: string, input: UpdateCustomerDto) {
    await this.ensureExists(tenantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.address !== undefined ? { address: input.address.trim() } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.ensureExists(tenantId, id);
    const orders = await this.prisma.order.count({ where: { tenantId, customerId: id } });
    if (orders > 0) throw new ConflictException('Pelanggan dengan riwayat order tidak dapat dihapus');
    await this.prisma.customer.delete({ where: { id } });
  }

  private async ensureExists(tenantId: string, id: string): Promise<void> {
    if (!(await this.prisma.customer.findFirst({ where: { tenantId, id }, select: { id: true } }))) throw new NotFoundException('Pelanggan tidak ditemukan');
  }
}
