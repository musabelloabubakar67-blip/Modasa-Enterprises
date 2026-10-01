// Creates local test accounts (owner, Shop 1 cashier, Warehouse A staff) from the DEV_* values in .env.local.
// Local development only: refuses to run against anything but a local Supabase.
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Refusing to create test users on ${url}; this script is for local Supabase only.`);
  process.exit(1);
}

const headers = {
  apikey: env.SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
  "Content-Type": "application/json",
};

const locationId = async (code) =>
  (await (await fetch(`${url}/rest/v1/locations?code=eq.${code}&select=id`, { headers })).json())[0]?.id;
const shop = { id: await locationId("SH1") };
const warehouse = { id: await locationId("WH-A") };

const users = [
  { email: env.DEV_OWNER_EMAIL, password: env.DEV_OWNER_PASSWORD, meta: { full_name: "Test Owner", role: "owner" } },
  {
    email: env.DEV_CASHIER_EMAIL,
    password: env.DEV_CASHIER_PASSWORD,
    meta: { full_name: "Test Cashier", role: "cashier", location_id: shop.id },
  },
  {
    email: env.DEV_WAREHOUSE_EMAIL,
    password: env.DEV_WAREHOUSE_PASSWORD,
    meta: { full_name: "Test Warehouse", role: "warehouse", location_id: warehouse.id },
  },
];

for (const user of users) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: user.email, password: user.password, email_confirm: true, user_metadata: user.meta }),
  });
  const body = await res.json();
  console.log(res.ok ? `created ${user.email}` : `${user.email}: ${body.msg ?? body.message ?? res.status}`);
}

// Demo history in the seed has no cashier; credit Shop 1's to the test cashier so staff reports have data.
const cashierId = (
  await (
    await fetch(`${url}/rest/v1/profiles?email=eq.${encodeURIComponent(env.DEV_CASHIER_EMAIL)}&select=id`, { headers })
  ).json()
)[0]?.id;
if (cashierId && shop.id) {
  for (const table of ["sales", "returns"]) {
    const column = table === "sales" ? "cashier_id" : "created_by";
    await fetch(`${url}/rest/v1/${table}?${column}=is.null&location_id=eq.${shop.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ [column]: cashierId }),
    });
  }
  await fetch(`${url}/rest/v1/shifts?closed_by=is.null&status=eq.closed&location_id=eq.${shop.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ opened_by: cashierId, closed_by: cashierId }),
  });
}
