import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';

interface Session {
  cookie: string;
  csrf: string;
}

const describeWithDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const password = 'integration-password-value';
const sessionCookie = 'lawn_session';
const year = new Date().getUTCFullYear();

function mutationHeaders(session: Session): Record<string, string> {
  return { Cookie: session.cookie, 'X-CSRF-Token': session.csrf };
}

describeWithDatabase('HTTP API against PostgreSQL', () => {
  const prisma = new PrismaService();
  let app: INestApplication;
  let server: Server;
  let ownerA: Session;
  let staffA: Session;
  let staffB: Session;
  let tenantAId: string;
  let tenantBId: string;
  let tenantACustomerId: string;
  let tenantAServiceId: string;
  let tenantAOrderId: string;
  let tenantAItemId: string;
  let trackingToken: string;

  const stamp = Date.now();

  async function login(identifier: string): Promise<Session> {
    const response = await request(server).post('/api/auth/login').send({ identifier, password }).expect(200);
    const cookies = response.headers['set-cookie'];
    const raw = Array.isArray(cookies) ? cookies.find((value) => value.startsWith(`${sessionCookie}=`)) : undefined;
    if (!raw) throw new Error('Session cookie was not issued');
    return { cookie: raw.split(';')[0], csrf: response.body.csrfToken };
  }

  beforeAll(async () => {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    const tenantA = await prisma.tenant.create({
      data: {
        businessName: 'Lawn HTTP A',
        phone: '081200000001',
        address: 'Jl. A',
        users: {
          create: [
            { email: `owner-a-${stamp}@test.invalid`, username: `httpa${stamp}`, displayName: 'Owner A', passwordHash, role: UserRole.OWNER },
            { email: `staff-a-${stamp}@test.invalid`, username: `staffa${stamp}`, displayName: 'Staff A', passwordHash, role: UserRole.STAFF },
          ],
        },
      },
    });
    const tenantB = await prisma.tenant.create({
      data: {
        businessName: 'Lawn HTTP B',
        users: { create: { email: `staff-b-${stamp}@test.invalid`, username: `staffb${stamp}`, displayName: 'Staff B', passwordHash, role: UserRole.STAFF } },
      },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();

    ownerA = await login(`httpa${stamp}`);
    staffA = await login(`staffa${stamp}`);
    staffB = await login(`staffb${stamp}`);
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
    for (const tenantId of [tenantAId, tenantBId].filter(Boolean)) {
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

  it('rejects unauthenticated and invalid session access', async () => {
    await request(server).get('/api/orders').expect(401);
    await request(server).get('/api/orders').set('Cookie', `${sessionCookie}=not-a-real-session`).expect(401);
    await request(server).get('/api/auth/me').set('Cookie', `${sessionCookie}=not-a-real-session`).expect(401);
  });

  it('requires a CSRF token for mutating requests', async () => {
    await request(server).post('/api/customers').set('Cookie', ownerA.cookie).send({ name: 'Tanpa CSRF', phone: '0811' }).expect(403);
    await request(server).post('/api/customers').set('Cookie', ownerA.cookie).set('X-CSRF-Token', 'wrong-token').send({ name: 'Salah CSRF', phone: '0811' }).expect(403);
  });

  it('keeps the health endpoint public and reports storage readiness', async () => {
    const response = await request(server).get('/health');
    expect([200, 503]).toContain(response.status);
    expect(response.body.service).toBe('Lawn API');
  });

  it('creates tenant-scoped customers, services, and orders with snapshots', async () => {
    const customer = await request(server).post('/api/customers').set(mutationHeaders(ownerA)).send({ name: 'Budi Santoso', phone: '081234567890' }).expect(201);
    tenantACustomerId = customer.body.id;

    const service = await request(server).post('/api/services').set(mutationHeaders(ownerA)).send({ name: 'Deep Clean', description: 'Cuci menyeluruh', price: 50_000, estimatedMinutes: 2880 }).expect(201);
    tenantAServiceId = service.body.id;

    const order = await request(server)
      .post('/api/orders')
      .set(mutationHeaders(ownerA))
      .send({
        customerId: tenantACustomerId,
        estimatedCompletion: new Date(Date.now() + 172_800_000).toISOString(),
        discount: 5_000,
        notes: 'Ambil sore',
        items: [
          { serviceId: tenantAServiceId, brand: 'Nike', model: 'Air Force 1', color: 'Putih', size: '42', conditionNotes: 'Sol kotor' },
          { serviceId: tenantAServiceId, brand: 'Adidas', model: 'Samba', color: 'Hitam', specialRequest: 'Jangan pakai pemutih' },
        ],
        initialPayment: { amount: 20_000, method: 'CASH', referenceNumber: 'INV-1' },
      })
      .expect(201);

    tenantAOrderId = order.body.id;
    tenantAItemId = order.body.items[0].id;
    trackingToken = order.body.trackingToken;
    expect(order.body.orderNumber).toMatch(new RegExp(`^ORD-${year}-\\d{6}$`));
    expect(order.body.subtotal).toBe(100_000);
    expect(order.body.total).toBe(95_000);
    expect(order.body.items.every((item: { servicePriceSnapshot: number }) => item.servicePriceSnapshot === 50_000)).toBe(true);
    expect(order.body.paymentSummary).toMatchObject({ status: 'PARTIAL', netCollected: 20_000, balance: 75_000 });
    expect(order.body).not.toHaveProperty('trackingTokenHash');
    expect(order.body.statusHistory.map((entry: { toStatus: string }) => entry.toStatus)).toEqual(['RECEIVED']);
    expect(order.body.activities[0]).toMatchObject({ type: 'PAYMENT_RECORDED' });
  });

  it('rejects invalid pricing and unknown services', async () => {
    await request(server)
      .post('/api/orders')
      .set(mutationHeaders(ownerA))
      .send({ customerId: tenantACustomerId, estimatedCompletion: new Date(Date.now() + 86_400_000).toISOString(), discount: 200_000, items: [{ serviceId: tenantAServiceId, brand: 'Nike', model: 'X', color: 'Putih' }] })
      .expect(400);
    await request(server)
      .post('/api/orders')
      .set(mutationHeaders(ownerA))
      .send({ customerId: tenantACustomerId, estimatedCompletion: new Date(Date.now() + 86_400_000).toISOString(), items: [{ serviceId: '00000000-0000-4000-8000-000000000000', brand: 'Nike', model: 'X', color: 'Putih' }] })
      .expect(400);
    await request(server)
      .post('/api/orders')
      .set(mutationHeaders(ownerA))
      .send({ customerId: tenantACustomerId, estimatedCompletion: 'besok', items: [{ serviceId: tenantAServiceId, brand: 'Nike', model: 'X', color: 'Putih' }] })
      .expect(400);
  });

  it('enforces roles and tenant isolation on writes', async () => {
    await request(server).get(`/api/orders/${tenantAOrderId}`).set('Cookie', staffB.cookie).expect(404);
    await request(server).post(`/api/orders/${tenantAOrderId}/status`).set(mutationHeaders(staffB)).send({ status: 'WASHING' }).expect(404);
    await request(server).post(`/api/orders/${tenantAOrderId}/payments`).set(mutationHeaders(staffB)).send({ type: 'PAYMENT', amount: 1_000, method: 'CASH' }).expect(403);

    await request(server).post('/api/orders').set(mutationHeaders(staffA)).send({ customerId: tenantACustomerId, estimatedCompletion: new Date(Date.now() + 86_400_000).toISOString(), items: [{ serviceId: tenantAServiceId, brand: 'Nike', model: 'X', color: 'Putih' }] }).expect(403);
    await request(server).post('/api/customers').set(mutationHeaders(staffA)).send({ name: 'Nope', phone: '0800' }).expect(403);
    await request(server).post('/api/services').set(mutationHeaders(staffA)).send({ name: 'Nope', price: 1_000 }).expect(403);
    await request(server).get('/api/reports?preset=TODAY').set('Cookie', staffA.cookie).expect(403);
    await request(server).get('/api/team').set('Cookie', staffA.cookie).expect(403);
    await request(server).get('/api/payments').set('Cookie', staffA.cookie).expect(403);
    await request(server).patch('/api/settings').set(mutationHeaders(staffA)).send({ businessName: 'Nope' }).expect(403);
    await request(server).post(`/api/orders/${tenantAOrderId}/payments`).set(mutationHeaders(staffA)).send({ type: 'PAYMENT', amount: 1_000, method: 'CASH' }).expect(403);
    await request(server).get(`/api/orders/${tenantAOrderId}/payments`).set('Cookie', staffA.cookie).expect(403);
    await request(server).get('/api/team').set('Cookie', ownerA.cookie).expect(200);
  });

  it('hides payment and audit detail from staff while allowing workflow updates', async () => {
    const staffView = await request(server).get(`/api/orders/${tenantAOrderId}`).set('Cookie', staffA.cookie).expect(200);
    expect(staffView.body).not.toHaveProperty('payments');
    expect(staffView.body).not.toHaveProperty('activities');
    expect(staffView.body.paymentSummary).toMatchObject({ status: 'PARTIAL' });

    await request(server).post(`/api/orders/${tenantAOrderId}/status`).set(mutationHeaders(staffA)).send({ status: 'WASHING', note: 'Mulai cuci' }).expect(201);
    await request(server).post(`/api/orders/${tenantAOrderId}/status`).set(mutationHeaders(staffA)).send({ status: 'CANCELLED' }).expect(403);
    await request(server).get('/api/orders').set('Cookie', staffA.cookie).expect(200);
  });

  it('rejects skipped and backward transitions but records accepted ones', async () => {
    await request(server).post(`/api/orders/${tenantAOrderId}/status`).set(mutationHeaders(staffA)).send({ status: 'READY' }).expect(400);
    await request(server).post(`/api/orders/${tenantAOrderId}/status`).set(mutationHeaders(staffA)).send({ status: 'RECEIVED' }).expect(400);
    await request(server).post(`/api/orders/${tenantAOrderId}/status`).set(mutationHeaders(staffA)).send({ status: 'DRYING' }).expect(201);
    await request(server).post(`/api/orders/${tenantAOrderId}/status`).set(mutationHeaders(staffA)).send({ status: 'QUALITY_CHECK' }).expect(201);
    await request(server).post(`/api/orders/${tenantAOrderId}/status`).set(mutationHeaders(staffA)).send({ status: 'READY' }).expect(201);

    const detail = await request(server).get(`/api/orders/${tenantAOrderId}`).set('Cookie', ownerA.cookie).expect(200);
    expect(detail.body.statusHistory.map((entry: { toStatus: string }) => entry.toStatus)).toEqual(['RECEIVED', 'WASHING', 'DRYING', 'QUALITY_CHECK', 'READY']);
    expect(detail.body.statusHistory[1]).toMatchObject({ fromStatus: 'RECEIVED', toStatus: 'WASHING', note: 'Mulai cuci', actor: { displayName: 'Staff A' } });
    expect(detail.body.activities.some((activity: { type: string }) => activity.type === 'PAYMENT_RECORDED')).toBe(true);
  });

  it('allows completion on an unpaid balance and derives payment states from events', async () => {
    const partial = await request(server).post(`/api/orders/${tenantAOrderId}/payments`).set(mutationHeaders(ownerA)).send({ type: 'PAYMENT', amount: 30_000, method: 'QRIS' }).expect(201);
    expect(partial.body.paymentSummary).toMatchObject({ status: 'PARTIAL', netCollected: 50_000, balance: 45_000 });

    await request(server).post(`/api/orders/${tenantAOrderId}/payments`).set(mutationHeaders(ownerA)).send({ type: 'PAYMENT', amount: 45_001, method: 'CASH' }).expect(400);
    await request(server).post(`/api/orders/${tenantAOrderId}/payments`).set(mutationHeaders(ownerA)).send({ type: 'REFUND', amount: 60_000, method: 'CASH' }).expect(400);

    await request(server).post(`/api/orders/${tenantAOrderId}/status`).set(mutationHeaders(staffA)).send({ status: 'COMPLETED' }).expect(201);
    const completed = await request(server).get(`/api/orders/${tenantAOrderId}`).set('Cookie', ownerA.cookie).expect(200);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.paymentSummary).toMatchObject({ status: 'PARTIAL', netCollected: 50_000, balance: 45_000 });

    await request(server).post(`/api/orders/${tenantAOrderId}/payments`).set(mutationHeaders(ownerA)).send({ type: 'PAYMENT', amount: 45_000, method: 'TRANSFER' }).expect(201);
    const settled = await request(server).get(`/api/orders/${tenantAOrderId}`).set('Cookie', ownerA.cookie).expect(200);
    expect(settled.body.paymentSummary).toMatchObject({ status: 'PAID', netCollected: 95_000, balance: 0 });

    const refunded = await request(server).post(`/api/orders/${tenantAOrderId}/payments`).set(mutationHeaders(ownerA)).send({ type: 'REFUND', amount: 95_000, method: 'CASH', note: 'Garansi' }).expect(201);
    expect(refunded.body.paymentSummary).toMatchObject({ status: 'REFUNDED', netCollected: 0, balance: 95_000 });
    await request(server).post(`/api/orders/${tenantAOrderId}/payments`).set(mutationHeaders(ownerA)).send({ type: 'REFUND', amount: 1, method: 'CASH' }).expect(400);
    await request(server).post(`/api/orders/${tenantAOrderId}/status`).set(mutationHeaders(ownerA)).send({ status: 'CANCELLED' }).expect(400);
  });

  it('records the refund on its own date in reports', async () => {
    const report = await request(server).get('/api/reports?preset=TODAY').set('Cookie', ownerA.cookie).expect(200);
    expect(report.body.period.timeZone).toBe('Asia/Jakarta');
    expect(report.body.orders.total).toBeGreaterThanOrEqual(1);
    expect(report.body.orders.completed).toBeGreaterThanOrEqual(1);
    expect(report.body.payments.netCollected).toBe(0);
    expect(report.body.payments.byMethod.QRIS).toBe(30_000);
    expect(report.body.payments.byMethod.TRANSFER).toBe(45_000);
    expect(report.body.payments.byMethod.CASH).toBe(-75_000);
    expect(report.body.popularServices[0]).toMatchObject({ serviceName: 'Deep Clean', itemCount: 2 });

    const previous = await request(server).get('/api/reports?preset=YESTERDAY').set('Cookie', ownerA.cookie).expect(200);
    expect(previous.body.payments.netCollected).toBe(0);
    await request(server).get('/api/reports?preset=NOPE').set('Cookie', ownerA.cookie).expect(400);
    await request(server).get('/api/reports?preset=CUSTOM&from=2026-01-01').set('Cookie', ownerA.cookie).expect(400);
    await request(server).get('/api/reports?preset=CUSTOM&from=2026-01-01&to=2026-01-31').set('Cookie', ownerA.cookie).expect(200);
  });

  it('authorizes photo uploads by tenant, role, and order state', async () => {
    const fresh = await request(server)
      .post('/api/orders')
      .set(mutationHeaders(ownerA))
      .send({ customerId: tenantACustomerId, estimatedCompletion: new Date(Date.now() + 86_400_000).toISOString(), items: [{ serviceId: tenantAServiceId, brand: 'New Balance', model: '530', color: 'Abu' }] })
      .expect(201);
    const freshOrderId = fresh.body.id;
    const freshItemId = fresh.body.items[0].id;

    const asOwner = await request(server).post('/api/uploads').set(mutationHeaders(ownerA)).send({ orderId: freshOrderId, orderItemId: freshItemId, contentType: 'image/jpeg', sizeBytes: 2_048, category: 'BEFORE' }).expect(201);
    expect(asOwner.body.uploadUrl).toContain('laundry-private');
    expect(asOwner.body.uploadId).toEqual(expect.any(String));
    expect(asOwner.body.headers['content-type']).toBe('image/jpeg');

    await request(server).post('/api/uploads').set(mutationHeaders(staffA)).send({ orderId: freshOrderId, orderItemId: freshItemId, contentType: 'image/jpeg', sizeBytes: 2_048, category: 'BEFORE' }).expect(403);
    await request(server).post('/api/uploads').set(mutationHeaders(staffA)).send({ orderId: freshOrderId, orderItemId: freshItemId, contentType: 'image/webp', sizeBytes: 2_048, category: 'AFTER' }).expect(201);
    await request(server).post('/api/uploads').set(mutationHeaders(staffB)).send({ orderId: freshOrderId, orderItemId: freshItemId, contentType: 'image/jpeg', sizeBytes: 2_048, category: 'AFTER' }).expect(404);
    await request(server).post('/api/uploads').set(mutationHeaders(ownerA)).send({ orderId: freshOrderId, orderItemId: freshItemId, contentType: 'image/gif', sizeBytes: 2_048, category: 'BEFORE' }).expect(400);
    await request(server).post('/api/uploads').set(mutationHeaders(ownerA)).send({ orderId: freshOrderId, orderItemId: freshItemId, contentType: 'image/jpeg', sizeBytes: 10 * 1024 * 1024 + 1, category: 'BEFORE' }).expect(400);
    await request(server).post('/api/uploads').set(mutationHeaders(ownerA)).send({ orderId: tenantAOrderId, orderItemId: tenantAItemId, contentType: 'image/jpeg', sizeBytes: 2_048, category: 'BEFORE' }).expect(400);
    await request(server).post('/api/uploads/confirm').set(mutationHeaders(ownerA)).send({ uploadId: asOwner.body.uploadId }).expect(400);
  });

  it('exposes only allowlisted fields on public tracking and rotates tokens', async () => {
    const publicView = await request(server).get(`/api/track/${trackingToken}`).expect(200);
    expect(Object.keys(publicView.body).sort()).toEqual(['estimatedCompletion', 'items', 'paymentStatus', 'status', 'statusHistory', 'tenant', 'total'].sort());
    expect(publicView.body.items[0]).toEqual({ brand: 'Nike', model: 'Air Force 1' });
    expect(publicView.body.tenant).toEqual({ businessName: 'Lawn HTTP A', phone: '081200000001', address: 'Jl. A' });
    expect(publicView.body.paymentStatus).toBe('REFUNDED');
    expect(publicView.body.statusHistory.length).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(publicView.body)).not.toContain('081234567890');
    expect(JSON.stringify(publicView.body)).not.toContain('Budi Santoso');
    expect(publicView.body.business).toBeUndefined();

    await request(server).get('/api/track/ORD-2026-000001').expect(404);
    await request(server).post(`/api/orders/${tenantAOrderId}/tracking-token/rotate`).set(mutationHeaders(staffA)).expect(403);

    const rotated = await request(server).post(`/api/orders/${tenantAOrderId}/tracking-token/rotate`).set(mutationHeaders(ownerA)).expect(201);
    expect(rotated.body.trackingToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await request(server).get(`/api/track/${trackingToken}`).expect(404);
    const fresh = await request(server).get(`/api/track/${rotated.body.trackingToken}`).expect(200);
    expect(fresh.body.total).toBe(95_000);
  });

  it('keeps tenant settings and search scoped to the caller', async () => {
    const updated = await request(server).patch('/api/settings').set(mutationHeaders(ownerA)).send({ businessName: 'Lawn HTTP A Renamed', phone: '081200000009', address: 'Jl. A Baru' }).expect(200);
    expect(updated.body.businessName).toBe('Lawn HTTP A Renamed');

    const search = await request(server).get('/api/orders?search=Budi').set('Cookie', ownerA.cookie).expect(200);
    expect(search.body.data.length).toBeGreaterThanOrEqual(1);
    const phoneSearch = await request(server).get('/api/orders?search=081234567890').set('Cookie', ownerA.cookie).expect(200);
    expect(phoneSearch.body.data.length).toBeGreaterThanOrEqual(1);
    const brandSearch = await request(server).get('/api/orders?search=Nike').set('Cookie', ownerA.cookie).expect(200);
    expect(brandSearch.body.data.length).toBeGreaterThanOrEqual(1);
    const missed = await request(server).get('/api/orders?search=TidakAda').set('Cookie', ownerA.cookie).expect(200);
    expect(missed.body.data).toEqual([]);
    await request(server).get('/api/orders?status=BOGUS').set('Cookie', ownerA.cookie).expect(400);

    const customerSearch = await request(server).get('/api/customers?search=081234567890').set('Cookie', ownerA.cookie).expect(200);
    expect(customerSearch.body.data.length).toBe(1);
    const otherTenantSearch = await request(server).get('/api/customers?search=081234567890').set('Cookie', staffB.cookie).expect(200);
    expect(otherTenantSearch.body.data).toEqual([]);

    const overdue = await request(server).get('/api/orders?overdue=true').set('Cookie', ownerA.cookie).expect(200);
    expect(overdue.body.data).toEqual([]);

    const dashboard = await request(server).get('/api/dashboard').set('Cookie', ownerA.cookie).expect(200);
    expect(dashboard.body.timeZone).toBe('Asia/Jakarta');
    expect(dashboard.body.ordersToday).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.overdueCount).toBe(0);
    expect(dashboard.body.overdueOrders).toEqual([]);
  });

  it('manages team members inside the tenant only', async () => {
    const created = await request(server).post('/api/team').set(mutationHeaders(ownerA)).send({ displayName: 'Admin Baru', email: `admin-${stamp}@test.invalid`, username: `admin${stamp}`, password: 'another-strong-password', role: 'ADMIN' }).expect(201);
    expect(created.body).toMatchObject({ displayName: 'Admin Baru', role: 'ADMIN', active: true });
    expect(created.body).not.toHaveProperty('passwordHash');
    await request(server).post('/api/team').set(mutationHeaders(ownerA)).send({ displayName: 'Duplikat', email: `admin-${stamp}@test.invalid`, username: `admin2${stamp}`, password: 'another-strong-password', role: 'ADMIN' }).expect(409);
    await request(server).post('/api/team').set(mutationHeaders(ownerA)).send({ name: 'Salah Field', email: `x-${stamp}@test.invalid`, username: `x${stamp}`, password: 'another-strong-password', role: 'ADMIN' }).expect(400);
    await request(server).post('/api/team').set(mutationHeaders(ownerA)).send({ displayName: 'Lemah', email: `weak-${stamp}@test.invalid`, username: `weak${stamp}`, password: 'short', role: 'ADMIN' }).expect(400);

    const list = await request(server).get('/api/team').set('Cookie', ownerA.cookie).expect(200);
    expect(list.body.map((user: { id: string }) => user.id)).toContain(created.body.id);
    await request(server).get('/api/team').set('Cookie', staffB.cookie).expect(403);
  });

  it('supports logout and rejects the reused session', async () => {
    const csrf = (await request(server).get('/api/auth/csrf').set('Cookie', staffB.cookie).expect(200)).body.csrfToken;
    await request(server).post('/api/auth/logout').set({ Cookie: staffB.cookie, 'X-CSRF-Token': csrf }).expect(204);
    await request(server).get('/api/auth/me').set('Cookie', staffB.cookie).expect(401);
  });
});
