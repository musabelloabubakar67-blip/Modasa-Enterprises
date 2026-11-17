// Prepares the local database for recording the demo tour (src/tour/script.ts), on top of the seed:
// named staff with PINs, the seed's sales shared out among the cashiers, and yesterday's rug sale to Amaka
// Obi that the tour exchanges. Today's tills start closed.
// Local only, and it changes data. Run it on a freshly reset database:
//   npm run demo:reset        (= npx supabase db reset && node scripts/demo-setup.mjs)
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Refusing to run against ${url}; local Supabase only.`);
  process.exit(1);
}
const password = env.DEMO_TOUR_PASSWORD;
if (!password) {
  console.error("Set DEMO_TOUR_PASSWORD in .env.local (any password; the tour signs in with it).");
  process.exit(1);
}

const secret = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` };
async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      ...(token ? { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } : secret),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path}: ${data?.message ?? data?.msg ?? res.status}`);
  return data;
}
const rest = (path, opts) => api(`/rest/v1/${path}`, opts);

const loc = Object.fromEntries((await rest("locations?select=id,code")).map((l) => [l.code, l.id]));
const sku = Object.fromEntries((await rest("skus?select=id,code")).map((s) => [s.code, s.id]));
if (!loc.SH1 || !sku["CRUG-002"]) throw new Error("The seed data is missing. Run npx supabase db reset first.");

// ---------- Staff ----------
// The tour signs in as Kemi (owner) and hands the till to Ada with her PIN.
const STAFF = [
  { key: "kemi", name: "Kemi Adebayo", role: "owner" },
  { key: "tunde", name: "Tunde Okafor", role: "manager" },
  { key: "ada", name: "Ada Nwosu", role: "cashier", shop: "SH1", pin: "2580" },
  { key: "bisi", name: "Bisi Lawal", role: "cashier", shop: "SH1", pin: "1470" },
  { key: "chidi", name: "Chidi Eze", role: "cashier", shop: "SH2", pin: "3691" },
  { key: "halima", name: "Halima Bello", role: "cashier", shop: "SH3", pin: "4826" },
];
const email = (key) => `${key}@demo.local`;
const ids = {};
for (const s of STAFF) {
  const user = await api("/auth/v1/admin/users", {
    method: "POST",
    body: {
      email: email(s.key),
      password,
      email_confirm: true,
      user_metadata: { full_name: s.name, role: s.role, location_id: s.shop ? loc[s.shop] : null },
    },
  }).catch((e) => {
    throw new Error(`${e.message} (already set up? run npm run demo:reset)`);
  });
  ids[s.key] = user.id;
}

const tokens = {};
async function signIn(key) {
  const res = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email: email(key), password },
    token: undefined,
  });
  return (tokens[key] = res.access_token);
}
for (const s of STAFF.filter((s) => s.pin)) {
  await rest("rpc/set_till_pin", { method: "POST", body: { p_pin: s.pin }, token: await signIn(s.key) });
}
// Managers' limit is low so the tour can show it; cashiers get 5%.
await rest("rpc/set_discount_limit", {
  method: "POST",
  body: { p_user: ids.tunde, p_pct: 10 },
  token: await signIn("kemi"),
});
for (const key of ["ada", "bisi", "chidi", "halima"]) {
  await rest("rpc/set_discount_limit", { method: "POST", body: { p_user: ids[key], p_pct: 5 }, token: tokens.kemi });
}

// ---------- The seed's history, shared out among the cashiers ----------
const people = { SH1: ["ada", "bisi"], SH2: ["chidi"], SH3: ["halima"] };
for (const [shop, keys] of Object.entries(people)) {
  const sales = await rest(`sales?select=id&location_id=eq.${loc[shop]}&cashier_id=is.null&order=created_at`);
  for (const [i, key] of keys.entries()) {
    const mine = sales.filter((_, n) => n % keys.length === i).map((s) => s.id);
    for (let n = 0; n < mine.length; n += 100) {
      await rest(`sales?id=in.(${mine.slice(n, n + 100).join(",")})`, {
        method: "PATCH",
        body: { cashier_id: ids[key] },
      });
    }
  }
  await rest(`shifts?location_id=eq.${loc[shop]}&opened_by=is.null`, {
    method: "PATCH",
    body: { opened_by: ids[keys[0]], closed_by: ids[keys[0]] },
  });
}

// ---------- Yesterday: Amaka Obi buys a 4 × 6 rug at Shop 1 (the tour exchanges it) ----------
const ada = await signIn("ada");
const yesterdayShift = (
  await rest(`shifts?select=id,opened_at&location_id=eq.${loc.SH1}&status=eq.closed&order=opened_at.desc&limit=1`)
)[0];
// The sale is made through a till session like any other, then moved to yesterday's.
const tempShift = await rest("rpc/open_shift", {
  method: "POST",
  body: { p_location_id: loc.SH1, p_float_kobo: 0 },
  token: ada,
});
const amakaSale = await rest("rpc/create_sale", {
  method: "POST",
  token: ada,
  body: {
    payload: {
      location_id: loc.SH1,
      lines: [{ sku_id: sku["CRUG-002"], quantity: 1 }],
      payments: [{ method: "transfer", amount_kobo: 7000000, reference: "Amaka Obi" }],
      customer: { name: "Amaka Obi", phone: "0803 555 0142" },
    },
  },
});
const yesterday = new Date(new Date(yesterdayShift.opened_at).getTime() + 7 * 3600 * 1000).toISOString();
await rest(`sales?id=eq.${amakaSale}`, {
  method: "PATCH",
  body: { created_at: yesterday, shift_id: yesterdayShift.id },
});
await rest(`stock_movements?reference_id=eq.${amakaSale}`, { method: "PATCH", body: { created_at: yesterday } });
await rest(`shifts?id=eq.${tempShift}`, { method: "DELETE" });

// Today's tills start closed: the tour opens Shop 1's.

console.log("Demo data ready. Now (re)start the app: npm run build && npm start (or npm run dev).");
console.log("Then open http://localhost:3000/login?tour=1 and press Enter.");
