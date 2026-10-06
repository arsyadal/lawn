# Lawn API

NestJS 11 + Prisma 6 API for Lawn. Every route is under `/api/...` except the health probe at `GET /health`.

## Local setup

Requirements: Node.js 20+, npm 10+, Docker Compose.

```sh
cp .env.example .env      # repository root
npm install               # root workspace install; runs prisma generate via postinstall
docker compose up -d      # PostgreSQL 16 and MinIO (bucket bootstrapped by minio-init)
npm run db:migrate
npm run db:seed
npm run dev               # builds @lawn/contracts, then runs API and web together
```

- API: `http://localhost:4000` (`API_PORT`); web: `http://localhost:3000`; MinIO console: `http://localhost:9001` (`laundry` / `laundry_local_secret`, bucket `laundry-private`).
- `.env` lives at the repository root. `apps/api/src/config/env.ts` loads it (`../../.env` relative to the workspace cwd) with `dotenv` and validates it with Zod; an invalid or missing value aborts startup. Required: `DATABASE_URL`, `SESSION_SECRET` (≥32 chars), `CSRF_SECRET` (≥32 chars and different from `SESSION_SECRET`), `WEB_ORIGIN`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Optional: `NODE_ENV` (development), `API_PORT` (4000), `SESSION_TTL_HOURS` (168), `S3_FORCE_PATH_STYLE` (true).
- `npm run db:migrate` = `dotenv -e ../../.env -- prisma migrate deploy` (`apps/api/package.json`). `dotenv-cli` explicitly loads the root `.env`, then Prisma applies the committed migrations.
- `npm run db:seed` = `tsx prisma/seed.ts` run from `apps/api`. `prisma/seed.ts` loads the same root `.env` with `dotenv`, then requires `SEED_TENANT_NAME`, `SEED_OWNER_EMAIL`, `SEED_OWNER_USERNAME` and `SEED_OWNER_PASSWORD` (12–200 chars) — the script throws if any is missing or invalid. It provisions one tenant and its OWNER using Argon2id. It is idempotent: it exits without changes if that OWNER already exists, and refuses if the email or username belongs to another account. No default account is created; an OWNER creates remaining users from `/team`.

## Security model

- **Passwords** are hashed with Argon2id (`memoryCost` 65,536, `timeCost` 3, `parallelism` 1) in `auth.service.ts` and `team.service.ts`. Login compares against a dummy hash when the identifier is unknown, so a missing account is not distinguishable by timing.
- **Sessions** are server-side rows keyed by an HMAC-SHA256 `tokenHash` (`SESSION_SECRET`). The browser receives an HTTP-only `lawn_session` cookie, `SameSite=Lax`, `Secure` in production, `Path=/api`, expiring at `expiresAt`. `SessionGuard` resolves the cookie, rejects expired/inactive sessions, and populates `request.auth` with `userId`, `tenantId`, `role`, `displayName` and `sessionId` (`src/auth/session.guard.ts`).
- **CSRF**: each session stores a `csrfHash` (`CSRF_SECRET`). Non-safe methods (`POST`, `PATCH`, `DELETE`) must send the current token in `X-CSRF-Token`; it is compared with `timingSafeEqual`. Clients fetch or rotate it via `GET /api/auth/csrf`.
- **Login rate limiting** is applied by `configureApp` to `POST /api/auth/login`: 10 requests per 15 minutes per client, disabled under `NODE_ENV=test` (`src/app.setup.ts`). Helmet is applied globally and CORS is restricted to `WEB_ORIGIN` with credentials and the `content-type`/`x-csrf-token` headers.
- **Roles**: `RolesGuard` reads `@Roles(...)` metadata; routes without it accept any authenticated role. The session role is authoritative.
- **Tenant scoping** always comes from the session (`auth.tenantId`); request bodies and query strings never carry a tenant ID.
- **Private storage**: photo objects live in a private bucket. Uploads start with `POST /api/uploads` (server-generated object key under the tenant prefix, 10-minute presigned `PUT`), then `POST /api/uploads/confirm` verifies object metadata before creating `ItemPhoto`. Downloads use `GET /api/photos/:id/download`, which signs a 60-second private `GET` (`src/storage/storage.service.ts`).
- **Public tracking**: `GET /api/track/:token` accepts only a 43-character base64url token and hashes it with SHA-256. It returns an allowlisted projection (status, timeline, estimated completion, total, derived payment status, shoe brand/model, tenant business contact) and no customer, note, photo, staff or payment-reference data (`orders.service.ts#publicTracking`). Rotating a token issues a new random value and invalidates the old hash.

