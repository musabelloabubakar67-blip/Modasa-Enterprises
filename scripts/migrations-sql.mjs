// Combines the database migrations into one SQL script to paste into the Supabase dashboard's SQL Editor,
// for setting up or updating a hosted project without installing the Supabase CLI.
//
//   node scripts/migrations-sql.mjs > setup.sql                    all migrations (new project)
//   node scripts/migrations-sql.mjs --after 20261001000007 > update.sql   only newer ones
//
// The script runs in one transaction, so a failure applies nothing. It also records each migration in
// supabase_migrations.schema_migrations, the table the CLI uses, so `supabase db push` still works later.
import fs from "node:fs";
import path from "node:path";

const dir = new URL("../supabase/migrations/", import.meta.url);
const afterIndex = process.argv.indexOf("--after");
const after = afterIndex === -1 ? "" : process.argv[afterIndex + 1];
if (afterIndex !== -1 && !/^\d{14}$/.test(after ?? "")) {
  console.error("--after takes a migration version, e.g. 20261001000007");
  process.exit(1);
}

const files = fs
  .readdirSync(dir)
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort()
  .filter((f) => f.slice(0, 14) > after);
if (!files.length) {
  console.error("No migrations to include.");
  process.exit(1);
}

const quote = (s) => `'${s.replace(/'/g, "''")}'`;
const out = [
  `-- ${files.length} migration(s): ${files[0]} … ${files.at(-1)}`,
  "begin;",
  "",
  // Stop if any of these were already applied, rather than failing halfway with a confusing error.
  "create schema if not exists supabase_migrations;",
  "create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);",
  // Bookkeeping only; nothing should read it through the API.
  "alter table supabase_migrations.schema_migrations enable row level security;",
  "do $$ begin",
  `  if exists (select 1 from supabase_migrations.schema_migrations where version in (${files.map((f) => quote(f.slice(0, 14))).join(", ")})) then`,
  "    raise exception 'Some of these migrations are already applied. Use --after with the latest applied version.';",
  "  end if;",
  "end $$;",
  "",
];
for (const f of files) {
  out.push(`-- ======== ${f} ========`, fs.readFileSync(path.join(dir.pathname, f), "utf8").trim(), "");
  out.push(
    `insert into supabase_migrations.schema_migrations (version, name) values (${quote(f.slice(0, 14))}, ${quote(f.slice(15, -4))});`,
    "",
  );
}
out.push("commit;", "");
process.stdout.write(out.join("\n"));
