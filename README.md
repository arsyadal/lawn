# Lawn

Lawn is a mobile-first Indonesian shoe-laundry operations PWA: order intake, treatment workflow, photos, payments, invoice, customer tracking, and daily reporting. Development uses PostgreSQL and private MinIO object storage; production storage is S3/R2-compatible.

Stack: npm workspaces monorepo (`apps/api` NestJS 11 + Prisma 6 + PostgreSQL, `apps/web` Next.js 15 App Router + Tailwind, `packages/contracts` shared enums).

## Requirements

Node.js 20+, npm 10+, and Docker Compose for the local PostgreSQL/MinIO services.

```sh
cp .env.example .env
npm install
docker compose up -d
# Fill SEED_* values plus strong SESSION_SECRET and CSRF_SECRET in .env first.
npm run db:migrate
npm run db:seed
npm run dev
```

Web: http://localhost:3000. API: http://localhost:4000 with health at `/health`. MinIO console: http://localhost:9001 (`laundry` / `laundry_local_secret`, bucket `laundry-private`).

`.env` lives at the repository root and is read by the API and the Prisma tooling; the web app does not read it (Next.js only loads env files from its own app root). `npm run db:migrate` loads it explicitly through `dotenv-cli` (`dotenv -e ../../.env -- prisma migrate deploy`); `npm run db:seed` runs `tsx prisma/seed.ts`, which loads the same root `.env` itself with the `dotenv` package, as does the API process via `apps/api/src/config/env.ts`. The seed refuses to run unless `SEED_TENANT_NAME`, `SEED_OWNER_EMAIL`, `SEED_OWNER_USERNAME`, and `SEED_OWNER_PASSWORD` are set, and it never creates a default account. Only an OWNER can create the remaining users from `/team`.

In local development the browser only talks to http://localhost:3000: `apps/web/next.config.mjs` registers a development-only rewrite from `/api/:path*` to `http://localhost:4000/api/:path*`, so no web env file is required and no manual editing is needed. Production is unchanged because Caddy routes `/api` to the API. If the API runs elsewhere, copy `apps/web/.env.example` to `apps/web/.env.local` and set `NEXT_PUBLIC_API_URL` to that origin — this is an optional override, and any existing `.env.local` is left as-is.

## Checks

```sh
npm run lint
npm run typecheck
npm test                # unit tests, no database required
npm run icons           # regenerates the PNG PWA icons in apps/web/public/icons
```

Integration tests exercise the API against a migrated PostgreSQL database and are opt-in. The storage suite additionally boots an in-process S3-compatible server (`s3rver`, via `apps/api/test/support/in-process-s3.ts`) with a generated local endpoint and dummy credentials, so no external MinIO/S3 bucket is needed; the API still loads and validates its regular root `.env`, so the required variables remain mandatory. Enable the database suites with:

```sh
RUN_DB_TESTS=1 npm run test:integration            # bash
set RUN_DB_TESTS=1&& npm run test:integration      # cmd.exe
$env:RUN_DB_TESTS=1; npm run test:integration      # PowerShell
```

The database suites need a migrated PostgreSQL database and create and delete their own tenants, so point `DATABASE_URL` at a development database. Run the storage suite with `RUN_DB_TESTS=1 RUN_STORAGE_TESTS=1 npm run test:integration`; it needs no pre-provisioned bucket.

## Production HTTPS

Set a real `PUBLIC_DOMAIN`, a production `DATABASE_URL`, distinct strong session/CSRF secrets, S3/R2 credentials, and the HTTPS `WEB_ORIGIN` in `.env`. `deploy/compose.yml` refuses to start without `PUBLIC_DOMAIN`; it builds both images (passing `NEXT_PUBLIC_API_URL=https://<domain>/api` into the web build) and Caddy obtains and renews HTTPS certificates:

```sh
docker compose -f deploy/compose.yml up -d --build
```

Caddy proxies `/api` and `/health` to the API and everything else to the web app. For Cloudflare R2, set `S3_ENDPOINT` to the account endpoint, `S3_REGION=auto`, and `S3_FORCE_PATH_STYLE=false`; for MinIO or other path-style endpoints keep `S3_FORCE_PATH_STYLE=true`. The bucket must stay private: photos are served only through short-lived signed URLs.

Supported mobile browsers offer installation from the browser menu once the app is served over HTTPS (`manifest.webmanifest`, `display: standalone`, generated icons, service worker). Offline caching covers the static app shell only — authenticated API responses, private photos, and public tracking responses are never cached, and offline order creation is out of scope.
# lawn
