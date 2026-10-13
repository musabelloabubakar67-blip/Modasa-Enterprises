# Hosting and the training copy

Staff learn on a **training copy**: its own database and web address, loaded with the business's real
products, where every practice sale, transfer and count can be thrown away. The live system is set up
separately at handover and starts clean, so its reports never include training activity.

|             | Training copy                        | Live system                                            |
| ----------- | ------------------------------------ | ------------------------------------------------------ |
| Database    | Supabase, free plan                  | Supabase Pro (daily backups, never pauses)             |
| Web hosting | Vercel                               | Vercel Pro, or another host that allows commercial use |
| Data        | Real products, one location's counts | Real products, every location counted on go-live day   |
| Afterwards  | Deleted                              | Kept                                                   |

Check current plans and terms on each provider's pricing page before quoting running costs. Vercel's free
(Hobby) plan is for non-commercial use.

## 1. Database (Supabase)

1. At supabase.com, create a project named e.g. `modasa-training`. Pick the region closest to the shops
   (there is no African region; a European one is usually nearest to Nigeria). Save the database password in
   a password manager.
2. Create the tables and security rules. Either way skips the demo seed.
   - **From the dashboard (no tools needed):** open the project's **SQL Editor → New query**, paste the whole
     of `setup.sql` and **Run**. Generate it with `node scripts/migrations-sql.mjs > setup.sql`. It runs in
     one transaction: if anything fails, nothing is applied. For later updates, generate only the new
     migrations with `--after <latest applied version>`.
   - **With the Supabase CLI**, on a computer with Node 22 and this repository:

     ```bash
     npm install
     npx supabase login
     npx supabase link --project-ref <project ref from the project's URL>
     npx supabase db push
     ```

3. In the project's **Settings → API Keys**, copy the **publishable** key and the **secret** key.

## 2. Website (Vercel)

1. At vercel.com, **Add New → Project**, import this GitHub repository. Framework: Next.js. Node: 22.
   **Settings → Functions → Function Region**: pick the region nearest the Supabase project's region (shown
   under Supabase **Project Settings → General**), e.g. London for `eu-west-2`. Vercel's default is the US East
   coast; every page makes several database calls, and each one crossing the Atlantic makes pages feel slow.
2. Environment variables (Settings → Environment Variables):

   | Name                                   | Value                                                                                              |
   | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | `https://<project ref>.supabase.co`                                                                |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key                                                                                |
   | `SUPABASE_SECRET_KEY`                  | the secret key. Never share it or put it in the code.                                              |
   | `NEXT_PUBLIC_SITE_URL`                 | the **shop** address, e.g. `https://modasa-training.vercel.app` (receipt, order and payment links) |
   | `STAFF_SITE_URL`                       | the **staff** address, e.g. `https://modasa-training-staff.vercel.app`                             |
   | `PAYSTACK_SECRET_KEY`                  | training: a Paystack **test** key (`sk_test_…`). Never a live key on the training copy.            |

3. Deploy.
4. **Settings → Domains**: add the staff address (e.g. `modasa-training-staff.vercel.app`) next to the shop
   address. Both point at this one deployment. Staff screens then open only on the staff address and the shop
   only on the shop address; a visitor on the wrong one is sent to the right one. If a variable is added after
   the first deploy, **Redeploy** for it to take effect.
5. With a Paystack key set, add the webhook in the Paystack dashboard (test mode):
   `https://<site address>/api/paystack/webhook`. Without a key, the online shop's checkout stays switched off.

The site's home page is the public **online shop**, so the training copy has a shop anyone could open. Keep
it from looking real: leave products off the website except a few for practice, and use only test payments.

## 3. Create the owner straight away

Until an owner exists, **whoever opens the site first is offered the owner sign-up** (`/setup`). Open the
new address yourself as soon as the deploy finishes and create the owner account. Don't share the address
before that.

## 4. Set up the business

Signed in as owner:

1. **Settings → Business**: name it so nobody mistakes it for the real thing, e.g. `Modasa (TRAINING)`.
   The name prints on every receipt.
2. **Settings → Locations**: add the real shops and warehouses. Use the same names as the count columns in
   the product workbook (rename the columns or the locations so they match).
3. **Products → Categories & units**: add any units the workbook uses that don't exist yet. For Modasa: **Sheet**
   and **Panel** with coverage _area_ (marble sheets, fluted panels), and **Bag**.
4. **Settings → Staff**: a login for each person being trained, with the role they'll have for real.

## 5. Load the products and the training location's stock

The business fills in the product workbook (Products tab: one row per size/design, prices, counts per
location). Turn it into the two import files:

```bash
node scripts/product-workbook-to-csv.mjs completed-workbook.xlsx out --location "Shop 1"
```

It lists any rows the import will reject (no item code, no price). Then, in the app:

1. **Products → Import**: upload `out/products.csv`. Check the preview, fix anything flagged, import.
2. **Stock → Adjustments → Import opening stock**: upload `out/opening-stock.csv`.
3. **Stock → Labels**: print labels for a handful of items so cashiers can practise scanning.

## 6. Train

Train each role on the jobs they'll do every day, on the real products:

| Role            | Practise                                                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cashier         | Sign in, find an item by search and by scanning, sell with cash / transfer / split payment, area and roll calculators (marble sheets, panels, wallpaper), receipt by print and WhatsApp, a return, end-of-day cash-up |
| Warehouse staff | Receive a delivery, print labels, dispatch a transfer, report a count difference or damage                                                                                                                            |
| Manager         | Approve counts and damage, request and receive transfers, sales and shift history, product edits and price changes, an online order end to end (test-card checkout, Online orders, collection or delivery, a cancel)  |
| Owner           | Dashboard and reports, staff logins, locations, business settings, Settings → Website and which products show online                                                                                                  |

Make mistakes on purpose (wrong item, wrong payment, a return, a short transfer) so staff see how each one
is put right. That's the point of the training copy.

## 7. At handover

1. Create the live Supabase project (Pro plan) and Vercel project the same way (steps 1–4), with the real
   business name and the **live** Paystack key and webhook.
2. Import the same `products.csv`.
3. Count every location on go-live day and import those counts as opening stock (run the script without
   `--location`, using the go-live counts).
4. Point the till PCs at the live **staff** address (till settings → Server address, see `till-setup.md`).
5. Delete the training projects, or keep the training copy for new staff, clearly named.
