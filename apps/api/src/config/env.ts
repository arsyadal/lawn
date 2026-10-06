import { resolve } from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

config({ path: resolve(process.cwd(), '../../.env') });
config();

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    CSRF_SECRET: z.string().min(32),
    WEB_ORIGIN: z.string().url(),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().min(1),
    S3_BUCKET: z.string().min(3),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: booleanFromString.default('true'),
  })
  .refine((value) => value.SESSION_SECRET !== value.CSRF_SECRET, {
    message: 'SESSION_SECRET and CSRF_SECRET must be different',
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid API environment: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
}

export const env = parsed.data;
