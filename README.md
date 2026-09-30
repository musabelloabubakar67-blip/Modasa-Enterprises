# Retail Operations

Stock, transfers and point of sale for a retailer with several shops and warehouses. Built first for
Modasa Enterprises; everything business-specific (name, locations, staff, currency, receipt text) lives
in the database, not the code, so the same codebase can be set up for another retailer.

Stack: Next.js 16 (App Router) · Supabase (PostgreSQL, Auth, Storage) · Tailwind CSS 4 · TypeScript.

## Run locally

Requires Docker Desktop (running) and Node 22+ (Node 20 works for now, but `supabase-js` is dropping
support for it; use Node 22 LTS for deployment).

```bash
npm install
npx supabase start          # first run downloads images; prints the local keys
cp .env.example .env.local  # fill in the keys from `npx supabase status`
npm run dev
```

Open http://localhost:3000. On first run you're sent to `/setup` to create the owner account.
The local seed (`supabase/seed.sql`) adds 3 shops and 2 warehouses.

Useful commands:

| Command | What it does |
| --- | --- |
| `npx supabase db reset` | Rebuild the local database from migrations + seed (deletes local data) |
| `npm run db:types` | Regenerate TypeScript types after changing the schema |
| `npm run typecheck` / `npm run lint` / `npm run format` | Checks and formatting |
| Studio: http://127.0.0.1:54323 | Browse the local database |

## How it's organised

- `supabase/migrations/` – database schema and row-level security. Every table has RLS on; the
  database itself enforces who can see and change what.
- `src/proxy.ts` – refreshes the login session and keeps signed-out users out of `/app`.
- `src/lib/auth.ts` – `requireStaff([...roles])`, called at the top of every staff page and server action.
- `src/lib/supabase/admin.ts` – service-role client. Bypasses RLS; only used after an explicit permission
  check (creating staff logins, first-run setup, reading public business details).
- `src/app/app/` – the staff area. `src/app/` root is reserved for the future public storefront.

## Roles

| Role | Access |
| --- | --- |
| Owner | Everything, including settings, locations and staff |
| Manager | Day-to-day operations across all locations |
| Cashier | One shop: sales and receiving transfers |
| Warehouse staff | One warehouse: receiving, storing and dispatching stock |

## Build plan

1. **Foundation** – setup, sign-in, roles, locations, business settings ✅
2. Products – categories, units, variants, photos, CSV import
3. Stock – per-location stock from a movement ledger, receiving, damage write-offs, audit log
4. Transfers – request → dispatch → receive between any two locations
5. Point of sale – sales, discounts, deposits, stock lookup at other locations, receipts, wallpaper calculator
6. Demo data

Later: owner dashboard, delivery management, online storefront, payments.
