// Checks the database's security and stock rules by calling the API as different staff members.
// Local only, and it changes data: run on a fresh database:
//   npx supabase db reset && npm run dev:users && npm run test:db
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Refusing to run against ${url}; local Supabase only.`);
  process.exit(1);
}

async function login(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`Login failed for ${email}. Did you run npm run dev:users?`);
  return body.access_token;
}

const client = (token) => async (path, body, method) => {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data, msg: data?.message };
};

let failures = 0;
const check = (name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

const anon = client(null);
const owner = client(await login(env.DEV_OWNER_EMAIL, env.DEV_OWNER_PASSWORD));
const cashier = client(await login(env.DEV_CASHIER_EMAIL, env.DEV_CASHIER_PASSWORD));
const wh = client(await login(env.DEV_WAREHOUSE_EMAIL, env.DEV_WAREHOUSE_PASSWORD));

const loc = Object.fromEntries((await owner("locations?select=id,code")).data.map((l) => [l.code, l.id]));
const sku = Object.fromEntries((await owner("skus?select=id,code")).data.map((s) => [s.code, s.id]));
const level = async (code, where, batch = "") =>
  Number(
    (await owner(`stock_levels?select=quantity&sku_id=eq.${sku[code]}&location_id=eq.${loc[where]}&batch=eq.${batch}`))
      .data[0]?.quantity ?? 0,
  );

console.log("\n— Access —");
check("signed-out visitors read nothing", !(await anon("locations?select=id")).ok);
check("cashier reads only own profile", (await cashier("profiles?select=id")).data.length === 1);
check("cashier sees staff names via directory", (await cashier("staff_directory?select=full_name")).data.length >= 3);
check(
  "cashier can't change settings",
  (await cashier("business_settings?id=eq.1", { name: "X" }, "PATCH")).data?.length === 0,
);
const me = (await cashier("profiles?select=id")).data[0].id;
check(
  "cashier can't promote self",
  (await cashier(`profiles?id=eq.${me}`, { role: "owner" }, "PATCH")).data?.length === 0,
);

console.log("\n— Products —");
check("cashier can't read cost prices", (await cashier("sku_costs?select=cost_kobo")).data.length === 0);
check("owner reads cost prices", (await owner("sku_costs?select=cost_kobo")).data.length > 0);
check(
  "cashier can't edit prices",
  (await cashier(`skus?code=eq.CRUG-001`, { price_kobo: 1 }, "PATCH")).data?.length === 0,
);
let r = await cashier("rpc/save_product", { payload: { name: "X", skus: [] } });
check("cashier can't save products", !r.ok, r.msg);

console.log("\n— Deliveries —");
r = await cashier("rpc/save_receipt", { payload: { location_id: loc.SH1, lines: [] } });
check("cashier can't receive", !r.ok, r.msg);
r = await owner("rpc/save_receipt", { payload: { location_id: loc.SH1, lines: [] } });
check("no receiving at a shop", !r.ok, r.msg);
r = await wh("rpc/save_receipt", { payload: { location_id: loc["WH-B"], lines: [] } });
check("warehouse staff only at own warehouse", !r.ok, r.msg);
const before = await level("CRUG-001", "WH-A");
r = await wh("rpc/save_receipt", {
  payload: {
    location_id: loc["WH-A"],
    lines: [
      { sku_id: sku["CRUG-001"], quantity: 10, unit_cost_kobo: 1 },
      { sku_id: sku["ALLWP-001A"], quantity: 5 },
    ],
  },
});
check("warehouse staff saves a draft", r.ok, r.msg);
const receipt = r.data;
check("warehouse staff can't set costs", (await owner(`receipt_costs?receipt_id=eq.${receipt}`)).data.length === 0);
r = await wh("rpc/post_receipt", { p_receipt_id: receipt });
check("batch required for batch-tracked items", !r.ok, r.msg);
r = await owner("rpc/save_receipt", {
  payload: {
    id: receipt,
    location_id: loc["WH-A"],
    lines: [
      { sku_id: sku["CRUG-001"], quantity: 10, unit_cost_kobo: 2700000 },
      { sku_id: sku["ALLWP-001A"], batch: "2320", quantity: 5 },
    ],
  },
});
check("manager adds costs to the draft", r.ok, r.msg);
r = await wh("rpc/post_receipt", { p_receipt_id: receipt });
check("warehouse staff posts", r.ok, r.msg);
check("stock went up", (await level("CRUG-001", "WH-A")) === before + 10);
check("new batch recorded", (await level("ALLWP-001A", "WH-A", "2320")) === 5);
check(
  "delivery cost became the cost price",
  (await owner(`sku_costs?sku_id=eq.${sku["CRUG-001"]}`)).data[0]?.cost_kobo === 2700000,
);
r = await wh("rpc/save_receipt", { payload: { id: receipt, location_id: loc["WH-A"], lines: [] } });
check("posted deliveries are locked", !r.ok, r.msg);
r = await owner("rpc/save_receipt", {
  payload: { location_id: loc["WH-A"], lines: [{ sku_id: sku["CRUG-001"], quantity: 1.5 }] },
});
r = await owner("rpc/post_receipt", { p_receipt_id: r.data });
check("whole-unit items reject 1.5", !r.ok, r.msg);

console.log("\n— Adjustments —");
const shop = await level("CRUG-001", "SH1");
r = await cashier("rpc/submit_adjustment", {
  payload: { location_id: loc.SH1, kind: "damage", lines: [{ sku_id: sku["CRUG-001"], quantity: 1, reason: "Wet" }] },
});
check("cashier reports damage", r.ok, r.msg);
const adjustment = r.data;
check("stock unchanged while pending", (await level("CRUG-001", "SH1")) === shop);
r = await cashier("rpc/approve_adjustment", { p_adjustment_id: adjustment });
check("cashier can't approve", !r.ok, r.msg);
r = await owner("rpc/approve_adjustment", { p_adjustment_id: adjustment });
check("owner approves", r.ok, r.msg);
check("stock went down by 1", (await level("CRUG-001", "SH1")) === shop - 1);
r = await cashier("rpc/submit_adjustment", {
  payload: { location_id: loc.SH2, kind: "damage", lines: [{ sku_id: sku["CRUG-001"], quantity: 1 }] },
});
check("cashier can't adjust another shop", !r.ok, r.msg);
r = await cashier("rpc/submit_adjustment", {
  payload: { location_id: loc.SH1, kind: "opening", lines: [{ sku_id: sku["CRUG-001"], quantity: 1 }] },
});
check("only managers enter opening stock", !r.ok, r.msg);
r = await owner("rpc/submit_adjustment", {
  payload: { location_id: loc.SH1, kind: "damage", lines: [{ sku_id: sku["CRUG-004"], quantity: 3 }] },
});
check("stock can't go negative", !r.ok, r.msg);
const mats = await level("HM-1", "SH1");
r = await cashier("rpc/submit_adjustment", {
  payload: { location_id: loc.SH1, kind: "count", lines: [{ sku_id: sku["HM-1"], quantity: mats - 2 }] },
});
const count = r.data;
await owner("rpc/submit_adjustment", {
  payload: { location_id: loc.SH1, kind: "damage", lines: [{ sku_id: sku["HM-1"], quantity: 1, reason: "Torn" }] },
});
await owner("rpc/approve_adjustment", { p_adjustment_id: count });
check("a count applies only its difference", (await level("HM-1", "SH1")) === mats - 3);

console.log("\n— Ledger —");
r = await owner("stock_movements", { sku_id: sku["HM-1"], location_id: loc.SH1, quantity: 100, type: "receipt" });
check("no direct writes to the ledger, even by the owner", !r.ok, r.msg);
r = await owner(`stock_levels?sku_id=eq.${sku["HM-1"]}`, { quantity: 999 }, "PATCH");
check("no direct edits to stock levels", !r.ok, r.msg);
r = await owner("rpc/apply_stock_movement", {
  p_sku_id: sku["HM-1"],
  p_location_id: loc.SH1,
  p_batch: "",
  p_quantity: 5,
  p_type: "receipt",
  p_reference_type: null,
  p_reference_id: null,
  p_note: null,
});
check("internal stock function can't be called", !r.ok, r.msg);
check("cashier can't see deliveries", (await cashier("receipts?select=id")).data.length === 0);

console.log("\n— Transfers —");
r = await cashier("rpc/create_transfer", {
  payload: { from_location_id: loc.SH2, to_location_id: loc.SH3, lines: [{ sku_id: sku["HM-1"], quantity: 1 }] },
});
check("cashier can't create transfers between other locations", !r.ok, r.msg);
r = await cashier("rpc/create_transfer", {
  payload: {
    from_location_id: loc["WH-A"],
    to_location_id: loc.SH1,
    lines: [
      { sku_id: sku["CRUG-001"], quantity: 4 },
      { sku_id: sku["ALLWP-001B"], quantity: 3 },
    ],
  },
});
check("cashier requests stock for own shop", r.ok, r.msg);
const transfer = r.data;
r = await cashier("rpc/dispatch_transfer", {
  p_transfer_id: transfer,
  p_items: [{ sku_id: sku["CRUG-001"], quantity: 4 }],
});
check("cashier can't dispatch from the warehouse", !r.ok, r.msg);
r = await wh("rpc/dispatch_transfer", { p_transfer_id: transfer, p_items: [{ sku_id: sku["HM-4"], quantity: 1 }] });
check("only requested items can be sent", !r.ok, r.msg);
r = await wh("rpc/dispatch_transfer", {
  p_transfer_id: transfer,
  p_items: [{ sku_id: sku["ALLWP-001B"], batch: "2306", quantity: 999 }],
});
check("can't send more than the warehouse has", !r.ok, r.msg);
const whRugs = await level("CRUG-001", "WH-A");
const whPaper = await level("ALLWP-001B", "WH-A", "2306");
r = await wh("rpc/dispatch_transfer", {
  p_transfer_id: transfer,
  p_items: [
    { sku_id: sku["CRUG-001"], quantity: 4 },
    { sku_id: sku["ALLWP-001B"], batch: "2306", quantity: 3 },
  ],
});
check("warehouse staff dispatch", r.ok, r.msg);
check("stock left the warehouse", (await level("CRUG-001", "WH-A")) === whRugs - 4);
check("batch left the warehouse", (await level("ALLWP-001B", "WH-A", "2306")) === whPaper - 3);
const transit = (await cashier(`stock_in_transit?sku_id=eq.${sku["CRUG-001"]}&location_id=eq.${loc.SH1}`)).data;
check("shows as in transit", Number(transit[0]?.quantity) === 4);
r = await cashier("rpc/cancel_transfer", { p_transfer_id: transfer, p_reason: "x" });
check("dispatched transfers can't be cancelled", !r.ok, r.msg);
const items = (await cashier(`transfer_items?select=id,sku_id&transfer_id=eq.${transfer}`)).data;
const rugItem = items.find((i) => i.sku_id === sku["CRUG-001"]).id;
const paperItem = items.find((i) => i.sku_id === sku["ALLWP-001B"]).id;
r = await wh("rpc/receive_transfer", {
  p_transfer_id: transfer,
  p_items: [
    { item_id: rugItem, received_quantity: 4 },
    { item_id: paperItem, received_quantity: 3 },
  ],
});
check("warehouse can't receive at the shop", !r.ok, r.msg);
r = await cashier("rpc/receive_transfer", {
  p_transfer_id: transfer,
  p_items: [
    { item_id: rugItem, received_quantity: 3 },
    { item_id: paperItem, received_quantity: 3 },
  ],
});
check("a shortage needs a reason", !r.ok, r.msg);
r = await cashier("rpc/receive_transfer", {
  p_transfer_id: transfer,
  p_items: [
    { item_id: rugItem, received_quantity: 5 },
    { item_id: paperItem, received_quantity: 3 },
  ],
});
check("can't receive more than was sent", !r.ok, r.msg);
const shopRugs = await level("CRUG-001", "SH1");
r = await cashier("rpc/receive_transfer", {
  p_transfer_id: transfer,
  p_items: [
    { item_id: rugItem, received_quantity: 3, reason: "One rug torn in the van" },
    { item_id: paperItem, received_quantity: 3 },
  ],
});
check("cashier receives with a shortage", r.ok, r.msg);
check("only what arrived was added", (await level("CRUG-001", "SH1")) === shopRugs + 3);
check("batch arrived at the shop", (await level("ALLWP-001B", "SH1", "2306")) >= 3);
check(
  "shortage flagged",
  (await owner(`transfers?select=has_shortage&id=eq.${transfer}`)).data[0]?.has_shortage === true,
);
check(
  "no longer in transit",
  (await owner(`stock_in_transit?sku_id=eq.${sku["CRUG-001"]}&location_id=eq.${loc.SH1}`)).data.length === 0,
);
r = await cashier("rpc/resolve_transfer_shortage", { p_transfer_id: transfer, p_resolution: "Lost" });
check("cashier can't resolve shortages", !r.ok, r.msg);
r = await owner("rpc/resolve_transfer_shortage", { p_transfer_id: transfer, p_resolution: "Lost in transit" });
check("owner resolves the shortage", r.ok, r.msg);
r = await cashier("rpc/create_transfer", {
  payload: { from_location_id: loc.SH1, to_location_id: loc["WH-A"], lines: [{ sku_id: sku["HM-1"], quantity: 1 }] },
});
check("shop can send back to a warehouse", r.ok, r.msg);
r = await cashier("rpc/cancel_transfer", { p_transfer_id: r.data, p_reason: "Changed my mind" });
check("unsent request can be cancelled", r.ok, r.msg);

console.log("\n— Till —");
const sale = (payload) => cashier("rpc/create_sale", { payload: { location_id: loc.SH1, ...payload } });
const cash = (kobo, tendered) => [{ method: "cash", amount_kobo: kobo, tendered_kobo: tendered ?? kobo }];
const basket = [{ sku_id: sku["LX21-KC12S"], quantity: 2 }]; // 2 × ₦21,000

r = await sale({ lines: basket, payments: cash(4200000) });
check("no sales before the till is opened", !r.ok, r.msg);
r = await wh("rpc/open_shift", { p_location_id: loc["WH-A"], p_float_kobo: 0 });
check("warehouse staff can't open a till", !r.ok, r.msg);
r = await cashier("rpc/open_shift", { p_location_id: loc.SH2, p_float_kobo: 0 });
check("cashier can't open another shop's till", !r.ok, r.msg);
r = await cashier("rpc/open_shift", { p_location_id: loc.SH1, p_float_kobo: 1000000 });
check("cashier opens the till with a ₦10,000 float", r.ok, r.msg);
const shift = r.data;
r = await cashier("rpc/open_shift", { p_location_id: loc.SH1, p_float_kobo: 0 });
check("only one open till per shop", !r.ok, r.msg);

r = await sale({ lines: basket, payments: cash(100) });
check("payments must equal the total", !r.ok, r.msg);
const baskets = await level("LX21-KC12S", "SH1");
r = await sale({ lines: [{ ...basket[0], unit_price_kobo: 1 }], payments: cash(4200000, 5000000) });
check("cash sale; prices come from the catalogue", r.ok, r.msg);
const firstSale = r.data;
check("stock left the shop", (await level("LX21-KC12S", "SH1")) === baskets - 2);
r = await sale({
  lines: [{ sku_id: sku["GJ0070"], quantity: 1 }],
  payments: [
    { method: "card", amount_kobo: 2000000 },
    { method: "transfer", amount_kobo: 1825000, reference: "From A. Yusuf" },
  ],
});
check("split payment (card + transfer)", r.ok, r.msg);
const salesBefore = (await owner("sales?select=id")).data.length;
r = await sale({ lines: [{ sku_id: sku["GJ0070"], quantity: 50 }], payments: cash(191250000) });
check("can't sell more than the shop has", !r.ok, r.msg);
check("a failed sale leaves nothing behind", (await owner("sales?select=id")).data.length === salesBefore);
r = await sale({ lines: [{ sku_id: sku["CRUG-004"], quantity: 1 }], payments: cash(15000000) });
check("can't sell warehouse-only stock at a shop", !r.ok, r.msg);
r = await sale({
  lines: [{ sku_id: sku["LX21-KC12S"], quantity: 1 }],
  payments: cash(2600000),
  fulfilment: "delivery",
  customer: { name: "Amina" },
  delivery: { address: "12 Admiralty Way", fee_kobo: 500000 },
});
check("delivery needs the customer's phone", !r.ok, r.msg);
r = await sale({
  lines: [{ sku_id: sku["LX21-KC12S"], quantity: 1 }],
  payments: cash(2600000),
  fulfilment: "delivery",
  customer: { name: "Amina Yusuf", phone: "0803 111 2222" },
  delivery: { address: "12 Admiralty Way, Lekki", area: "Lekki", fee_kobo: 500000 },
});
check("delivery sale with fee", r.ok, r.msg);
const delivery = (await owner(`sales?select=total_kobo,fulfilment_status,customers(phone)&id=eq.${r.data}`)).data[0];
check("total includes the delivery fee", delivery.total_kobo === 2600000);
check("phone stored as digits", delivery.customers.phone === "08031112222");
r = await cashier("rpc/update_fulfilment", { p_sale_id: r.data, p_status: "completed" });
check("cashier marks delivered", r.ok, r.msg);

await owner("business_settings?id=eq.1", { vat_enabled: true }, "PATCH");
r = await sale({ lines: [{ sku_id: sku["LX21-KC12S"], quantity: 1 }], payments: cash(2100000) });
const vat = (await owner(`sales?select=vat_kobo&id=eq.${r.data}`)).data[0]?.vat_kobo;
check("VAT portion recorded when switched on", vat === Math.round((2100000 * 7.5) / 107.5), `₦${vat / 100}`);
await owner("business_settings?id=eq.1", { vat_enabled: false }, "PATCH");

const lines = (await cashier(`sale_lines?select=id&sale_id=eq.${firstSale}`)).data;
const stockBeforeReturn = await level("LX21-KC12S", "SH1");
r = await cashier("rpc/create_return", {
  payload: {
    sale_id: firstSale,
    refund_method: "cash",
    reason: "Wrong size",
    lines: [{ sale_line_id: lines[0].id, quantity: 3, condition: "restock" }],
  },
});
check("can't return more than was bought", !r.ok, r.msg);
r = await cashier("rpc/create_return", {
  payload: {
    sale_id: firstSale,
    refund_method: "cash",
    reason: "Handle broken",
    lines: [{ sale_line_id: lines[0].id, quantity: 1, condition: "damaged" }],
  },
});
check("damaged return refunded in cash", r.ok, r.msg);
check("damaged return doesn't go back on sale", (await level("LX21-KC12S", "SH1")) === stockBeforeReturn);

const expected = Object.fromEntries(
  (await cashier("rpc/shift_expected", { p_shift_id: shift })).data.map((e) => [e.method, e.expected_kobo]),
);
// float 10,000 + cash sales (42,000 + 26,000 + 21,000) − refund 21,000
check("expected cash = float + sales − refunds", expected.cash === 1000000 + 4200000 + 2600000 + 2100000 - 2100000);
check("expected card and transfer", expected.card === 2000000 && expected.transfer === 1825000);
r = await cashier("rpc/close_shift", {
  p_shift_id: shift,
  p_counted_cash: expected.cash - 50000,
  p_counted_card: 2000000,
  p_counted_transfer: 1825000,
  p_note: "₦500 short",
});
check("cashier closes the till", r.ok, r.msg);
r = await sale({ lines: basket, payments: cash(4200000) });
check("no sales after closing", !r.ok, r.msg);
check("warehouse staff can't see sales", (await wh("sales?select=id")).data.length === 0);
check("warehouse staff can't see customers", (await wh("customers?select=id")).data.length === 0);

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
