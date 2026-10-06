# Lawn Web

Next.js 15 App Router client for Lawn. It is a mobile-first PWA that talks to the API only through `apps/web/lib/api.ts`.

## Routes

| Route | File | Access |
| --- | --- | --- |
| `/` | `app/page.tsx` | Redirects to `/dashboard`. |
| `/login` | `app/login/page.tsx` | Public. |
| `/track/[token]` | `app/track/[token]/page.tsx` | Public; renders the allowlisted tracking projection for the URL token. |
| `/offline` | `app/offline/page.tsx` | Public offline shell. |
| `/dashboard` | `app/(authenticated)/dashboard/page.tsx` | Authenticated. |
| `/orders` | `app/(authenticated)/orders/page.tsx` | Authenticated. |
| `/orders/new` | `app/(authenticated)/orders/new/page.tsx` | Authenticated; STAFF sees a notice instead of the form. |
| `/orders/[id]` | `app/(authenticated)/orders/[id]/page.tsx` | Authenticated. |
| `/customers` | `app/(authenticated)/customers/page.tsx` | Authenticated. |
| `/customers/[id]` | `app/(authenticated)/customers/[id]/page.tsx` | Authenticated. |
| `/services` | `app/(authenticated)/services/page.tsx` | Authenticated; STAFF sees a notice. |
| `/payments` | `app/(authenticated)/payments/page.tsx` | Authenticated; STAFF sees a notice. |
| `/reports` | `app/(authenticated)/reports/page.tsx` | Authenticated; STAFF sees a notice. |
| `/team` | `app/(authenticated)/team/page.tsx` | Authenticated; non-OWNER sees a notice. |
| `/settings` | `app/(authenticated)/settings/page.tsx` | Authenticated; non-OWNER sees a notice. |
| `/more` | `app/(authenticated)/more/page.tsx` | Authenticated; mobile menu, links filtered by role. |

`app/layout.tsx` mounts the fonts, global metadata and `PwaRegister`; `app/not-found.tsx` is the global 404. Every route inside `app/(authenticated)/` is wrapped by `app/(authenticated)/layout.tsx`, which renders `AuthProvider` and `AppShell`. `AuthProvider` calls `GET /auth/me` on mount and redirects to `/login?next=<pathname>` on a `401` or a `lawn:unauthorized` window event, so authentication is enforced client-side for the whole group; the API re-checks every request server-side.

## Role gating

Helpers live in `lib/permissions.ts` and map a `UserRole` to a capability. They are presentational only — the API's `RolesGuard` is the authority.

| Helper | Roles | Used by |
| --- | --- | --- |
| `canCreateOrder` | OWNER, ADMIN | `/dashboard` and `/orders` actions, `/orders/new` page guard, `AppShell` navigation. |
| `canManageServices` | OWNER, ADMIN | `/services` page guard, `/more` links, `AppShell` navigation. |
| `canManagePayments` | OWNER, ADMIN | `/payments` page guard, `/more` links, `AppShell`; payment and refund buttons on `/orders/[id]`. |
| `canViewReports` | OWNER, ADMIN | `/reports` page guard, `/more` links, `AppShell` navigation. |
| `canManageTeam` | OWNER | `/team` page guard, `/more` links, `AppShell` navigation. |
| `canManageSettings` | OWNER | `/settings` page guard, `/more` links, `AppShell` navigation. |
| `canRotateTracking` | OWNER, ADMIN | Tracking-link rotate panel on `/orders/[id]`. |
| `canViewAudit` | OWNER, ADMIN | Order activity panel on `/orders/[id]`. |

The customer pages import no helper, so any authenticated role can use them. `AppShell` filters its desktop sidebar, mobile bottom bar and `/more` list with the same helpers, so STAFF never sees management destinations.

## API access

`lib/api.ts` is the only transport.

- Base URL: `process.env.NEXT_PUBLIC_API_URL`, trailing slash stripped, defaulting to `/api`. `apps/web/.env.example` sets `http://localhost:4000/api`; production builds receive the deployed value. Use the default when the web app and API share an origin through the reverse proxy.
- `api<T>(path, options)` sends `credentials: 'include'` and `cache: 'no-store'`, so the HTTP-only `lawn_session` cookie is used automatically. JSON bodies are serialised unless a `FormData` instance is passed (the photo upload PUT goes straight to the presigned URL with `fetch`).
- CSRF: for any non-`GET`/`HEAD`/`OPTIONS` request the helper fetches `GET /auth/csrf` (module-cached, single-flight), caches the token, and sends it in `X-CSRF-Token`. A `403` whose message mentions CSRF clears the cache so the next mutation re-fetches. `POST /auth/login` passes `skipCsrf: true` because it establishes the session.
- A `401` dispatches `lawn:unauthorized`, which `AuthProvider` turns into a redirect to `/login`. `204` responses resolve to `undefined`; other successes are parsed as JSON, and a single-key `{ data }` envelope is unwrapped. Failures throw `ApiError` with `message`, `status` and `details`; `listResult` normalises `T[]`, `{ data }` or `{ items }` plus `total`. `clearApiSession()` resets the cached token on logout/login.

## Response normalisation

