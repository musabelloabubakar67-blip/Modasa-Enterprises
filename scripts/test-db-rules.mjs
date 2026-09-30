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

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
