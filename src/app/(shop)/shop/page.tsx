import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard, ProductGrid } from "@/components/shop/product-card";
import { ShopClosed } from "@/components/shop/shop-closed";
import { PAGE_SIZE, getStorefront, listProducts, type ProductQuery } from "@/lib/shop/data";

const SORTS = [
  { key: "featured", label: "Featured" },
  { key: "new", label: "Newest" },
  { key: "price-asc", label: "Price, low to high" },
  { key: "price-desc", label: "Price, high to low" },
] as const;

type Filters = { category?: string; q?: string; sale?: boolean; sort: (typeof SORTS)[number]["key"]; page: number };

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

function readFilters(params: Record<string, string | string[] | undefined>): Filters {
  const sort = SORTS.find((s) => s.key === first(params.sort))?.key ?? "featured";
  const page = Math.max(1, Math.min(500, Number.parseInt(first(params.page) ?? "1", 10) || 1));
  return {
    category: first(params.category),
    q: first(params.q)?.slice(0, 80),
    sale: first(params.sale) === "1",
    sort,
    page,
  };
}

function href(filters: Filters, change: Partial<Filters>) {
  const next = { ...filters, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.q) params.set("q", next.q);
  if (next.sale) params.set("sale", "1");
  if (next.sort !== "featured") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/shop?${query}` : "/shop";
}

async function heading(filters: Filters) {
  const shop = await getStorefront();
  const category = shop.categories.find((c) => c.slug === filters.category);
  if (filters.q) return { shop, category, title: `Results for “${filters.q}”` };
  if (filters.sale) return { shop, category, title: category ? `${category.name} on sale` : "Sale" };
  if (category) return { shop, category, title: category.name };
  return { shop, category, title: filters.sort === "new" ? "New in" : "Everything" };
}

export async function generateMetadata({ searchParams }: PageProps<"/shop">): Promise<Metadata> {
  const { title } = await heading(readFilters(await searchParams));
  return { title };
}

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const filters = readFilters(await searchParams);
  const { shop, category, title } = await heading(filters);
  if (!shop.enabled) return <ShopClosed shop={shop} />;

  const query: ProductQuery = {
    categoryId: category?.id,
    search: filters.q,
    sale: filters.sale,
    sort: filters.sort,
    page: filters.page,
  };
  // An unknown category in the address shows nothing rather than everything.
  const { products, total } = filters.category && !category ? { products: [], total: 0 } : await listProducts(query);
  const pages = Math.ceil(total / PAGE_SIZE);
  const chip = (active: boolean) =>
    `caps inline-flex min-h-11 shrink-0 items-center border px-4 transition-colors ${
      active ? "border-foreground bg-foreground text-on-dark" : "border-border hover:border-foreground"
    }`;

  return (
    <div className="shop-wrap py-10 md:py-14">
      <h1 className="font-serif text-[clamp(32px,4vw,48px)] leading-[1.1]">{title}</h1>
      <p className="text-muted mt-2 text-sm">
        {total} {total === 1 ? "item" : "items"}
      </p>

      <div className="-mx-5 mt-7 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Link
          href={href(filters, { category: undefined, sale: false })}
          className={chip(!filters.category && !filters.sale)}
        >
          All
        </Link>
        {shop.categories.map((c) => (
          <Link key={c.id} href={href(filters, { category: c.slug })} className={chip(filters.category === c.slug)}>
            {c.name}
          </Link>
        ))}
        {shop.hasSale && (
          <Link href={href(filters, { sale: !filters.sale })} className={chip(!!filters.sale)}>
            Sale
          </Link>
        )}
      </div>

      <div className="border-border mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-y py-2 text-sm">
        <span className="text-muted">Sort by</span>
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={href(filters, { sort: s.key })}
            aria-current={filters.sort === s.key ? "true" : undefined}
            className={`inline-flex min-h-11 items-center ${
              filters.sort === s.key ? "underline underline-offset-4" : "text-muted hover:text-foreground"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-serif text-2xl">Nothing matches that just yet</p>
          <p className="text-muted mt-2">Try a different word, or browse everything we have.</p>
          <Link href="/shop" className="shop-btn mt-7">
            Browse everything
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <ProductGrid>
            {products.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                shops={shop.shops}
                leadTime={shop.leadTime}
                currency={shop.currency}
                eager={i < 4}
              />
            ))}
          </ProductGrid>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-14 flex items-center justify-center gap-6 text-sm">
          {filters.page > 1 ? (
            <Link href={href(filters, { page: filters.page - 1 })} className="shop-btn shop-btn-outline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted tabular-nums">
            Page {filters.page} of {pages}
          </span>
          {filters.page < pages ? (
            <Link href={href(filters, { page: filters.page + 1 })} className="shop-btn shop-btn-outline">
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
