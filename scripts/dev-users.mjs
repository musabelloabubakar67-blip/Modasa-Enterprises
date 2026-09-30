// Creates local test accounts (owner + Shop 1 cashier) from the DEV_* values in .env.local.
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

const [shop] = await (await fetch(`${url}/rest/v1/locations?code=eq.SH1&select=id`, { headers })).json();

const users = [
  { email: env.DEV_OWNER_EMAIL, password: env.DEV_OWNER_PASSWORD, meta: { full_name: "Test Owner", role: "owner" } },
  {
    email: env.DEV_CASHIER_EMAIL,
    password: env.DEV_CASHIER_PASSWORD,
    meta: { full_name: "Test Cashier", role: "cashier", location_id: shop?.id },
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
