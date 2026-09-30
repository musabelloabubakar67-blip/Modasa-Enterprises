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
The local seed (`supabase/seed.sql`) adds 3 shops, 2 warehouses and a demo catalogue.

After `npx supabase db reset`, run `npm run dev:users` to recreate a test owner and a Shop 1 cashier
from the `DEV_*` values in `.env.local` (local database only).

Useful commands:

| Command | What it does |
| --- | --- |
| `npx supabase db reset` | Rebuild the local database from migrations + seed (deletes local data) |
| `npm run dev:users` | Create local test accounts (owner, Shop 1 cashier, Warehouse A staff) after a reset |
| `npm run test:db` | Check the database's security and stock rules (run on a freshly reset database) |
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

## Products

- A **product** groups one or more **SKUs**. Each SKU is stocked and sold separately (e.g. one per rug size).
  Stock, transfers and sales always point at a SKU.
- Money is stored in minor units (kobo) as integers.
- **Barcodes**: a SKU's barcode is optional; when blank, the SKU code is what gets printed and scanned.
  The database guarantees every scan code identifies exactly one SKU.
- **Cost prices** are in a separate table that cashiers and warehouse staff cannot read at all.
- **Import** (`/app/products/import`): one row per SKU; rows matching an existing `sku_code` update it, and
  blank optional cells leave existing values unchanged. The whole file is saved in one transaction.
- Units with *coverage* (Roll → width × length; Box → m² per box) feed the wallpaper/tile calculator at the till.

## Stock

- **Stock is never edited directly.** Every change is a row in `stock_movements` (append-only), written only by
  database functions that also update `stock_levels` in the same transaction and refuse to go below zero.
- Stock is kept per SKU, location and **batch**. Products with *Track batches* on (wallpaper, tiles) must have a
  batch number when received; `''` means "no batch".
- **Deliveries** (`receipts`) are received at warehouses only, as drafts, then posted. Posting adds stock and makes
  each line's unit cost the SKU's cost price. Posted deliveries are locked; fix mistakes with an adjustment.
- **Adjustments**: opening stock, counts and damage write-offs. Floor staff submit, managers approve; managers'
  own entries apply immediately. A count stores what the system showed at the time, so approving it later
  applies only the difference and doesn't undo sales made in between.
- Labels print a CODE128 barcode of the SKU's barcode (or code) on A4 sticker sheets or 50×30 mm thermal labels.
- Staff names in history come from `staff_directory` (names only), so floor staff never see colleagues' contact
  details. Dates are shown in Africa/Lagos time (`src/lib/dates.ts`).

## Transfers

- Between any two locations. Floor staff can create transfers to or from their own location; managers any.
- **Requested** (no stock change) → **dispatched** (stock leaves the source as `transfer_out` and shows as
  *in transit*) → **received** (stock arrives as `transfer_in`). Only unsent requests can be cancelled.
- Dispatch records exactly which batches were sent; the screen suggests a single batch that covers the
  quantity so shops don't receive mixed shades, and warns when it has to split.
- If fewer items arrive than were sent, the receiver must give a reason; only what arrived is added and the
  transfer is flagged for a manager to resolve. No stock is lost from the books: it simply never arrived.
- Restock suggestions bring a shop up to twice its reorder level, counting stock in transit and open requests.

## Roles

| Role | Access |
| --- | --- |
| Owner | Everything, including settings, locations and staff |
| Manager | Day-to-day operations across all locations |
| Cashier | One shop: sales, receiving transfers, reporting counts and damage (manager approves) |
| Warehouse staff | One warehouse: receiving deliveries, labels, reporting counts and damage (manager approves) |

## Build plan

1. **Foundation** – setup, sign-in, roles, locations, business settings ✅
2. **Products** – categories, units, products & SKUs, sale/cost prices, photos, CSV/Excel import ✅
3. **Stock** – movement ledger, batches, deliveries, counts & write-offs with approval, history, labels ✅
4. **Transfers** – request → dispatch → receive between any locations, batches, in transit, shortages ✅
5. Point of sale – sales, discounts, deposits, stock lookup at other locations, receipts, wallpaper calculator
6. Demo data

Later: owner dashboard, delivery management, online storefront, payments.