## Endpoints

Guards `SessionGuard` and `RolesGuard` are registered globally (`app.module.ts`). "Any" means any authenticated role (OWNER, ADMIN or STAFF); `@Public()` routes bypass the session guard entirely.

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Liveness probe: runs `SELECT 1` and an S3 `HeadBucket`; returns `503` if either fails. |
| POST | `/api/auth/login` | Public | Authenticates by email or username, sets `lawn_session`, returns `csrfToken`, `expiresAt`, `user`, `tenant`. Rate-limited. |
| POST | `/api/auth/logout` | Any | Deletes the session row and clears the cookie; responds `204`. |
| GET | `/api/auth/csrf` | Any | Rotates and returns a new `csrfToken` for the current session. |
| GET | `/api/auth/me` | Any | Current user and tenant profile. |
| GET | `/api/customers` | Any | Paginated customer list; `search`, `page`, `limit`. |
| GET | `/api/customers/:id` | Any | Customer detail with order aggregates and order list. |
| POST | `/api/customers` | OWNER, ADMIN | Creates a customer. |
| PATCH | `/api/customers/:id` | OWNER, ADMIN | Updates a customer. |
| DELETE | `/api/customers/:id` | OWNER, ADMIN | Deletes a customer; responds `204`. |
| GET | `/api/services` | Any | Lists services; `includeInactive=true` includes deactivated ones. |
| GET | `/api/services/:id` | Any | Service detail. |
| POST | `/api/services` | OWNER, ADMIN | Creates a service. |
| PATCH | `/api/services/:id` | OWNER, ADMIN | Updates a service. |
| DELETE | `/api/services/:id` | OWNER, ADMIN | Deactivates a service; it is never removed from history. |
| GET | `/api/orders` | Any | Paginated order list; `search`, `status`, `overdue`, `page`, `limit`. |
| GET | `/api/orders/:id` | Any | Order detail: customer, item snapshots and photos, status history, derived `paymentSummary`; STAFF receives a reduced projection without `payments` or `activities`. |
| POST | `/api/orders` | OWNER, ADMIN | Creates an order: snapshots active service prices, allocates `ORD-YYYY-######`, records initial status, optional initial payment, and returns a one-time plaintext `trackingToken`. |
| PATCH | `/api/orders/:id` | OWNER, ADMIN | Updates `estimatedCompletion`, `notes`, `discount`, and per-item prices; price changes are audited. |
| PATCH | `/api/orders/:orderId/items/:itemId` | Any | Sets an item's `treatmentNotes`; rejected on terminal orders. |
| POST | `/api/orders/:id/status` | Any | Advances the workflow with an optional note; STAFF cannot set `CANCELLED`. |
| POST | `/api/orders/:id/tracking-token/rotate` | OWNER, ADMIN | Issues a new tracking token and invalidates the previous one. |
| GET | `/api/orders/:id/payments` | OWNER, ADMIN | Lists the order's payment events. |
| POST | `/api/orders/:id/payments` | OWNER, ADMIN | Appends a payment or refund event; rejects net overpayment and refunds above captured payments. |
| GET | `/api/payments` | OWNER, ADMIN | Paginated tenant-wide payment list. |
| POST | `/api/uploads` | Any | Requests a presigned upload for an order item photo; STAFF may only use the `AFTER` category. |
| POST | `/api/uploads/confirm` | Any | Confirms a completed upload after verifying the stored object's metadata. |
| GET | `/api/photos/:id/download` | Any | Returns a 60-second signed private download URL. |
| GET | `/api/dashboard` | Any | Today's revenue, order counts, ready/overdue counts, and the overdue order list. |
| GET | `/api/reports` | OWNER, ADMIN | Aggregated report; `preset=TODAY\|YESTERDAY\|7_DAYS\|30_DAYS\|CUSTOM` with `from`/`to` for `CUSTOM`. |
| GET | `/api/team` | OWNER | Lists tenant users. |
| POST | `/api/team` | OWNER | Creates a user in the tenant. |
| PATCH | `/api/team/:id` | OWNER | Updates display name, role, or active state; deactivating a user deletes their sessions. |
| GET | `/api/settings` | Any | Tenant business profile. |
| PATCH | `/api/settings` | OWNER | Updates `businessName`, `phone`, `address`. |
| GET | `/api/track/:token` | Public | Returns the allowlisted public tracking projection for a token. |

