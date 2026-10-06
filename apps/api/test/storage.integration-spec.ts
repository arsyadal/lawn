import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { env } from '../src/config/env';
import { PrismaService } from '../src/database/prisma.service';
import { startInProcessS3, type InProcessS3 } from './support/in-process-s3';

const describeWithStorage = process.env.RUN_STORAGE_TESTS === '1' ? describe : describe.skip;
const password = 'integration-password-value';
const sessionCookie = 'lawn_session';
const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1_024, 0x41)]);

describeWithStorage('photo storage against S3-compatible storage', () => {
  const prisma = new PrismaService();
  let storage: S3Client;
  let s3: InProcessS3;
  let app: INestApplication;
  let server: Server;
  let ownerA: { cookie: string; csrf: string };
  let ownerB: { cookie: string; csrf: string };
  let tenantAId: string;
  let tenantBId: string;
  let orderId: string;
  let itemId: string;
  const stamp = Date.now();

  async function login(identifier: string) {
    const response = await request(server).post('/api/auth/login').send({ identifier, password }).expect(200);
    const cookies = response.headers['set-cookie'];
    const raw = Array.isArray(cookies) ? cookies.find((value) => value.startsWith(`${sessionCookie}=`)) : undefined;
    if (!raw) throw new Error('Session cookie was not issued');
    return { cookie: raw.split(';')[0], csrf: response.body.csrfToken as string };
  }

  beforeAll(async () => {
    s3 = await startInProcessS3();
    env.S3_ENDPOINT = s3.endpoint;
    env.S3_REGION = 'us-east-1';
    env.S3_BUCKET = `lawn-storage-${stamp}`;
    env.S3_ACCESS_KEY_ID = 'S3RVER';
    env.S3_SECRET_ACCESS_KEY = 'S3RVER';
    env.S3_FORCE_PATH_STYLE = true;
    storage = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    });
    try {
      await storage.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    } catch {
      await storage.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    const tenantA = await prisma.tenant.create({
      data: { businessName: 'Lawn Storage A', users: { create: { email: `storage-a-${stamp}@test.invalid`, username: `storagea${stamp}`, displayName: 'Owner A', passwordHash, role: UserRole.OWNER } } },
    });
    const tenantB = await prisma.tenant.create({
      data: { businessName: 'Lawn Storage B', users: { create: { email: `storage-b-${stamp}@test.invalid`, username: `storageb${stamp}`, displayName: 'Owner B', passwordHash, role: UserRole.OWNER } } },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
    ownerA = await login(`storagea${stamp}`);
    ownerB = await login(`storageb${stamp}`);
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
    for (const tenantId of [tenantAId, tenantBId].filter(Boolean)) {
      await prisma.itemPhoto.deleteMany({ where: { tenantId } });
      await prisma.pendingUpload.deleteMany({ where: { tenantId } });
      await prisma.orderActivity.deleteMany({ where: { tenantId } });
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
    storage.destroy();
    if (s3) await s3.close();
  });

  it('uploads, confirms, and downloads a private photo through signed URLs', async () => {
    const customer = await request(server).post('/api/customers').set({ Cookie: ownerA.cookie, 'X-CSRF-Token': ownerA.csrf }).send({ name: 'Foto Pelanggan', phone: '081900000001' }).expect(201);
    const service = await request(server).post('/api/services').set({ Cookie: ownerA.cookie, 'X-CSRF-Token': ownerA.csrf }).send({ name: 'Cuci Foto', price: 40_000, estimatedMinutes: 1440 }).expect(201);
    const order = await request(server)
      .post('/api/orders')
      .set({ Cookie: ownerA.cookie, 'X-CSRF-Token': ownerA.csrf })
      .send({ customerId: customer.body.id, estimatedCompletion: new Date(Date.now() + 86_400_000).toISOString(), items: [{ serviceId: service.body.id, brand: 'Vans', model: 'Old Skool', color: 'Hitam' }] })
      .expect(201);
    orderId = order.body.id;
    itemId = order.body.items[0].id;

    const signed = await request(server)
      .post('/api/uploads')
      .set({ Cookie: ownerA.cookie, 'X-CSRF-Token': ownerA.csrf })
      .send({ orderId, orderItemId: itemId, contentType: 'image/jpeg', sizeBytes: jpegBytes.length, category: 'BEFORE' })
      .expect(201);

    const upload = await fetch(signed.body.uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: jpegBytes });
    expect(upload.status).toBe(200);

    const confirmed = await request(server).post('/api/uploads/confirm').set({ Cookie: ownerA.cookie, 'X-CSRF-Token': ownerA.csrf }).send({ uploadId: signed.body.uploadId }).expect(201);
    expect(confirmed.body).toMatchObject({ category: 'BEFORE', contentType: 'image/jpeg', sizeBytes: jpegBytes.length });

    const detail = await request(server).get(`/api/orders/${orderId}`).set('Cookie', ownerA.cookie).expect(200);
    expect(detail.body.items[0].photos.map((photo: { id: string }) => photo.id)).toEqual([confirmed.body.id]);
    await expect(prisma.pendingUpload.count({ where: { tenantId: tenantAId } })).resolves.toBe(0);

    const download = await request(server).get(`/api/photos/${confirmed.body.id}/download`).set('Cookie', ownerA.cookie).expect(200);
    const bytes = await fetch(download.body.downloadUrl);
    expect(bytes.status).toBe(200);
    expect(Buffer.from(await bytes.arrayBuffer()).equals(jpegBytes)).toBe(true);

    await request(server).get(`/api/photos/${confirmed.body.id}/download`).set('Cookie', ownerB.cookie).expect(404);
    await request(server).get(`/api/photos/${confirmed.body.id}/download`).set('Cookie', `lawn_session=invalid`).expect(401);
  }, 60_000);

  it('rejects a confirmed upload whose stored object does not match the declaration', async () => {
    const signed = await request(server)
      .post('/api/uploads')
      .set({ Cookie: ownerA.cookie, 'X-CSRF-Token': ownerA.csrf })
      .send({ orderId, orderItemId: itemId, contentType: 'image/jpeg', sizeBytes: jpegBytes.length, category: 'PROBLEM' })
      .expect(201);

    await expect(fetch(signed.body.uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: Buffer.alloc(16, 0x42) })).resolves.toMatchObject({ status: 200 });
    await request(server).post('/api/uploads/confirm').set({ Cookie: ownerA.cookie, 'X-CSRF-Token': ownerA.csrf }).send({ uploadId: signed.body.uploadId }).expect(400);

    await request(server).post('/api/uploads').set({ Cookie: ownerB.cookie, 'X-CSRF-Token': ownerB.csrf }).send({ orderId, orderItemId: itemId, contentType: 'image/jpeg', sizeBytes: 512, category: 'AFTER' }).expect(404);
    await request(server).post('/api/uploads').set({ Cookie: ownerA.cookie, 'X-CSRF-Token': ownerA.csrf }).send({ orderId: '00000000-0000-4000-8000-000000000000', orderItemId: itemId, contentType: 'image/jpeg', sizeBytes: 512, category: 'AFTER' }).expect(404);
  }, 60_000);
});
