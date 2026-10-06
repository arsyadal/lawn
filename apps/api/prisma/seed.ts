import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { z } from 'zod';

config({ path: resolve(process.cwd(), '../../.env') });
config();

const seedSchema = z.object({
  DATABASE_URL: z.string().url(),
  SEED_TENANT_NAME: z.string().trim().min(1).max(160),
  SEED_OWNER_EMAIL: z.string().trim().email().max(254),
  SEED_OWNER_USERNAME: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  SEED_OWNER_PASSWORD: z.string().min(12).max(200),
});
const parsed = seedSchema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid seed environment: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
const input = parsed.data;
const prisma = new PrismaClient();

async function seed(): Promise<void> {
  const email = input.SEED_OWNER_EMAIL.toLowerCase();
  const username = input.SEED_OWNER_USERNAME.toLowerCase();
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (existing) {
    if (existing.email === email && existing.username === username && existing.role === UserRole.OWNER) {
      console.log('Lawn owner already provisioned; no changes made.');
      return;
    }
    throw new Error('Seed email or username is already assigned to another account.');
  }
  const passwordHash = await argon2.hash(input.SEED_OWNER_PASSWORD, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
  await prisma.tenant.create({
    data: {
      businessName: input.SEED_TENANT_NAME,
      users: { create: { email, username, displayName: username, passwordHash, role: UserRole.OWNER } },
    },
  });
  console.log('Lawn tenant and owner provisioned.');
}

seed()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