36 routes in total. Mutating requests (`POST`, `PATCH`, `DELETE`) require the session `X-CSRF-Token` except `/api/auth/login`.

## Data model

`apps/api/prisma/schema.prisma` defines 13 models:

- `Tenant` — business profile (`businessName`, `phone`, `address`, `logoObjectKey`).
- `User` — tenant member with a unique email/username and Argon2id `passwordHash`, role, and active flag.
- `Session` — server-side session (`tokenHash`, `csrfHash`, `expiresAt`), reached through its user.
- `Customer` — tenant customer record.
- `Service` — priced treatment offering with an active flag.
- `TenantOrderSequence` — per-tenant, per-year order-number counter; primary key `(tenantId, year)`.
- `Order` — work order with status, subtotal/discount/total, `trackingTokenHash`, and the `ORD-YYYY-######` number.
- `OrderItem` — per-shoe line holding frozen `serviceNameSnapshot`/`servicePriceSnapshot`, condition notes, and `treatmentNotes`.
- `OrderStatusHistory` — append-only workflow transitions with actor and optional note.
- `ItemPhoto` — confirmed private photo metadata (category, object key, content type, size).
- `PendingUpload` — short-lived presigned upload intent with an expiry.
- `Payment` — append-only `PAYMENT`/`REFUND` event with method, amount, and `occurredAt`.
- `OrderActivity` — audit entries (`PRICE_CHANGED`, `PAYMENT_RECORDED`, `REFUND_RECORDED`, `ORDER_CANCELLED`) with a JSON `details` payload.

Every tenant-owned model declares `@@unique([tenantId, id])`, and relations between tenant-owned rows use composite foreign keys on `(tenantId, ...)` (for example `Order.customer` references `Customer(tenantId, id)`). A row therefore cannot reference another tenant's row at the database level, and every query filters on the `tenantId` taken from the session. `Tenant` is the tenant root; `Session` is not tenant-scoped but is only reached through its user.

## Testing

| Suite | Command | Notes |
| --- | --- | --- |
| Unit | `npm test` (workspace `@lawn/api`) | `jest.config.cjs` with `testRegex: .*\.spec\.ts$`, which collects only `src/**/*.spec.ts` (currently `src/orders/order.domain.spec.ts`) and no database is required. The integration files are named `*-spec.ts`, so they do not match and are reachable only through `test/jest-e2e.json`. |
| HTTP integration | `RUN_DB_TESTS=1 npm run test:e2e` | `test/jest-e2e.json` (matches `test/*.integration-spec.ts`) runs `api.integration-spec.ts` and `orders.integration-spec.ts` against a migrated PostgreSQL database. |
| Storage integration | `RUN_DB_TESTS=1 RUN_STORAGE_TESTS=1 npm run test:e2e` | `storage.integration-spec.ts` runs against PostgreSQL and an in-process S3-compatible server (`s3rver`, booted by `test/support/in-process-s3.ts`), exercising real presigned `PUT`, upload confirmation, signed `GET`, and cross-tenant rejection; no external bucket is needed. |

Each integration suite is gated by `describe.skip` unless its environment flag is `1` (the database suites use `RUN_DB_TESTS`; the storage suite uses `RUN_STORAGE_TESTS`), and each creates and deletes its own tenants, so point `DATABASE_URL` at a development database. The storage suite rebinds `env.S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` and the credentials to a generated local endpoint and dummy values before the app is created, so no S3 bucket needs pre-provisioning for it; the API still loads and validates its regular root `.env`, so the required variables must be present. `npm run test:integration` at the repository root runs the API e2e suites.
