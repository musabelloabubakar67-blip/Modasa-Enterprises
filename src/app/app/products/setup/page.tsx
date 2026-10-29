import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { moveCategory } from "../actions";
import { CategoryForm, UnitForm } from "./forms";

const COVERAGE_LABELS = { none: "—", roll: "Roll size", area: "m² per unit" } as const;

export default async function CatalogueSetupPage() {
  await requireStaff(["owner", "manager"]);
  const supabase = await createClient();
  const [categories, units] = await Promise.all([
    supabase.from("categories").select("id, name, sort_order, is_active").order("sort_order").order("name"),
    supabase.from("units").select("id, name, abbreviation, allows_decimal, coverage").order("sort_order").order("name"),
  ]);
  if (categories.error) throw categories.error;
  if (units.error) throw units.error;

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <Link href="/app/products" className="text-muted text-sm hover:underline">
          ← Products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Categories &amp; units</h1>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Categories</h2>
          <p className="text-muted text-sm">
            The website menu shows categories in this order; what doesn&apos;t fit on one line goes under
            &ldquo;More&rdquo;, so put the ones customers look for most at the top. Deactivated categories can&apos;t be
            picked for new products.
          </p>
        </div>
        <ul className="card divide-border divide-y">
          {categories.data.map((c, i) => (
            <li key={c.id} className="flex items-start">
              <div className="flex shrink-0 flex-col p-1.5">
                <form action={moveCategory.bind(null, c.id, "up")}>
                  <button
                    type="submit"
                    disabled={i === 0}
                    aria-label={`Move ${c.name} up`}
                    className="text-muted hover:text-foreground px-2 leading-5 disabled:opacity-25"
                  >
                    ↑
                  </button>
                </form>
                <form action={moveCategory.bind(null, c.id, "down")}>
                  <button
                    type="submit"
                    disabled={i === categories.data.length - 1}
                    aria-label={`Move ${c.name} down`}
                    className="text-muted hover:text-foreground px-2 leading-5 disabled:opacity-25"
                  >
                    ↓
                  </button>
                </form>
              </div>
              <details className="group min-w-0 flex-1">
                <summary className="flex cursor-pointer list-none items-center justify-between p-3">
                  <span>
                    {c.name}
                    {!c.is_active && <span className="text-muted ml-2 text-xs">(inactive)</span>}
                  </span>
                  <span className="text-muted text-xs group-open:hidden">Edit</span>
                </summary>
                <div className="border-border bg-background/50 border-t p-3">
                  <CategoryForm category={c} />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <div className="card p-4">
          <CategoryForm />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Units</h2>
          <p className="text-muted text-sm">
            How products are sold and counted. &ldquo;Coverage&rdquo; lets the till work out quantities from wall or
            floor sizes — use Roll size for wallpaper, and m² per unit for anything sold to cover an area (tiles by the
            box, marble sheets, wall panels).
          </p>
        </div>
        <ul className="card divide-border divide-y">
          {units.data.map((u) => (
            <li key={u.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
                  <span>
                    {u.name} <span className="text-muted">({u.abbreviation})</span>
                  </span>
                  <span className="text-muted text-xs">
                    {u.allows_decimal ? "Decimals · " : ""}
                    {COVERAGE_LABELS[u.coverage]}
                  </span>
                </summary>
                <div className="border-border bg-background/50 border-t p-3">
                  <UnitForm unit={u} />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <div className="card p-4">
          <UnitForm />
        </div>
      </section>
    </div>
  );
}
