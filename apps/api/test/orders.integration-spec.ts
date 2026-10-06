import { OrderStatus, PaymentMethod, UserRole } from '@prisma/client';
import '../src/config/env';
import { OrdersService } from '../src/orders/orders.service';
import { PaymentsService } from '../src/orders/payments.service';
import type { AuthContext } from '../src/auth/auth.types';
import { PrismaService } from '../src/database/prisma.service';

const describeWithDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeWithDatabase('order integration against PostgreSQL', () => {
  const prisma = new PrismaService();
  const orders = new OrdersService(prisma);
  const payments = new PaymentsService(prisma);
  let tenantA: string;
  let tenantB: string;
  let ownerA: AuthContext;
  let staffB: AuthContext;
  let customerA: string;
  let serviceA: string;

  beforeAll(async () => {
    const first = await prisma.tenant.create({
      data: {
        businessName: 'Lawn Integration A',
        users: { create: { email: `owner-a-${Date.now()}@test.invalid`, username: `ownera${Date.now()}`, displayName: 'Owner A', passwordHash: 'unused', role: UserRole.OWNER } },
        customers: { create: { name: 'Budi', phone: '081234567890' } },
        services: { create: { name: 'Deep Clean', price: 50_000 } },
      },
      include: { users: true, customers: true, services: true },
    });
    const second = await prisma.tenant.create({
      data: {
        businessName: 'Lawn Integration B',
        users: { create: { email: `staff-b-${Date.now()}@test.invalid`, username: `staffb${Date.now()}`, displayName: 'Staff B', passwordHash: 'unused', role: UserRole.STAFF } },
      },
      include: { users: true },
    });
    tenantA = first.id;
    tenantB = second.id;
    customerA = first.customers[0]!.id;
    serviceA = first.services[0]!.id;
    ownerA = { userId: first.users[0]!.id, tenantId: first.id, role: UserRole.OWNER, displayName: 'Owner A', sessionId: 'test' };
    staffB = { userId: second.users[0]!.id, tenantId: second.id, role: UserRole.STAFF, displayName: 'Staff B', sessionId: 'test' };
  });

  afterAll(async () => {
    for (const tenantId of [tenantA, tenantB].filter(Boolean)) {
      await prisma.orderActivity.deleteMany({ where: { tenantId } });
      await prisma.payment.deleteMany({ where: { tenantId } });
      await prisma.itemPhoto.deleteMany({ where: { tenantId } });
      await prisma.pendingUpload.deleteMany({ where: { tenantId } });
      await prisma.orderStatusHistory.deleteMany({ where: { tenantId } });
      await prisma.orderItem.deleteMany({ where: { tenantId } });
      await prisma.order.deleteMany({ where: { tenantId } });
      await prisma.tenantOrderSequence.deleteMany({ where: { tenantId } });
      await prisma.session.deleteMany({ where: { user: { tenantId } } });
      await prisma.service.deleteMany({ where: { tenantId } });
      await prisma.customer.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    await prisma.$disconnect();
  });

  it('allocates distinct numbers concurrently and preserves service snapshots', async () => {
    const created = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        orders.create(ownerA, {
          customerId: customerA,
          estimatedCompletion: new Date(Date.now() + 86_400_000).toISOString(),
          discount: index,
          items: [{ serviceId: serviceA, brand: 'Nike', model: `Model ${index}`, color: 'Putih' }],
        }),
      ),
    );
    expect(new Set(created.map((order) => order.orderNumber)).size).toBe(6);
    expect(created.every((order) => order.items[0]!.servicePriceSnapshot === 50_000)).toBe(true);
    expect(created.every((order) => !('trackingTokenHash' in order))).toBe(true);
  });

  it('enforces tenant isolation, transitions, payment limits, and tracking rotation', async () => {
    const created = await orders.create(ownerA, {
      customerId: customerA,
      estimatedCompletion: new Date(Date.now() + 86_400_000).toISOString(),
      items: [{ serviceId: serviceA, brand: 'Adidas', model: 'Samba', color: 'Hitam' }],
    });
    await expect(orders.detail(staffB, created.id)).rejects.toMatchObject({ status: 404 });
    await expect(orders.transition(ownerA, created.id, OrderStatus.DRYING)).rejects.toMatchObject({ status: 400 });
    await orders.transition(ownerA, created.id, OrderStatus.WASHING);
    const history = await prisma.orderStatusHistory.findMany({ where: { tenantId: tenantA, orderId: created.id } });
    expect(history.map((entry) => entry.toStatus)).toEqual([OrderStatus.RECEIVED, OrderStatus.WASHING]);

    const partial = await payments.record(ownerA, created.id, { type: 'PAYMENT', amount: 20_000, method: PaymentMethod.CASH });
    expect(partial.paymentSummary.status).toBe('PARTIAL');
    await expect(payments.record(ownerA, created.id, { type: 'PAYMENT', amount: 31_000, method: PaymentMethod.QRIS })).rejects.toMatchObject({ status: 400 });
    const refunded = await payments.record(ownerA, created.id, { type: 'REFUND', amount: 20_000, method: PaymentMethod.CASH });
    expect(refunded.paymentSummary.status).toBe('REFUNDED');
    await expect(payments.record(ownerA, created.id, { type: 'REFUND', amount: 1, method: PaymentMethod.CASH })).rejects.toMatchObject({ status: 400 });

    const tracked = await orders.publicTracking(created.trackingToken);
    expect(Object.keys(tracked).sort()).toEqual(['estimatedCompletion', 'items', 'paymentStatus', 'status', 'statusHistory', 'tenant', 'total'].sort());
    const rotated = await orders.rotateTrackingToken(ownerA, created.id);
    await expect(orders.publicTracking(created.trackingToken)).rejects.toMatchObject({ status: 404 });
    await expect(orders.publicTracking(rotated.trackingToken)).resolves.toMatchObject({ total: 50_000 });
  });
});
