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

## Point of sale

- Shops sell **only their own stock**. If an item is elsewhere, the till shows where and offers a transfer
  request; the sale happens once it arrives.
- A sale needs an **open till session** (`shifts`), opened with a cash float. Closing the till compares what
  was counted with what the system expected per payment method (float + sales − refunds).
- Prices always come from the catalogue (sale price if set). Payments must add up to the total exactly;
  one sale can be split across cash, POS card and transfer. No discounts or deposits yet.
- Handover is *takes now*, *collects later* or *delivery* (address, area, date, fee, status). Stock leaves the
  shop at the time of sale either way, so set-aside goods can't be sold twice.
- Receipts print at 80 mm from the browser and are shared on WhatsApp as a private link (`/r/<token>`).
- VAT is a switch in Business settings; prices include VAT and receipts show the VAT portion when on.
- Returns go back into stock or are written off as damaged; refunds come out of the open till session.
- Wallpaper (rolls by strips, pattern repeat) and tile (boxes + waste %) calculators: `src/lib/calculators.ts`.
- Till PC setup: [docs/till-setup.md](docs/till-setup.md).

## Desktop till app (`desktop/`)

A small Tauri (Rust) app that shows the system's own pages full-screen and adds:

- **Direct receipt printing**: receipts are built as ESC/POS printer commands in the web app
  (`src/lib/receipt-escpos.ts`) and sent to the chosen Windows printer raw, so there's no dialog, the paper is
  cut, and the cash drawer opens for cash sales. In a normal browser the till falls back to the print page.
- **Open drawer** button for no-sale openings, each logged with a reason (`drawer_openings`).
- **Kiosk lock** (full screen, can't be closed without the manager PIN), start with Windows, single instance.
- **Navigation lock**: only the configured server and the bundled settings page can load in the window, so no
  other site can reach the printer commands. Other links open in the system browser.
- Per-PC settings (server address, printer, paper width, drawer, PIN) in a bundled settings screen.

Build: `cd desktop && npm install && npm run build` (needs Rust + Visual Studio C++ build tools). Details in
[docs/till-setup.md](docs/till-setup.md).

## Dashboard & reports

- Owners and managers land on a dashboard: today's takings per shop vs the same day last week *by the same
  time*, till status, a "needs attention" list, the last 30 full days by shop, and this week's best sellers.
- `/app/reports`: Sales, Products (incl. slow movers), Profit, Staff, Stock losses. Every report filters by
  period and shop (kept in the URL) and exports to CSV.
- **Profit uses the cost price at the time of each sale** (`sale_line_costs`, filled by a trigger and hidden
  from floor staff). Takings for items with no recorded cost are reported separately, never guessed.
- Report queries are SQL functions (`report_*`) running with the caller's permissions, so row-level security
  still decides what each person sees. Dates are business days in Lagos time.
- The local seed includes 30 days of demo sales so the reports have something to show.

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
5. **Point of sale** – till, calculators, split payments, collection/delivery, receipts, returns, cash-up ✅

6. **Desktop till app** – installable Windows app (Tauri) with direct receipt printing, cash drawer, kiosk lock ✅

7. **Dashboard & reports** – owner home dashboard; sales, products, profit, staff and stock-loss reports ✅

Next: the online storefront (waiting for design examples). Later, if approved: discounts with limits,
deposits, delivery management, online payments, app auto-updates (needs hosting).
