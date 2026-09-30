import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { canEditProducts, sellingPrice } from "@/lib/products";
import { ProductThumb } from "@/components/product-thumb";

const PAGE_SIZE = 40;

export default async function ProductsPage({ searchParams }: PageProps<"/app/products">) {
  const staff = await requireStaff();
  const { currency } = await getBusinessSettings();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";
  const status = params.status === "archived" || params.status === "all" ? params.status : "active";
  const page = Math.max(1, Number(params.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(
      "id, name, is_active, categories(name), units(abbreviation), skus(code, variant_label, price_kobo, promo_price_kobo, is_active), product_images(storage_path, sort_order)",
      { count: "exact" },
    )
    .order("name")
    .order("sort_order", { referencedTable: "skus" })
    .order("sort_order", { referencedTable: "product_images" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.ilike("search_text", `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (category) query = query.eq("category_id", category);
  if (status !== "all") query = query.eq("is_active", status === "active");

  const [{ data: products, count, error }, { data: categories }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
  ]);
  if (error) throw error;

  const canEdit = canEditProducts(staff.role);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (category) sp.set("category", category);
    if (status !== "active") sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/app/products${s ? `?${s}` : ""}`;
  };

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Link href="/app/products/setup" className="btn btn-secondary">
              Categories &amp; units
            </Link>
            <Link href="/app/products/import" className="btn btn-secondary">
              Import
            </Link>
            <Link href="/app/products/new" className="btn btn-primary">
              New product
            </Link>
          </div>
        )}
      </div>

      <form className="mt-4 flex flex-wrap gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, code or barcode"
          className="input max-w-xs flex-1"
          aria-label="Search products"
        />
        <select name="category" defaultValue={category} className="input w-auto" aria-label="Category">
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="input w-auto" aria-label="Status">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <button type="submit" className="btn btn-secondary">
          Filter
        </button>
      </form>

      <p className="text-muted mt-4 text-sm">
        {count ?? 0} product{count === 1 ? "" : "s"}
      </p>

      <ul className="card divide-border mt-2 divide-y">
        {products.length === 0 && (
          <li className="text-muted p-6 text-center text-sm">
            No products found.{" "}
            {canEdit && !q && (
              <>
                <Link href="/app/products/new" className="text-accent underline">
                  Add one
                </Link>{" "}
                or{" "}
                <Link href="/app/products/import" className="text-accent underline">
                  import a spreadsheet
                </Link>
                .
              </>
            )}
          </li>
        )}
        {products.map((product) => {
          const skus = product.skus.filter((s) => s.is_active);
          const prices = skus.map(sellingPrice);
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          const onSale = skus.some((s) => s.promo_price_kobo !== null);
          return (
            <li key={product.id}>
              <Link href={`/app/products/${product.id}`} className="hover:bg-background flex items-center gap-3 p-3">
                <ProductThumb path={product.product_images[0]?.storage_path} name={product.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {product.name}
                    {!product.is_active && (
                      <span className="bg-background text-muted ml-2 rounded px-1.5 py-0.5 text-xs">Archived</span>
                    )}
                  </p>
                  <p className="text-muted truncate text-sm">
                    {product.categories.name} ·{" "}
                    {skus.length === 1
                      ? skus[0].code
                      : `${skus.length} variants (${skus
                          .slice(0, 4)
                          .map((s) => s.variant_label ?? s.code)
                          .join(", ")}${skus.length > 4 ? "…" : ""})`}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  {prices.length > 0 ? (
                    <p className="font-medium tabular-nums">
                      {formatMoney(min, currency)}
                      {max !== min && <> – {formatMoney(max, currency)}</>}
                    </p>
                  ) : (
                    <p className="text-muted">No active SKUs</p>
                  )}
                  <p className="text-muted text-xs">
                    per {product.units.abbreviation}
                    {onSale && <span className="text-success ml-1">· on sale</span>}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn btn-secondary">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="btn btn-secondary">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