`lib/adapters.ts` converts API DTOs into the domain types in `lib/types.ts`. The API returns persistence-oriented shapes — snapshot columns (`serviceNameSnapshot`, `servicePriceSnapshot`), derived money summaries (`paymentSummary.{netCollected,balance,status}`), split history arrays (`statusHistory` plus `activities`), and nested wrappers (`order.customer`, `report.orders`, `tracking.tenant`) — while components consume one stable vocabulary. The adapters rename or flatten those fields (`displayName` → `name`, `serviceNameSnapshot` → `serviceName`, `servicePriceSnapshot` → `price`, `paymentSummary` → `paymentStatus`/`netPaid`/`balance`), derive values the API does not send directly (`estimatedDurationDays` from `estimatedMinutes`, `overdue`, dashboard `workQueue`, tracking `timeline`), and merge status history with activities into a single chronological `history`. Keeping this in one module means the UI is insulated from API shape changes and each page maps its response once at the boundary.

## Invoices and WhatsApp

- `lib/invoice.ts` builds an A4 PDF with `jspdf` from the normalised `Order` and optional `TenantProfile`: business header, invoice number and date, customer and estimated completion, one line per item, subtotal/discount/total, and payment status, saved as `invoice-<orderNumber>.pdf`. The order detail page also renders a print stylesheet version (`invoice-print`) and a "share" action.
- `lib/whatsapp.ts` produces a `https://wa.me/<number>?text=...` link. It strips non-digits from the customer phone and prefixes `62` (converting a leading `0`), then composes a fixed Indonesian "ready for pickup" message with the item names, order number and formatted total.

## PWA assets

- `public/manifest.webmanifest`: name/short name `Lawn`, `start_url: /dashboard`, `scope: /`, `display: standalone`, theme `#17462c`, PNG and SVG icons at 192/512 plus a maskable 512, and shortcuts to `/orders/new` and `/orders`. `app/layout.tsx` wires the manifest and theme colour through Next metadata.
- `public/sw.js` (cache `lawn-shell-v2`): pre-caches `/offline`, the manifest and the icons; on `install` calls `skipWaiting`, on `activate` deletes old caches and calls `clients.claim`. It only handles same-origin `GET` requests and returns early for `/api/` and `/track/`, so authenticated API responses, private photos and public tracking data are never cached. Navigations are network-first with `/offline` as fallback; `/_next/static/`, `/icons/` and the manifest are cache-first.
- `next.config.mjs` forces `Cache-Control: no-cache, no-store, must-revalidate` on `/sw.js` and `private, no-store` on `/track/:path*`.
- `components/PwaRegister.tsx` registers the service worker only when `process.env.NODE_ENV === 'production'`.
- `components/PwaInstallCard.tsx`, shown on authenticated `/more`, listens for Chromium `beforeinstallprompt` and waits for an explicit `Install Lawn` tap before calling `prompt()`. It handles `userChoice` and `appinstalled`, and recognizes standalone launch using `display-mode: standalone` plus iOS `navigator.standalone`.
- If no prompt event is available, the card gives iOS users Safari's Share → Add to Home Screen steps and gives other browsers menu guidance. It explains that a regular tab keeps browser chrome and installation needs HTTPS (localhost is for local testing).
- Development intentionally skips service-worker registration, so the install-help card does not mean the dev server has the production offline/PWA worker. Test the worker and offline behavior against a production deployment/build served over HTTPS.
- Icons are generated with `node scripts/generate-icons.mjs` (also `npm run icons` at the repository root), which writes `lawn-192.png`, `lawn-512.png` and `lawn-maskable-512.png` into `apps/web/public/icons`; the matching SVG variants are committed alongside them.

## Manual smoke checklist

Run against a local stack (see the root README for Postgres/MinIO, migrations and seed).

1. `http://localhost:3000/` redirects to `/dashboard`; while signed out the app lands on `/login`.
2. Sign in with the seeded OWNER. Confirm the `lawn_session` cookie is HTTP-only with `Path=/api` and `SameSite=Lax`, and that `/api/auth/me` returns the owner and tenant.
3. Create a customer and a service, then a new order. Confirm the generated `ORD-YYYY-######` number, item snapshots and totals.
4. On the order page, advance the status through to `READY` and save a treatment note.
5. Upload an `AFTER` photo; confirm it renders via the signed download URL.
6. Record a payment and a refund; confirm `paymentStatus`, net paid and balance update.
7. Download the invoice PDF, and open the WhatsApp link with the customer's phone.
8. Rotate the tracking token and open the copied `/track/<token>` URL in a private window (no session). Confirm only the allowlisted fields appear and that the previous link now fails.
9. Create a STAFF user from `/team`, sign in as STAFF, and confirm the sidebar and `/more` hide services, payments, reports, team and settings; `/services` and `/reports` show the permission notice; the order page shows no payment, refund, audit or tracking-rotate controls.
10. Check reports against the recorded payments for each preset and for a custom range.
11. Build and serve the production app, then verify the PWA: the manifest parses, the service worker registers, DevTools offline shows the `/offline` shell, and `/api/*` and `/track/*` responses are absent from the cache.
12. On authenticated `/more`, verify the install card. In Chromium, when `beforeinstallprompt` fires, `Install Lawn` appears; the browser prompt opens only after tapping it. `appinstalled` or standalone display mode changes the card to `Sudah terpasang`; accepting a prompt alone must not claim installation.
13. On an iPhone or iPad in Safari, verify the Share button → `Tambahkan ke Layar Utama` → confirmation instructions. In other browsers without the prompt event, verify the browser-menu guidance and the note that an ordinary tab retains browser chrome.
14. On the dev server, verify the note that `PwaRegister` does not register a service worker in development. For full SW-backed install/offline verification, use production over HTTPS (or localhost for local testing), not the dev server.
